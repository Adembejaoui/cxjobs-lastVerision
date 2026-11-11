import { cache } from "react";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

/**
 * Session revocation for the Auth.js JWT strategy.
 *
 * Source of truth: `users.sessionVersion` (DB). Every JWT carries the version
 * it was minted with (`sv`). Revoking = incrementing the column inside the
 * same transaction as the triggering change, then publishing the new value to
 * Redis so every instance rejects older tokens on the very next request.
 *
 * Cost: one Redis GET per authenticated request (bounded to
 * LOOKUP_TIMEOUT_MS). If Redis is unavailable the lookup returns null and the
 * DB re-read in the jwt callback (every 15 min) still enforces revocation.
 */

const KEY_PREFIX = "session-version:";
/** Longest possible JWT lifetime (session.maxAge in lib/auth.ts). */
export const SESSION_VERSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const LOOKUP_TIMEOUT_MS = 300;

/**
 * Monotonic publish: store ARGV[1] only if it is greater than the current
 * value, atomically (one EVAL). Two revocations whose publishes arrive out of
 * order can therefore never leave Redis holding the LOWER version. The TTL is
 * refreshed either way. A missing or non-numeric current value counts as -1.
 * Returns the version held after the call.
 */
export const PUBLISH_MAX_LUA = `
local cur = tonumber(redis.call('GET', KEYS[1])) or -1
local v = tonumber(ARGV[1])
if v > cur then
  redis.call('SET', KEYS[1], ARGV[1], 'EX', tonumber(ARGV[2]))
  return v
end
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
return cur
`;

/** The subset of the Upstash client used here (the real client satisfies it). */
export interface RevocationStore {
  get(key: string): Promise<unknown>;
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
}

let storeOverride: RevocationStore | null | undefined;

/** Test hook: inject a store (null = no store). Pass undefined to reset. */
export function __setRevocationStoreForTests(store: RevocationStore | null | undefined): void {
  storeOverride = store;
}

function getStore(): RevocationStore | null {
  if (storeOverride !== undefined) return storeOverride;
  return (redis as unknown as RevocationStore | null) ?? null;
}

/** Minimal Prisma surface needed (works with the client or a transaction). */
export interface SessionVersionDb {
  user: {
    update(args: {
      where: { id: string };
      data: { sessionVersion: { increment: number } };
      select: { sessionVersion: true };
    }): Promise<{ sessionVersion: number }>;
  };
}

/**
 * Increment the user's sessionVersion. Call INSIDE the transaction that
 * performs the triggering change, then call `publishSessionVersion` with the
 * returned value after the transaction commits.
 */
export async function bumpSessionVersion(db: SessionVersionDb, userId: string): Promise<number> {
  const { sessionVersion } = await db.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  return sessionVersion;
}

/** Publish a committed sessionVersion. Never throws. */
export async function publishSessionVersion(userId: string, version: number): Promise<void> {
  const store = getStore();
  if (!store) return;
  try {
    await store.eval(PUBLISH_MAX_LUA, [KEY_PREFIX + userId], [String(version), String(SESSION_VERSION_TTL_SECONDS)]);
  } catch (error) {
    // The DB already holds the new version; the periodic re-read enforces it.
    logger.warn("Session revocation publish failed; DB re-read will enforce it", {
      error: error instanceof Error ? error.name : "unknown",
    });
  }
}

/** Latest published version, or null if unknown/unavailable. Never throws. */
async function readPublishedSessionVersion(userId: string): Promise<number | null> {
  const store = getStore();
  if (!store) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      store.get(KEY_PREFIX + userId),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), LOOKUP_TIMEOUT_MS);
      }),
    ]);
    if (value === null || value === undefined) return null;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Request-scoped (React `cache`) wrapper: within ONE server render, the
 * layout, page and getAuthenticatedUser() each call `auth()` → the jwt
 * callback, and now share a single Redis GET instead of one each. The memo
 * lives only for that render's request scope and is never shared across
 * requests or users; outside a React render (Route Handlers, tests) it calls
 * straight through. Same mechanism as getAuthUserRecord().
 */
export const getPublishedSessionVersion = cache(readPublishedSessionVersion);

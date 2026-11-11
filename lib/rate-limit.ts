import { redis } from "./redis";
import { logger } from "./logger";

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  /**
   * Behaviour when the limiter backend errors (e.g. Redis outage).
   * Defaults to fail-closed: the request is rejected rather than silently
   * bypassing the limit. Set true only for low-risk, cheap public reads.
   */
  failOpen?: boolean;
}

export const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60_000,
  max: 10,
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  /**
   * Maximum number of requests actually enforced for this check. Carried on the
   * result so headers can report the limit that was really applied instead of
   * the module default, which callers override per route.
   */
  limit: number;
  /** True when the decision was forced by a limiter backend failure. */
  degraded?: boolean;
}

/**
 * Minimal store contract: atomically increment the counter for `key` and
 * return the new count plus the remaining window TTL. Fixed-window semantics:
 * the TTL is set only by the first hit, so traffic cannot extend a window.
 */
export interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<{ count: number; ttlMs: number }>;
  /**
   * Give back one previously counted hit (never below zero, never creating a
   * key). Used by quotas so a request that failed on our side does not burn
   * the user's allowance. Optional: stores without it simply never refund.
   */
  refund?(key: string): Promise<void>;
}

/**
 * Upper bound on one limiter round-trip. The Upstash client retries network
 * errors with exponential backoff; without this bound a Redis outage would
 * stall every protected request for seconds before failing closed.
 */
export const STORE_TIMEOUT_MS = 1500;

class RateLimitTimeoutError extends Error {
  constructor() {
    super("Rate limiter backend timed out");
    this.name = "RateLimitTimeoutError";
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new RateLimitTimeoutError()), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

// Single round-trip, atomic INCR + first-hit PEXPIRE. Also repairs a key that
// somehow lost its TTL so it can never become a permanent block.
export const FIXED_WINDOW_LUA = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local t = redis.call('PTTL', KEYS[1])
if t < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  t = tonumber(ARGV[1])
end
return {c, t}
`;

// Atomic "decrement if positive": never creates a key (so it cannot outlive
// its window without a TTL) and never goes negative (no credit banking).
export const REFUND_LUA = `
local c = tonumber(redis.call('GET', KEYS[1]) or '0')
if c > 0 then
  return redis.call('DECR', KEYS[1])
end
return 0
`;

export function createRedisStore(client: NonNullable<typeof redis>): RateLimitStore {
  return {
    async hit(key, windowMs) {
      const res = (await client.eval(FIXED_WINDOW_LUA, [key], [String(windowMs)])) as [number, number];
      return { count: Number(res[0]), ttlMs: Number(res[1]) };
    },
    async refund(key) {
      await client.eval(REFUND_LUA, [key], []);
    },
  };
}

/**
 * Process-local store. Used only outside production when Redis is not
 * configured, so local development still enforces limits. It is NOT shared
 * across instances and is never selected in production.
 */
export function createMemoryStore(now: () => number = Date.now): RateLimitStore & { clear(): void } {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    async hit(key, windowMs) {
      const t = now();
      let b = buckets.get(key);
      if (!b || b.resetAt <= t) {
        b = { count: 0, resetAt: t + windowMs };
        buckets.set(key, b);
      }
      b.count += 1;
      if (buckets.size > 10_000) {
        for (const [k, v] of buckets) if (v.resetAt <= t) buckets.delete(k);
      }
      return { count: b.count, ttlMs: b.resetAt - t };
    },
    async refund(key) {
      const b = buckets.get(key);
      if (b && b.resetAt > now() && b.count > 0) b.count -= 1;
    },
    clear() {
      buckets.clear();
    },
  };
}

let defaultStore: RateLimitStore | null = null;

function getDefaultStore(): RateLimitStore | null {
  if (defaultStore) return defaultStore;
  if (redis) {
    defaultStore = createRedisStore(redis);
  } else if (process.env.NODE_ENV !== "production") {
    defaultStore = createMemoryStore();
  }
  return defaultStore;
}

/** Test hook: replace the backing store (pass null to restore the default). */
export function __setRateLimitStoreForTests(store: RateLimitStore | null): void {
  defaultStore = store;
}

export function assertRedisConfigured(): void {
  if (!redis && process.env.NODE_ENV === "production") {
    throw new Error(
      "Redis is not configured. Rate limiting and caching require Redis in production. " +
      "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables."
    );
  }
}

export async function checkRateLimitAsync(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
  store: RateLimitStore | null = getDefaultStore()
): Promise<RateLimitResult> {
  const now = Date.now();
  const failure = (): RateLimitResult =>
    config.failOpen
      ? { allowed: true, remaining: config.max, resetAt: now + config.windowMs, limit: config.max, degraded: true }
      : { allowed: false, remaining: 0, resetAt: now + config.windowMs, limit: config.max, degraded: true };

  if (!store) {
    // Production without Redis: never silently allow.
    logger.error("Rate limiter backend not configured", { key: redactKey(key) });
    return failure();
  }

  try {
    const { count, ttlMs } = await withTimeout(store.hit(`ratelimit:${key}`, config.windowMs), STORE_TIMEOUT_MS);
    const resetAt = now + Math.max(0, ttlMs);
    if (count > config.max) {
      return { allowed: false, remaining: 0, resetAt, limit: config.max };
    }
    return { allowed: true, remaining: Math.max(0, config.max - count), resetAt, limit: config.max };
  } catch (error) {
    logger.error("Rate limiter backend error", {
      key: redactKey(key),
      error: error instanceof Error ? error.name : "unknown",
    });
    return failure();
  }
}

/**
 * Undo one hit counted by `checkRateLimitAsync(key)`. Best effort: a backend
 * error is logged and swallowed (the user only loses one unit of allowance).
 */
export async function refundRateLimitAsync(
  key: string,
  store: RateLimitStore | null = getDefaultStore()
): Promise<void> {
  if (!store?.refund) return;
  try {
    await withTimeout(store.refund(`ratelimit:${key}`), STORE_TIMEOUT_MS);
  } catch (error) {
    logger.warn("Rate limiter refund failed", {
      key: redactKey(key),
      error: error instanceof Error ? error.name : "unknown",
    });
  }
}

/**
 * Apply several limits (e.g. per-IP and per-account) to one request. Every
 * key is counted, and the most restrictive result is returned.
 */
export async function checkRateLimitsAsync(
  checks: Array<{ key: string; config: RateLimitConfig }>,
  store?: RateLimitStore | null
): Promise<RateLimitResult> {
  const results = await Promise.all(
    checks.map((c) => (store === undefined ? checkRateLimitAsync(c.key, c.config) : checkRateLimitAsync(c.key, c.config, store)))
  );
  const denied = results.filter((r) => !r.allowed);
  if (denied.length > 0) {
    return denied.reduce((a, b) => (b.resetAt > a.resetAt ? b : a));
  }
  return results.reduce((a, b) => (b.remaining < a.remaining ? b : a));
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
  if (!result.allowed) {
    headers["Retry-After"] = String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)));
  }
  return headers;
}

/** Keys can contain emails; log only the namespace. */
function redactKey(key: string): string {
  return key.split(":")[0] ?? "ratelimit";
}

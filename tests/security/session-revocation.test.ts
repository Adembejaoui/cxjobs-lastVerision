import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { jwtCallback, DEFAULT_REFRESH_SECONDS, type TokenUserRecord } from "../../lib/auth-callbacks";
import {
  __setRevocationStoreForTests,
  bumpSessionVersion,
  getPublishedSessionVersion,
  publishSessionVersion,
  SESSION_VERSION_TTL_SECONDS,
  PUBLISH_MAX_LUA,
} from "../../lib/server/session-revocation";
import { createMemoryRevocationStore } from "../helpers/revocation-store";

const NOW = 1_800_000_000_000;
const nowSec = Math.floor(NOW / 1000);
const user = (over: Partial<TokenUserRecord> = {}): TokenUserRecord => ({
  id: "u1",
  role: "CANDIDATE",
  isActive: true,
  isOnboarded: true,
  emailVerified: new Date(0),
  sessionVersion: 0,
  ...over,
});
const token = (over: Record<string, unknown> = {}) => ({ id: "u1", role: "CANDIDATE", sv: 0, claimsAt: nowSec - 10, ...over });

afterEach(() => __setRevocationStoreForTests(undefined));

test("revocation: published newer version rejects the token immediately, without a DB read", async () => {
  let dbReads = 0;
  const out = await jwtCallback(
    { token: token() },
    {
      now: () => NOW,
      loadUser: async () => {
        dbReads++;
        return user();
      },
      getPublishedSessionVersion: async () => 1,
    }
  );
  assert.equal(out, null);
  assert.equal(dbReads, 0);
});

test("revocation: same published version keeps a fresh session without a DB read", async () => {
  let dbReads = 0;
  const t = token();
  const out = await jwtCallback(
    { token: t },
    { now: () => NOW, loadUser: async () => (dbReads++, user()), getPublishedSessionVersion: async () => 0 }
  );
  assert.equal(out, t);
  assert.equal(dbReads, 0);
});

test("revocation: Redis unavailable → DB re-read enforces it once claims are stale", async () => {
  const deps = { now: () => NOW, loadUser: async () => user({ sessionVersion: 1 }), getPublishedSessionVersion: async () => null };
  // Fresh claims: accepted until the refresh window (bounded delay).
  assert.notEqual(await jwtCallback({ token: token() }, deps), null);
  // Stale claims: DB says version 1, token has 0 → revoked.
  assert.equal(await jwtCallback({ token: token({ claimsAt: nowSec - DEFAULT_REFRESH_SECONDS - 1 }) }, deps), null);
});

test("revocation: session update re-reads DB and rejects an outdated version", async () => {
  const out = await jwtCallback(
    { token: token(), trigger: "update" },
    { now: () => NOW, loadUser: async () => user({ sessionVersion: 3 }) }
  );
  assert.equal(out, null);
});

test("revocation: suspended account is rejected on refresh", async () => {
  const out = await jwtCallback({ token: token({ claimsAt: 0 }) }, { now: () => NOW, loadUser: async () => user({ isActive: false }) });
  assert.equal(out, null);
});

test("revocation: deleted account is rejected on refresh", async () => {
  assert.equal(await jwtCallback({ token: token({ claimsAt: 0 }) }, { now: () => NOW, loadUser: async () => null }), null);
});

test("revocation: role change is reflected on refresh (no stale ADMIN claim)", async () => {
  const out = await jwtCallback(
    { token: token({ role: "ADMIN", claimsAt: nowSec - DEFAULT_REFRESH_SECONDS - 1 }) },
    { now: () => NOW, loadUser: async () => user({ role: "CANDIDATE" }) }
  );
  assert.equal(out?.role, "CANDIDATE");
});

test("revocation: sign-in stamps the current sessionVersion and claimsAt", async () => {
  const out = await jwtCallback(
    { token: {}, user: { id: "u1" }, trigger: "signIn" },
    { now: () => NOW, loadUser: async () => user({ sessionVersion: 7 }), getPublishedSessionVersion: async () => 7 }
  );
  assert.equal(out?.sv, 7);
  assert.equal(out?.claimsAt, nowSec);
});

test("regression: Auth.js re-stamping `iat` no longer postpones the periodic DB re-read", async () => {
  let dbReads = 0;
  await jwtCallback(
    // iat is "now" (re-encoded cookie) but claims are 2h old.
    { token: token({ iat: nowSec, claimsAt: nowSec - 7200 }) },
    { now: () => NOW, loadUser: async () => (dbReads++, user()) }
  );
  assert.equal(dbReads, 1);
});

test("compat: legacy token without sv/claimsAt is refreshed and stays valid at version 0", async () => {
  const out = await jwtCallback(
    { token: { id: "u1", role: "CANDIDATE", iat: nowSec } },
    { now: () => NOW, loadUser: async () => user({ sessionVersion: 0 }) }
  );
  assert.equal(out?.sv, 0);
  assert.equal(out?.claimsAt, nowSec);
});

test("revocation store: publish then read back, with 30-day TTL", async () => {
  const { store, data } = createMemoryRevocationStore();
  __setRevocationStoreForTests(store);
  await publishSessionVersion("u1", 4);
  assert.equal(await getPublishedSessionVersion("u1"), 4);
  assert.equal(data.get("session-version:u1")?.ex, SESSION_VERSION_TTL_SECONDS);
  assert.equal(await getPublishedSessionVersion("unknown"), null);
});

test("M4: out-of-order publishes never lower the published version", async () => {
  const { store, value } = createMemoryRevocationStore();
  __setRevocationStoreForTests(store);
  // Revocation A commits v=1, revocation B commits v=2, but B publishes first.
  await publishSessionVersion("u1", 2);
  await publishSessionVersion("u1", 1);
  assert.equal(value("session-version:u1"), "2");
  // A token minted at v=1 must still be rejected after the late v=1 publish.
  const out = await jwtCallback(
    { token: token({ sv: 1 }) },
    { now: () => NOW, loadUser: async () => user({ sessionVersion: 2 }), getPublishedSessionVersion }
  );
  assert.equal(out, null);
});

test("M3: request-scoped cache never hides a newer revocation outside a render", async () => {
  const { store } = createMemoryRevocationStore();
  let gets = 0;
  __setRevocationStoreForTests({ get: (k) => (gets++, store.get(k)), eval: store.eval });
  await publishSessionVersion("u1", 1);
  assert.equal(await getPublishedSessionVersion("u1"), 1);
  await publishSessionVersion("u1", 2);
  assert.equal(await getPublishedSessionVersion("u1"), 2);
  assert.equal(gets, 2); // pass-through: each call reads the store
});

test("M4: concurrent publishes converge on the maximum", async () => {
  const { store, value } = createMemoryRevocationStore();
  __setRevocationStoreForTests(store);
  await Promise.all([5, 3, 9, 1, 7].map((v) => publishSessionVersion("u1", v)));
  assert.equal(value("session-version:u1"), "9");
});

test("M4: publish uses the atomic compare-and-set script, not a plain SET", async () => {
  const seen: { script: string; keys: string[]; args: string[] }[] = [];
  __setRevocationStoreForTests({
    get: async () => null,
    eval: async (script, keys, args) => {
      seen.push({ script, keys, args });
      return 1;
    },
  });
  await publishSessionVersion("u1", 1);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].script, PUBLISH_MAX_LUA);
  assert.deepEqual(seen[0].keys, ["session-version:u1"]);
  assert.deepEqual(seen[0].args, ["1", String(SESSION_VERSION_TTL_SECONDS)]);
  assert.match(PUBLISH_MAX_LUA, /if v > cur then/);
});

test("revocation store: failures and garbage never throw and never revoke", async () => {
  __setRevocationStoreForTests({
    get: async () => {
      throw new Error("ECONNRESET");
    },
    eval: async () => {
      throw new Error("ECONNRESET");
    },
  });
  await publishSessionVersion("u1", 1); // must not throw
  assert.equal(await getPublishedSessionVersion("u1"), null);
  __setRevocationStoreForTests({ get: async () => "not-a-number", eval: async () => 0 });
  assert.equal(await getPublishedSessionVersion("u1"), null);
});

test("revocation store: slow Redis is bounded (≤ ~300 ms) and treated as unknown", async () => {
  __setRevocationStoreForTests({ get: () => new Promise((r) => setTimeout(() => r("9"), 5000).unref()), eval: async () => 0 });
  const t0 = Date.now();
  assert.equal(await getPublishedSessionVersion("u1"), null);
  assert.ok(Date.now() - t0 < 1000);
});

test("bumpSessionVersion increments atomically in the given transaction", async () => {
  const calls: unknown[] = [];
  const v = await bumpSessionVersion(
    {
      user: {
        update: async (args) => {
          calls.push(args);
          return { sessionVersion: 5 };
        },
      },
    },
    "u1"
  );
  assert.equal(v, 5);
  assert.deepEqual(calls, [{ where: { id: "u1" }, data: { sessionVersion: { increment: 1 } }, select: { sessionVersion: true } }]);
});

/**
 * Rate limiter ↔ Upstash integration, using the REAL @upstash/redis client
 * against a local fake of the Upstash REST API (no Redis/Docker needed, no
 * network egress). The fake executes EVAL serially, as Redis does, emulating
 * the FIXED_WINDOW_LUA semantics (INCR + first-hit PEXPIRE + PTTL).
 *
 * Not covered here: running the Lua source inside a real Redis. Use a
 * dedicated test Upstash database for that (see docs/security/PRODUCTION_READINESS.md).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawnSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import { Redis } from "@upstash/redis";
import {
  checkRateLimitAsync,
  checkRateLimitsAsync,
  createRedisStore,
  getRateLimitHeaders,
  FIXED_WINDOW_LUA,
  STORE_TIMEOUT_MS,
} from "../../lib/rate-limit";
import {
  PUBLISH_MAX_LUA,
  __setRevocationStoreForTests,
  getPublishedSessionVersion,
  publishSessionVersion,
  type RevocationStore,
} from "../../lib/server/session-revocation";

type Mode = "ok" | "500" | "401" | "slow";
let mode: Mode = "ok";
let clock = 1_000_000;
const keys = new Map<string, { count: number; expiresAt: number }>();
const seenCommands: unknown[][] = [];
const AUTH = "Bearer test-token";

function evalFixedWindow(cmd: unknown[]): [number, number] {
  // ["EVAL", script, numkeys, key, windowMs]
  assert.equal(String(cmd[0]).toUpperCase(), "EVAL");
  assert.equal(cmd[1], FIXED_WINDOW_LUA);
  assert.equal(Number(cmd[2]), 1);
  const key = String(cmd[3]);
  const windowMs = Number(cmd[4]);
  let entry = keys.get(key);
  if (!entry || entry.expiresAt <= clock) {
    entry = { count: 0, expiresAt: clock + windowMs };
    keys.set(key, entry);
  }
  entry.count += 1;
  return [entry.count, entry.expiresAt - clock];
}

// Revocation keys (PUBLISH_MAX_LUA + GET), emulated with Redis semantics.
const strings = new Map<string, string>();
function dispatch(cmd: unknown[]): unknown {
  const name = String(cmd[0]).toUpperCase();
  if (name === "GET") return strings.get(String(cmd[1])) ?? null;
  if (name === "EVAL" && cmd[1] === PUBLISH_MAX_LUA) {
    assert.equal(Number(cmd[2]), 1);
    const key = String(cmd[3]);
    const v = Number(cmd[4]);
    const curNum = Number(strings.get(key));
    const cur = Number.isFinite(curNum) ? curNum : -1;
    if (v > cur) {
      strings.set(key, String(cmd[4]));
      return v;
    }
    return cur;
  }
  return evalFixedWindow(cmd);
}

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.headers.authorization !== AUTH || mode === "401") {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    if (mode === "500") {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "ERR internal" }));
      return;
    }
    const respond = () => {
      const parsed = JSON.parse(body);
      const isPipeline = req.url?.startsWith("/pipeline") || req.url?.startsWith("/multi-exec");
      const commands: unknown[][] = isPipeline ? parsed : [parsed];
      const results = commands.map((c) => {
        seenCommands.push(c);
        return { result: dispatch(c) };
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(isPipeline ? results : results[0]));
    };
    if (mode === "slow") setTimeout(respond, 5000).unref();
    else respond();
  });
});

let url = "";
before(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => {
  server.closeAllConnections();
  server.close();
  setTimeout(() => process.exit(0), 50).unref(); // pino-pretty worker
});

function store(token = "test-token", target = () => url) {
  return createRedisStore(
    new Redis({ url: target(), token, retry: { retries: 0, backoff: () => 0 }, enableTelemetry: false })
  );
}

const cfg = { windowMs: 60_000, max: 3 };

test("Redis: limit enforced through the real Upstash client", async () => {
  mode = "ok";
  keys.clear();
  const s = store();
  const r = [];
  for (let i = 0; i < 5; i++) r.push(await checkRateLimitAsync("login-ip:1.2.3.4", cfg, s));
  assert.deepEqual(r.map((x) => x.allowed), [true, true, true, false, false]);
  assert.equal(r[0].remaining, 2);
  assert.ok(Number(getRateLimitHeaders(r[4])["Retry-After"]) >= 1);
});

test("Redis: one atomic EVAL per check, key namespaced, no TTL refresh", async () => {
  mode = "ok";
  keys.clear();
  seenCommands.length = 0;
  const s = store();
  await checkRateLimitAsync("ai-generate-user:u1", cfg, s);
  clock += 30_000;
  const second = await checkRateLimitAsync("ai-generate-user:u1", cfg, s);
  assert.equal(seenCommands.length, 2);
  assert.equal(seenCommands[0][3], "ratelimit:ai-generate-user:u1");
  // Window was set by the first hit only: 30s left, not a fresh 60s.
  assert.ok(second.resetAt - Date.now() <= 30_500);
  clock += 30_001;
  assert.equal((await checkRateLimitAsync("ai-generate-user:u1", cfg, s)).remaining, 2); // new window
});

test("Redis: 50 concurrent requests admit exactly `max`", async () => {
  mode = "ok";
  keys.clear();
  const s = store();
  const results = await Promise.all(
    Array.from({ length: 50 }, () => checkRateLimitAsync("burst", { windowMs: 60_000, max: 10 }, s))
  );
  assert.equal(results.filter((r) => r.allowed).length, 10);
});

test("Redis: per-account limit holds across IPs (multi-key, shared backend)", async () => {
  mode = "ok";
  keys.clear();
  const s = store();
  const out = [];
  for (let i = 0; i < 5; i++) {
    out.push(
      (
        await checkRateLimitsAsync(
          [
            { key: `login-ip:10.0.0.${i}`, config: { windowMs: 60_000, max: 100 } },
            { key: "login-acct:hash", config: { windowMs: 60_000, max: 3 } },
          ],
          s
        )
      ).allowed
    );
  }
  assert.deepEqual(out, [true, true, true, false, false]);
});

test("Redis unavailable (connection refused) → fail closed", async () => {
  const dead = store("test-token", () => "http://127.0.0.1:9");
  const r = await checkRateLimitAsync("forgot-pw-ip:1.1.1.1", cfg, dead);
  assert.equal(r.allowed, false);
  assert.equal(r.degraded, true);
});

test("Redis 5xx → fail closed", async () => {
  mode = "500";
  const r = await checkRateLimitAsync("scrape-user:u1", cfg, store());
  mode = "ok";
  assert.equal(r.allowed, false);
  assert.equal(r.degraded, true);
});

test("Redis wrong token (401) → fail closed", async () => {
  mode = "ok";
  const r = await checkRateLimitAsync("cv-parse-user:u1", cfg, store("wrong-token"));
  assert.equal(r.allowed, false);
});

test("Redis hanging → bounded by STORE_TIMEOUT_MS, then fail closed", async () => {
  mode = "slow";
  const started = Date.now();
  const r = await checkRateLimitAsync("login-ip:9.9.9.9", cfg, store());
  const elapsed = Date.now() - started;
  mode = "ok";
  assert.equal(r.allowed, false);
  assert.ok(elapsed >= STORE_TIMEOUT_MS - 50 && elapsed < STORE_TIMEOUT_MS + 1000, `elapsed ${elapsed}`);
});

test("Production without Upstash env → app refuses to start (no silent bypass)", () => {
  const res = spawnSync(
    process.execPath,
    ["--import", "tsx", "-e", "import('./lib/redis.ts').then(()=>console.log('LOADED')).catch(e=>{console.log('THREW:'+e.message);})"],
    {
      env: { ...process.env, NODE_ENV: "production", UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "" },
      encoding: "utf8",
      timeout: 60_000,
    }
  );
  assert.match(res.stdout, /THREW:Redis is not configured/);
});

test("Revocation via real Upstash client: monotonic publish + GET round-trip", async () => {
  mode = "ok";
  strings.clear();
  const client = new Redis({ url, token: "test-token", retry: { retries: 0, backoff: () => 0 }, enableTelemetry: false });
  __setRevocationStoreForTests(client as unknown as RevocationStore);
  try {
    await publishSessionVersion("u1", 2);
    await publishSessionVersion("u1", 1); // late, lower publish
    assert.equal(strings.get("session-version:u1"), "2");
    // Upstash auto-deserializes "2" → 2; the reader must accept that.
    assert.equal(await getPublishedSessionVersion("u1"), 2);
    assert.equal(await getPublishedSessionVersion("nobody"), null);
  } finally {
    __setRevocationStoreForTests(undefined);
  }
});

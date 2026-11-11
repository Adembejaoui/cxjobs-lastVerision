import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkRateLimitAsync,
  checkRateLimitsAsync,
  createMemoryStore,
  getRateLimitHeaders,
  type RateLimitStore,
} from "../../lib/rate-limit";
import { getClientIp } from "../../lib/utils";

const cfg = { windowMs: 60_000, max: 3 };

test("S7: limit is enforced after max requests and returns Retry-After", async () => {
  const store = createMemoryStore();
  const results = [];
  for (let i = 0; i < 5; i++) results.push(await checkRateLimitAsync("login:1.2.3.4", cfg, store));
  assert.deepEqual(results.map((r) => r.allowed), [true, true, true, false, false]);
  const headers = getRateLimitHeaders(results[4]);
  assert.ok(Number(headers["Retry-After"]) >= 1);
  assert.equal(headers["X-RateLimit-Remaining"], "0");
  assert.equal(getRateLimitHeaders(results[0])["Retry-After"], undefined);
});

test("S7: window resets after expiry (fixed window, not extended by traffic)", async () => {
  let now = 0;
  const store = createMemoryStore(() => now);
  for (let i = 0; i < 3; i++) await checkRateLimitAsync("k", cfg, store);
  now = 30_000;
  assert.equal((await checkRateLimitAsync("k", cfg, store)).allowed, false); // still blocked mid-window
  now = 60_001;
  assert.equal((await checkRateLimitAsync("k", cfg, store)).allowed, true);
});

test("S7: concurrent requests cannot exceed the limit", async () => {
  const store = createMemoryStore();
  const results = await Promise.all(Array.from({ length: 50 }, () => checkRateLimitAsync("burst", { windowMs: 60_000, max: 10 }, store)));
  assert.equal(results.filter((r) => r.allowed).length, 10);
});

test("S7: backend failure fails CLOSED by default", async () => {
  const broken: RateLimitStore = { hit: async () => { throw new Error("ECONNRESET"); } };
  const r = await checkRateLimitAsync("ai:u1", cfg, broken);
  assert.equal(r.allowed, false);
  assert.equal(r.degraded, true);
});

test("S7: missing backend (production without Redis) fails closed", async () => {
  const r = await checkRateLimitAsync("ai:u1", cfg, null);
  assert.equal(r.allowed, false);
});

test("S7: explicit failOpen is honoured only when requested", async () => {
  const broken: RateLimitStore = { hit: async () => { throw new Error("down"); } };
  assert.equal((await checkRateLimitAsync("list", { ...cfg, failOpen: true }, broken)).allowed, true);
});

test("S7: multi-key limits — per-account limit holds even when IP rotates", async () => {
  const store = createMemoryStore();
  const decide = (ip: string) =>
    checkRateLimitsAsync(
      [
        { key: `login-ip:${ip}`, config: { windowMs: 60_000, max: 100 } },
        { key: "login-acct:victim", config: { windowMs: 60_000, max: 3 } },
      ],
      store
    );
  const outcomes = [];
  for (let i = 0; i < 6; i++) outcomes.push((await decide(`10.0.0.${i}`)).allowed);
  assert.deepEqual(outcomes, [true, true, true, false, false, false]);
});

function req(headers: Record<string, string>) {
  return new Request("https://cxjobs.app/api/x", { headers });
}

test("S7: forged left-most X-Forwarded-For is ignored off-Vercel (right-most proxy hop used)", () => {
  const prev = process.env.VERCEL;
  delete process.env.VERCEL;
  try {
    assert.equal(getClientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" })), "203.0.113.9");
    assert.equal(getClientIp(req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 198.51.100.7" })), "198.51.100.7");
    // x-real-ip / cf-connecting-ip are not trusted without a known proxy.
    assert.equal(getClientIp(req({ "x-real-ip": "9.9.9.9" })), "unknown");
  } finally {
    if (prev !== undefined) process.env.VERCEL = prev;
  }
});

test("S7: on Vercel the platform-set x-real-ip is used", () => {
  const prev = process.env.VERCEL;
  process.env.VERCEL = "1";
  try {
    assert.equal(getClientIp(req({ "x-real-ip": "203.0.113.5", "x-forwarded-for": "203.0.113.5" })), "203.0.113.5");
  } finally {
    if (prev === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prev;
  }
});

test("S7: garbage header values cannot mint unlimited fresh buckets", () => {
  const prev = process.env.VERCEL;
  delete process.env.VERCEL;
  try {
    for (const v of ["random-1", "<script>", "x".repeat(500), "1.2.3.4:5678abc"]) {
      assert.equal(getClientIp(req({ "x-forwarded-for": v })), "unknown", v);
    }
  } finally {
    if (prev !== undefined) process.env.VERCEL = prev;
  }
});

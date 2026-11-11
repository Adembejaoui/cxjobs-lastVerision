/**
 * Real Auth.js (credentials login, JWT session cookie, jwt callback) plus the
 * password-reset / email-verification routes, end to end against the fake DB.
 * Email goes to a capturing transport; nothing leaves the process.
 */
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { createMemoryRevocationStore } from "../helpers/revocation-store";
import { installMocks, resetState, req, body, db, IDS } from "./harness";

let nextAuth: typeof import("@/app/api/auth/[...nextauth]/route");
let forgot: typeof import("@/app/api/auth/forgot-password/route");
let reset: typeof import("@/app/api/auth/reset-password/route");
let verify: typeof import("@/app/api/auth/verify-email/route");
let register: typeof import("@/app/api/auth/register/route");
let email: typeof import("@/lib/email");
let revocation: typeof import("@/lib/server/session-revocation");

const PASSWORD = "Correct-Horse-1";
let HASH = "";
const outbox: import("@/lib/email").EmailMessage[] = [];
let failDelivery = false;
let waiters: (() => void)[] = [];
let revocationData = new Map<string, { v: string; ex: number }>();
const published = { get: (k: string) => revocationData.get(k)?.v, clear: () => revocationData.clear() };

before(async () => {
  installMocks({ realAuth: true });
  HASH = await bcrypt.hash(PASSWORD, 4);
  nextAuth = await import("@/app/api/auth/[...nextauth]/route");
  forgot = await import("@/app/api/auth/forgot-password/route");
  reset = await import("@/app/api/auth/reset-password/route");
  verify = await import("@/app/api/auth/verify-email/route");
  register = await import("@/app/api/auth/register/route");
  email = await import("@/lib/email");
  revocation = await import("@/lib/server/session-revocation");
});

beforeEach(async () => {
  await resetState();
  for (const u of db.table("user")) u.passwordHash = HASH;
  outbox.length = 0;
  failDelivery = false;
  waiters = [];
  published.clear();
  delete process.env.REQUIRE_EMAIL_VERIFICATION;
  email.__setEmailTransportForTests({
    name: "capture",
    async send(m) {
      outbox.push(m);
      waiters.splice(0).forEach((w) => w());
      return failDelivery ? { ok: false, reason: "provider_error" } : { ok: true, id: "test" };
    },
  });
  const mem = createMemoryRevocationStore();
  revocationData = mem.data;
  revocation.__setRevocationStoreForTests(mem.store);
});
after(() => setTimeout(() => process.exit(0), 50).unref());

/** Deferred (after-response) work: wait for the next email or a short timeout. */
const nextEmail = (ms = 500) =>
  new Promise<boolean>((resolve) => {
    const t = setTimeout(() => resolve(false), ms);
    waiters.push(() => (clearTimeout(t), resolve(true)));
  });
const tokenFrom = (m: { text: string }) => /token=([0-9a-f]{64})/.exec(m.text)![1];

// ─── Cookie-jar helpers for the real Auth.js handlers ─────────────────

class Jar {
  cookies = new Map<string, string>();
  absorb(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i);
      const value = pair.slice(i + 1);
      if (value === "" || /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  hasSession() {
    return [...this.cookies.keys()].some((k) => k.includes("session-token"));
  }
}

async function login(emailAddr: string, password: string, ip = "203.0.113.10") {
  const jar = new Jar();
  const csrfRes = await nextAuth.GET(req("/api/auth/csrf", { ip }));
  jar.absorb(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const form = new URLSearchParams({ email: emailAddr, password, csrfToken, callbackUrl: "https://cxjobs.test/dashboard" });
  const res = await nextAuth.POST(
    req("/api/auth/callback/credentials", {
      method: "POST",
      ip,
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.header() },
      body: form.toString(),
    })
  );
  jar.absorb(res);
  return { jar, res, location: res.headers.get("location") ?? "" };
}

async function session(jar: Jar) {
  const res = await nextAuth.GET(req("/api/auth/session", { headers: { cookie: jar.header() } }));
  jar.absorb(res);
  return res.json();
}

// ─── Login ──────────────────────────────────────────────────────────

test("login: correct credentials yield a session with server-derived role", async () => {
  const { jar } = await login("cand@cx.test", PASSWORD);
  assert.ok(jar.hasSession());
  const s = await session(jar);
  assert.equal(s.user.id, IDS.candUser);
  assert.equal(s.user.role, "CANDIDATE");
});

test("login: wrong password and unknown email look identical", async () => {
  const a = await login("cand@cx.test", "Wrong-Pass-1");
  const b = await login("nobody@cx.test", "Wrong-Pass-1");
  assert.equal(a.jar.hasSession(), false);
  assert.equal(b.jar.hasSession(), false);
  const strip = (l: string) => l.replace(/callbackUrl=[^&]*/, "");
  assert.equal(strip(a.location), strip(b.location));
  assert.match(a.location, /error=CredentialsSignin/);
});

test("login: suspended account cannot log in", async () => {
  db.table("user").find((u) => u.id === IDS.candUser)!.isActive = false;
  assert.equal((await login("cand@cx.test", PASSWORD)).jar.hasSession(), false);
});

test("login: per-account brute-force limit holds across rotating IPs", async () => {
  for (let i = 0; i < 10; i++) await login("cand@cx.test", "Wrong-Pass-1", `198.18.0.${i + 1}`);
  const blocked = await login("cand@cx.test", PASSWORD, "198.18.1.1");
  assert.equal(blocked.jar.hasSession(), false);
  assert.match(blocked.location, /code=rate_limited/);
});

test("login: per-IP limit", async () => {
  for (let i = 0; i < 30; i++) await login(`nobody${i}@cx.test`, "x", "198.18.2.2");
  assert.match((await login("cand@cx.test", PASSWORD, "198.18.2.2")).location, /code=rate_limited/);
});

test("login: REQUIRE_EMAIL_VERIFICATION blocks unverified accounts only", async () => {
  process.env.REQUIRE_EMAIL_VERIFICATION = "true";
  db.table("user").find((u) => u.id === IDS.candUser)!.emailVerified = null;
  const r = await login("cand@cx.test", PASSWORD);
  assert.equal(r.jar.hasSession(), false);
  assert.match(r.location, /code=email_not_verified/);
  assert.ok((await login("cand2@cx.test", PASSWORD)).jar.hasSession());
});

test("session: client update() cannot escalate role", async () => {
  const { jar } = await login("cand@cx.test", PASSWORD);
  const csrf = await (await nextAuth.GET(req("/api/auth/csrf", { headers: { cookie: jar.header() } }))).json();
  const res = await nextAuth.POST(
    req("/api/auth/session", {
      method: "POST",
      headers: { cookie: jar.header(), "content-type": "application/json" },
      body: JSON.stringify({ csrfToken: csrf.csrfToken, data: { user: { role: "ADMIN", isOnboarded: true, id: IDS.adminUser } } }),
    })
  );
  jar.absorb(res);
  const s = await res.json();
  assert.equal(s.user.role, "CANDIDATE");
  assert.equal(s.user.id, IDS.candUser);
});

// ─── Session revocation (route level) ───────────────────────────────

test("revocation: a committed + published sessionVersion bump kills a live session on the next request", async () => {
  const { jar } = await login("a@cx.test", PASSWORD);
  assert.equal((await session(jar)).user.role, "COMPANY");
  // What the admin PATCH route does on suspension (route itself is covered in
  // admin-ai-scrape-cv.routes.test.ts): bump in DB, then publish.
  db.table("user").find((u) => u.id === IDS.coAUser)!.sessionVersion = 1;
  await revocation.publishSessionVersion(IDS.coAUser, 1);
  assert.equal(await session(jar), null);
  assert.equal(jar.hasSession(), false);
});

test("revocation: without Redis, a suspended user is still rejected at the next DB re-read", async () => {
  const { jar } = await login("a@cx.test", PASSWORD);
  revocation.__setRevocationStoreForTests(null); // Redis unavailable
  db.table("user").find((u) => u.id === IDS.coAUser)!.isActive = false;
  // Fresh claims are trusted until the refresh window; a session update
  // forces the re-read immediately.
  const csrf = await (await nextAuth.GET(req("/api/auth/csrf", { headers: { cookie: jar.header() } }))).json();
  const res = await nextAuth.POST(
    req("/api/auth/session", {
      method: "POST",
      headers: { cookie: jar.header(), "content-type": "application/json" },
      body: JSON.stringify({ csrfToken: csrf.csrfToken, data: {} }),
    })
  );
  jar.absorb(res);
  assert.equal(await res.json(), null);
});

// ─── Password reset ─────────────────────────────────────────────────

const forgotReq = (addr: string, ip?: string) =>
  forgot.POST(req("/api/auth/forgot-password", { method: "POST", json: { email: addr }, ip }));
const resetReq = (token: string, password: string) =>
  reset.POST(req("/api/auth/reset-password", { method: "POST", json: { token, password } }));

test("reset: existing and unknown emails get byte-identical responses; only the real one gets mail", async () => {
  const a = await forgotReq("cand@cx.test");
  assert.equal(await nextEmail(), true);
  const b = await forgotReq("nobody@cx.test");
  assert.equal(await nextEmail(200), false);
  assert.equal(a.status, b.status);
  assert.equal(await a.text(), await b.text());
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].to, "cand@cx.test");
  // M1: token travels in the fragment, never in the query string.
  assert.match(outbox[0].text, /https:\/\/cxjobs\.test\/reset-password#token=[0-9a-f]{64}/);
  assert.doesNotMatch(outbox[0].text, /\?token=/);
});

test("reset: DB stores only the token hash", async () => {
  await forgotReq("cand@cx.test");
  await nextEmail();
  const raw = tokenFrom(outbox[0]);
  const rows = db.table("passwordResetToken");
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].token, raw);
  assert.match(String(rows[0].token), /^[0-9a-f]{64}$/);
});

test("reset: full flow — new password works, old fails, token single-use, old sessions revoked", async () => {
  const { jar: oldSession } = await login("cand@cx.test", PASSWORD);
  assert.ok(await session(oldSession));
  await forgotReq("cand@cx.test");
  await nextEmail();
  const token = tokenFrom(outbox[0]);
  const NEW = "Brand-New-Pass-2";
  assert.equal((await resetReq(token, NEW)).status, 200);
  assert.equal((await resetReq(token, "Another-Pass-3")).status, 400); // reuse
  assert.equal(await session(oldSession), null); // revoked
  assert.equal((await login("cand@cx.test", PASSWORD, "203.0.113.20")).jar.hasSession(), false);
  assert.ok((await login("cand@cx.test", NEW, "203.0.113.21")).jar.hasSession());
});

test("reset: expired token rejected; weak password rejected; garbage token rejected", async () => {
  await forgotReq("cand@cx.test");
  await nextEmail();
  const token = tokenFrom(outbox[0]);
  assert.equal((await resetReq(token, "weak")).status, 400);
  db.table("passwordResetToken")[0].expires = new Date(Date.now() - 1000);
  assert.equal((await resetReq(token, "Brand-New-Pass-2")).status, 400);
  assert.equal((await resetReq("not-a-token", "Brand-New-Pass-2")).status, 400);
});

test("reset: provider failure does not change the response and leaves a usable token for retry", async () => {
  failDelivery = true;
  const res = await forgotReq("cand@cx.test");
  await nextEmail();
  assert.equal(res.status, 200);
  assert.equal((await body(res)).success, true);
  assert.equal(db.table("passwordResetToken").length, 1);
});

test("reset: per-email limit stops mail-bombing across IPs", async () => {
  for (let i = 0; i < 5; i++) {
    await forgotReq("cand@cx.test", `198.19.0.${i + 1}`);
    await nextEmail();
  }
  const res = await forgotReq("cand@cx.test", "198.19.1.1");
  assert.equal(res.status, 429);
  assert.ok(res.headers.get("retry-after"));
});

// ─── Email verification ─────────────────────────────────────────────

const resend = (addr: string) => verify.PUT(req("/api/auth/verify-email", { method: "PUT", json: { email: addr } }));
const confirm = (token: string) => verify.POST(req("/api/auth/verify-email", { method: "POST", json: { token } }));

test("verify: registration sends a verification email; confirming marks the account verified", async () => {
  const res = await register.POST(
    req("/api/auth/register", { method: "POST", json: { email: "new@cx.test", password: "Strong-Pass-9", name: "New User" } })
  );
  assert.equal(res.status, 201);
  assert.equal(await nextEmail(), true);
  assert.equal(outbox[0].kind, "email_verification");
  assert.equal((await confirm(tokenFrom(outbox[0]))).status, 200);
  assert.ok(db.table("user").find((u) => u.email === "new@cx.test")!.emailVerified instanceof Date);
});

// ─── M7: registration must not reveal whether an address is registered ──

const registerReq = (email: string, ip?: string) =>
  register.POST(
    req("/api/auth/register", { method: "POST", ip, json: { email, password: "Strong-Pass-9", name: "Some Person" } })
  );

test("M7: new and existing addresses get byte-identical status and body", async () => {
  const usersBefore = db.table("user").length;
  const fresh = await registerReq("brand-new@cx.test");
  await nextEmail();
  const existing = await registerReq("cand@cx.test");
  await nextEmail();
  assert.equal(fresh.status, 201);
  assert.equal(existing.status, fresh.status);
  const [a, b] = [await fresh.text(), await existing.text()];
  assert.equal(a, b);
  assert.doesNotMatch(a, /EMAIL_EXISTS|already exists|"data"/);
  // Exactly one account was created, and the existing one was not modified.
  assert.equal(db.table("user").length, usersBefore + 1);
  assert.equal(db.table("user").find((u) => u.id === IDS.candUser)!.passwordHash, HASH);
});

test("M7: the existing owner is notified (no token); the new user gets a verification link", async () => {
  await registerReq("cand@cx.test");
  await nextEmail();
  await registerReq("other-new@cx.test");
  await nextEmail();
  const notice = outbox.find((m) => m.to === "cand@cx.test")!;
  assert.equal(notice.kind, "account_exists");
  assert.doesNotMatch(notice.text, /token=/);
  assert.match(notice.text, /https:\/\/cxjobs\.test\/login/);
  assert.equal(outbox.find((m) => m.to === "other-new@cx.test")!.kind, "email_verification");
});

test("M7: suspended existing account → same response, no notice email", async () => {
  db.table("user").find((u) => u.id === IDS.cand2User)!.isActive = false;
  const res = await registerReq("cand2@cx.test");
  assert.equal(res.status, 201);
  assert.equal(await nextEmail(200), false);
});

test("M7: unique-constraint race maps to the same generic response", async () => {
  const { Prisma } = await import("@/app/generated/prisma/client");
  const delegate = db.client.user as { create: (...a: unknown[]) => Promise<unknown> };
  const original = delegate.create;
  delegate.create = async () => {
    throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`email`)", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["email"] },
    });
  };
  try {
    const raced = await registerReq("racing@cx.test");
    const fresh = await (async () => {
      delegate.create = original;
      return registerReq("not-racing@cx.test");
    })();
    assert.equal(raced.status, 201);
    assert.equal(await raced.text(), await fresh.text());
  } finally {
    delegate.create = original;
  }
});

test("M7: per-address limit bounds notice emails across IPs", async () => {
  for (let i = 0; i < 5; i++) {
    await registerReq("cand@cx.test", `198.18.9.${i + 1}`);
    await nextEmail();
  }
  const res = await registerReq("cand@cx.test", "198.18.9.100");
  assert.equal(res.status, 429);
  assert.ok(res.headers.get("retry-after"));
});

test("M7: a genuinely new registrant can still sign in immediately", async () => {
  await registerReq("signin-after@cx.test");
  assert.ok((await login("signin-after@cx.test", "Strong-Pass-9", "203.0.113.77")).jar.hasSession());
});

test("verify: resend responses are identical for unverified, verified and unknown; only unverified gets mail", async () => {
  db.table("user").find((u) => u.id === IDS.candUser)!.emailVerified = null;
  const a = await resend("cand@cx.test");
  assert.equal(await nextEmail(), true);
  const b = await resend("cand2@cx.test"); // already verified
  const c = await resend("nobody@cx.test");
  assert.equal(await nextEmail(200), false);
  const texts = await Promise.all([a.text(), b.text(), c.text()]);
  assert.equal(new Set(texts).size, 1);
  assert.equal(outbox.length, 1);
});

test("verify: resend revokes the previous link; expired and reused tokens are rejected", async () => {
  db.table("user").find((u) => u.id === IDS.candUser)!.emailVerified = null;
  await resend("cand@cx.test");
  await nextEmail();
  const first = tokenFrom(outbox[0]);
  await resend("cand@cx.test");
  await nextEmail();
  const second = tokenFrom(outbox[1]);
  assert.equal((await confirm(first)).status, 400); // superseded
  db.table("emailVerificationToken")[0].expires = new Date(Date.now() - 1);
  const expired = await confirm(second);
  assert.equal(expired.status, 400);
  assert.equal((await body(expired)).code, "TOKEN_EXPIRED");
});

// ─── Phase 2 (NF-06): email addresses are case-insensitive identities ──

const setEmail = (id: string, addr: string) => (db.table("user").find((u) => u.id === id)!.email = addr);

test("NF-06: login works regardless of the case typed, including legacy mixed-case rows", async () => {
  assert.ok((await login("  CAND@CX.test ", PASSWORD)).jar.hasSession());
  setEmail(IDS.candUser, "Legacy.Case@CX.test"); // row created before normalization
  assert.ok((await login("legacy.case@cx.test", PASSWORD, "203.0.113.31")).jar.hasSession());
});

test("NF-06: registering a case variant of an existing address creates no new account", async () => {
  const before = db.table("user").length;
  const res = await registerReq("Cand@CX.TEST");
  await nextEmail();
  assert.equal(res.status, 201); // same generic answer as any other registration
  assert.equal(db.table("user").length, before);
  assert.equal(outbox.find((m) => m.kind === "account_exists")?.to, "cand@cx.test");
});

test("NF-06: new accounts are stored lowercase", async () => {
  await registerReq("Mixed.New@CX.test");
  await nextEmail();
  assert.ok(db.table("user").some((u) => u.email === "mixed.new@cx.test"));
  assert.ok(!db.table("user").some((u) => u.email === "Mixed.New@CX.test"));
});

test("NF-06: password reset finds the account whatever the case typed", async () => {
  await forgotReq("CAND@cx.TEST");
  assert.equal(await nextEmail(), true);
  assert.equal(outbox[0].to, "cand@cx.test");
});

/**
 * Phase 3 / H3: company invitation tokens, end to end through the real routes:
 * admin creates → link (fragment, never query) → POST validation → register
 * (atomic consume) → reuse/expiry/revocation refused → token never logged.
 */
// The crypto module validates its key at import time: set a format-valid
// all-zero test key BEFORE any route module is loaded.
process.env.INVITATION_TOKEN_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
process.env.NEXT_PUBLIC_APP_URL = "https://cxjobs.test";

import { test, before, beforeEach, after, mock } from "node:test";
import assert from "node:assert/strict";
import { installMocks, resetState, as, req, params, body, db } from "./harness";

let tokens: typeof import("@/app/api/admin/tokens/route");
let link: typeof import("@/app/api/admin/tokens/[id]/link/route");
let validate: typeof import("@/app/api/auth/invitation/route");
let register: typeof import("@/app/api/auth/register/route");
let logger: typeof import("@/lib/logger")["logger"];
let logged: string[] = [];

before(async () => {
  installMocks();
  tokens = await import("@/app/api/admin/tokens/route");
  link = await import("@/app/api/admin/tokens/[id]/link/route");
  validate = await import("@/app/api/auth/invitation/route");
  register = await import("@/app/api/auth/register/route");
  logger = (await import("@/lib/logger")).logger;
  for (const level of ["info", "warn", "error", "debug"] as const) {
    mock.method(logger, level, (message: string, data?: unknown) => {
      logged.push(`${message} ${JSON.stringify(data ?? {}, (_k, v) => (v instanceof Error ? `${v.name}:${v.message}` : v))}`);
    });
  }
});
beforeEach(async () => {
  await resetState();
  logged = [];
});
after(() => setTimeout(() => process.exit(0), 50).unref());

const TOKEN_RE = /[0-9a-f]{64}/;

async function createInvitation(extra: Record<string, unknown> = {}) {
  as("admin");
  const res = await tokens.POST(
    req("/api/admin/tokens", {
      method: "POST",
      json: { companyName: "Gamma Corp", companyEmail: "contact@gamma.test", managerName: "Gina Manager", managerEmail: "gina@gamma.test", durationDays: 7, ...extra },
    })
  );
  assert.equal(res.status, 201, JSON.stringify(await res.clone().json()));
  assert.equal(res.headers.get("cache-control"), "no-store");
  const json = await body(res);
  const url = new URL(json.data.link);
  const token = new URLSearchParams(url.hash.slice(1)).get("token")!;
  return { id: json.data.id as string, url, token, as: (p: Parameters<typeof as>[0]) => as(p) };
}

const validateReq = (token: unknown, ip?: string) =>
  validate.POST(req("/api/auth/invitation", { method: "POST", json: { token }, ip }));
const registerReq = (invitationToken: string, email = "gina@gamma.test") =>
  register.POST(
    req("/api/auth/register", { method: "POST", json: { email, password: "Strong-Pass-9", name: "Gina Manager", invitationToken } })
  );

test("H3: the invitation link carries the token in the fragment, never the query string", async () => {
  const { url, token } = await createInvitation();
  assert.equal(url.pathname, "/onboarding/company");
  assert.equal(url.search, "");
  assert.match(token, /^[0-9a-f]{64}$/);
  // Only the hash is stored, never the raw token.
  const row = db.table("companyInvitation")[0];
  assert.notEqual(row.tokenHash, token);
  assert.ok(!JSON.stringify(row).includes(token));
});

test("H3: the admin 'copy link' route also returns a fragment link, with no-store", async () => {
  const { id, token } = await createInvitation();
  const res = await link.POST(req(`/api/admin/tokens/${id}/link`, { method: "POST" }), params({ id }));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const url = new URL((await body(res)).data.link);
  assert.equal(url.search, "");
  assert.equal(new URLSearchParams(url.hash.slice(1)).get("token"), token);
});

test("H3: POST validation returns only display fields and does not consume the invitation", async () => {
  const { token } = await createInvitation();
  as("anon");
  const res = await validateReq(token);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const json = await body(res);
  assert.deepEqual(Object.keys(json.data).sort(), ["companyName", "managerEmail", "managerName"]);
  assert.equal(json.data.companyName, "Gamma Corp");
  assert.equal(db.table("companyInvitation")[0].status, "PENDING");
});

test("H3: malformed and unknown tokens are rejected with a generic 400", async () => {
  as("anon");
  for (const bad of [undefined, "", "x".repeat(64), "A".repeat(64), "0".repeat(63)]) {
    const res = await validateReq(bad);
    assert.equal(res.status, 400, String(bad));
    assert.equal((await body(res)).code, "INVALID_TOKEN");
  }
  assert.equal((await validateReq("0".repeat(64))).status, 400); // well-formed, unknown
});

test("H3: full flow — register consumes the token once; reuse is refused everywhere", async () => {
  const { token } = await createInvitation();
  as("anon");
  assert.equal((await validateReq(token)).status, 200);
  assert.equal((await registerReq(token)).status, 201);
  const user = db.table("user").find((u) => u.email === "gina@gamma.test")!;
  assert.equal(user.role, "COMPANY");
  assert.equal(db.table("companies").filter((c) => c.userId === user.id).length, 1);
  assert.equal(db.table("companyInvitation")[0].status, "CREATED");

  const again = await validateReq(token);
  assert.equal(again.status, 400);
  assert.equal((await body(again)).code, "TOKEN_USED");
  const second = await registerReq(token, "someone-else@gamma.test");
  assert.equal(second.status, 400);
  assert.ok(!db.table("user").some((u) => u.email === "someone-else@gamma.test"));
});

test("H3: expired and revoked invitations are refused by validation and registration", async () => {
  const expired = await createInvitation({ companyEmail: "e@exp.test", managerEmail: "m@exp.test" });
  db.table("companyInvitation").find((r) => r.id === expired.id)!.expiresAt = new Date(Date.now() - 1000);
  as("anon");
  assert.equal((await body(await validateReq(expired.token))).code, "TOKEN_EXPIRED");
  assert.equal((await registerReq(expired.token, "m@exp.test")).status, 400);

  const revoked = await createInvitation({ companyEmail: "r@rev.test", managerEmail: "m@rev.test" });
  Object.assign(db.table("companyInvitation").find((r) => r.id === revoked.id)!, { revokedAt: new Date() });
  as("anon");
  assert.equal((await body(await validateReq(revoked.token))).code, "TOKEN_REVOKED");
  assert.equal((await registerReq(revoked.token, "m@rev.test")).status, 400);
});

test("H3: validation is rate limited per IP", async () => {
  as("anon");
  const statuses: number[] = [];
  for (let i = 0; i < 21; i++) statuses.push((await validateReq("0".repeat(64), "203.0.113.90")).status);
  assert.equal(statuses.at(-1), 429);
});

test("H3: the raw token never appears in any log line across the whole flow", async () => {
  const { id, token } = await createInvitation();
  await link.POST(req(`/api/admin/tokens/${id}/link`, { method: "POST" }), params({ id }));
  as("anon");
  await validateReq(token);
  await registerReq(token);
  await registerReq(token); // reuse path
  assert.ok(logged.length > 0, "expected the flow to log something");
  for (const line of logged) {
    assert.ok(!line.includes(token), `token leaked in log: ${line.slice(0, 80)}`);
    assert.doesNotMatch(line, /#token=|\?token=/);
  }
  // Sanity: no other 64-hex secret-shaped value is logged either.
  assert.ok(!logged.some((l) => TOKEN_RE.test(l) && !/"(invitationId|adminId|userId)"/.test(l)));
});

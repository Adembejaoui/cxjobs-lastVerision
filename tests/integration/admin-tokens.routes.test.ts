/**
 * Phase 4A / Task 1: authorization and input-safety coverage for the admin
 * invitation-token routes, driven through the REAL handlers:
 *   GET  /api/admin/tokens            list
 *   POST /api/admin/tokens            create
 *   POST /api/admin/tokens/[id]/link  copy link (decrypts a live secret)
 *   POST /api/admin/tokens/[id]/revoke
 *
 * `requireAdmin()` and `getAuthenticatedUser()` are real: only the session
 * lookup (`auth()`) is chosen by the test, and role / isActive are re-read
 * from the (fake) database exactly as in production. The happy-path link
 * format is already covered by invitations.routes.test.ts and is not repeated.
 */
// The crypto module validates its key at import time.
process.env.INVITATION_TOKEN_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
process.env.NEXT_PUBLIC_APP_URL = "https://cxjobs.test";

import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { installMocks, resetState, as, req, params, body, db, IDS, assertNotLeaked, type Persona } from "./harness";

let tokens: typeof import("@/app/api/admin/tokens/route");
let link: typeof import("@/app/api/admin/tokens/[id]/link/route");
let revoke: typeof import("@/app/api/admin/tokens/[id]/revoke/route");

before(async () => {
  installMocks();
  tokens = await import("@/app/api/admin/tokens/route");
  link = await import("@/app/api/admin/tokens/[id]/link/route");
  revoke = await import("@/app/api/admin/tokens/[id]/revoke/route");
});
beforeEach(resetState);
after(() => setTimeout(() => process.exit(0), 50).unref());

const VALID = { companyName: "Gamma Corp", companyEmail: "contact@gamma.test", managerName: "Gina", managerEmail: "gina@gamma.test", durationDays: 7 };

const listReq = (qs = "") => tokens.GET(req(`/api/admin/tokens${qs}`));
const createReq = (json: unknown) => tokens.POST(req("/api/admin/tokens", { method: "POST", json }));
const linkReq = (id: string) => link.POST(req(`/api/admin/tokens/${encodeURIComponent(id)}/link`, { method: "POST" }), params({ id }));
const revokeReq = (id: string) => revoke.POST(req(`/api/admin/tokens/${encodeURIComponent(id)}/revoke`, { method: "POST" }), params({ id }));

async function createAsAdmin(extra: Record<string, unknown> = {}) {
  as("admin");
  const res = await createReq({ ...VALID, ...extra });
  assert.equal(res.status, 201);
  const json = await body(res);
  const token = new URLSearchParams(new URL(json.data.link).hash.slice(1)).get("token")!;
  return { id: json.data.id as string, token };
}

const userRow = (id: string) => db.table("user").find((u) => u.id === id)!;
const invitation = (id: string) => db.table("companyInvitation").find((r) => r.id === id)!;

// ─── Authentication and role ────────────────────────────────────────

test("tokens: every route rejects anonymous callers with 401 and does nothing", async () => {
  const { id } = await createAsAdmin();
  const before = structuredClone(db.table("companyInvitation"));
  as("anon");
  for (const res of [await listReq(), await createReq(VALID), await linkReq(id), await revokeReq(id)]) {
    assert.equal(res.status, 401);
    const json = await body(res);
    assert.equal(json.code, "UNAUTHORIZED");
    assert.equal(json.data, undefined);
  }
  assert.deepEqual(db.table("companyInvitation"), before);
});

test("tokens: CANDIDATE and COMPANY users get 403 on list, create, link and revoke", async () => {
  const { id, token } = await createAsAdmin();
  const before = structuredClone(db.table("companyInvitation"));
  for (const persona of ["candidate", "companyA", "companyOrphan"] satisfies Persona[]) {
    as(persona);
    for (const res of [
      await listReq(),
      await createReq({ ...VALID, companyEmail: `${persona}@x.test` }),
      await linkReq(id),
      await revokeReq(id),
    ]) {
      assert.equal(res.status, 403, persona);
      const json = await body(res);
      assert.equal(json.code, "FORBIDDEN");
      assertNotLeaked(json, token);
      assertNotLeaked(json, "Gamma");
    }
  }
  assert.deepEqual(db.table("companyInvitation"), before, "no invitation created, revoked or altered");
});

test("tokens: the role is taken from the database, not from a stale ADMIN session", async () => {
  const { id } = await createAsAdmin();
  userRow(IDS.adminUser).role = "COMPANY"; // demoted after the session was issued
  as("admin");
  for (const res of [await listReq(), await createReq({ ...VALID, companyEmail: "z@z.test" }), await linkReq(id), await revokeReq(id)]) {
    assert.equal(res.status, 403);
  }
  assert.equal(invitation(id).revokedAt, null);
  assert.equal(db.table("companyInvitation").length, 1);
});

test("tokens: a suspended admin is refused (403) and a deleted admin is unauthenticated (401)", async () => {
  const { id } = await createAsAdmin();
  userRow(IDS.adminUser).isActive = false;
  as("admin");
  for (const res of [await listReq(), await createReq(VALID), await linkReq(id), await revokeReq(id)]) {
    assert.equal(res.status, 403);
    assert.equal((await body(res)).code, "ACCOUNT_DISABLED");
  }
  const users = db.table("user");
  users.splice(users.findIndex((u) => u.id === IDS.adminUser), 1); // session outlives the row
  as("admin");
  assert.equal((await listReq()).status, 401);
});

// ─── List ───────────────────────────────────────────────────────────

test("tokens GET: admin sees invitations but never the token hash, ciphertext or raw token", async () => {
  const { token } = await createAsAdmin();
  const res = await listReq();
  assert.equal(res.status, 200);
  const json = await body(res);
  assert.equal(json.data.length, 1);
  assert.deepEqual(
    Object.keys(json.data[0]).sort(),
    ["companyEmail", "companyName", "createdAt", "expiresAt", "id", "managerEmail", "managerName", "revokedAt", "status", "usedAt"]
  );
  const row = db.table("companyInvitation")[0];
  assertNotLeaked(json, token);
  assertNotLeaked(json, row.tokenHash as string);
  assertNotLeaked(json, row.tokenEncrypted as string);
  assertNotLeaked(json, "#token=");
});

test("tokens GET: invalid status is rejected; pagination is clamped; filters do not error", async () => {
  as("admin");
  for (const s of ["BOGUS", "pending' OR 1=1--", "{}"]) {
    const res = await listReq(`?status=${encodeURIComponent(s)}`);
    assert.equal(res.status, 400, s);
    assert.equal((await body(res)).code, "INVALID_STATUS");
  }
  const res = await listReq("?limit=100000&page=-5&search=%25%27%22");
  assert.equal(res.status, 200);
  const json = await body(res);
  assert.equal(json.pagination.limit, 100);
  assert.equal(json.pagination.page, 1);
  assert.equal((await listReq("?status=pending")).status, 200); // case-normalised
});

// ─── Create ─────────────────────────────────────────────────────────

test("tokens POST: server-controlled fields in the payload are ignored (mass assignment)", async () => {
  as("admin");
  const forgedId = "99999999-0000-4000-8000-000000000001";
  const forgedHash = "f".repeat(64);
  const res = await createReq({
    ...VALID,
    id: forgedId,
    status: "CREATED",
    tokenHash: forgedHash,
    tokenEncrypted: "Zm9yZ2Vk",
    usedAt: new Date().toISOString(),
    revokedAt: new Date().toISOString(),
    expiresAt: "2999-01-01T00:00:00.000Z",
    createdAt: "2000-01-01T00:00:00.000Z",
  });
  assert.equal(res.status, 201);
  const row = db.table("companyInvitation")[0];
  assert.notEqual(row.id, forgedId);
  assert.notEqual(row.tokenHash, forgedHash);
  assert.notEqual(row.tokenEncrypted, "Zm9yZ2Vk");
  assert.equal(row.status, "PENDING");
  assert.equal(row.usedAt, null);
  assert.equal(row.revokedAt, null);
  const days = ((row.expiresAt as Date).getTime() - Date.now()) / 864e5;
  assert.ok(days > 6.9 && days <= 7, `expiresAt derived from durationDays, got ${days}`);
});

test("tokens POST: malformed and invalid payloads are rejected with 400 and create nothing", async () => {
  as("admin");
  const bad: unknown[] = [
    { ...VALID, durationDays: 365 },
    { ...VALID, durationDays: "7" },
    { ...VALID, durationDays: -7 },
    { ...VALID, companyEmail: "not-an-email" },
    { ...VALID, companyEmail: undefined },
    { ...VALID, companyName: "x".repeat(201) },
    { ...VALID, managerEmail: "a@b.c".padStart(300, "a") },
    [VALID],
    null,
  ]; // 9 + the raw-JSON case below = 10, the per-admin create limit (checked before validation)
  for (const payload of bad) {
    const res = await createReq(payload);
    assert.equal(res.status, 400, JSON.stringify(payload)?.slice(0, 60));
    assert.equal((await body(res)).success, false);
  }
  const raw = await tokens.POST(
    req("/api/admin/tokens", { method: "POST", body: "{not json", headers: { "content-type": "application/json" } })
  );
  assert.equal(raw.status, 400);
  const json = await body(raw);
  assert.equal(json.code, "BAD_REQUEST");
  assertNotLeaked(json, "SyntaxError");
  assert.equal(db.table("companyInvitation").length, 0);
});

test("tokens POST: an e-mail already owned by a user, or manager == company, is refused (409)", async () => {
  as("admin");
  const r1 = await createReq({ ...VALID, companyEmail: "CAND@cx.test" });
  assert.equal(r1.status, 409);
  const r2 = await createReq({ ...VALID, managerEmail: "Contact@Gamma.test" });
  assert.equal(r2.status, 409);
  assert.equal(db.table("companyInvitation").length, 0);
});

test("tokens POST: creation is rate limited per admin account (10/min), across IPs", async () => {
  as("admin");
  const statuses: number[] = [];
  for (let i = 0; i < 11; i++) statuses.push((await createReq({ ...VALID, companyEmail: `c${i}@gamma.test`, managerEmail: undefined })).status);
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(201));
  assert.equal(statuses[10], 429);
  assert.equal(db.table("companyInvitation").length, 10);
});

// ─── Link ───────────────────────────────────────────────────────────

test("tokens link: invalid IDs are rejected with 400 before any lookup; unknown IDs are 404", async () => {
  as("admin");
  for (const id of ["", "not-a-uuid", "../../users", "' OR 1=1 --", "33333333-0000-4000-8000-0000000000a1x"]) {
    const res = await linkReq(id);
    assert.equal(res.status, 400, id);
    assert.equal((await body(res)).code, "BAD_REQUEST");
  }
  const lookups = db.calls.filter((c) => c.model === "companyInvitation").length;
  assert.equal(lookups, 0, "no DB lookup for a malformed id");
  assert.equal((await linkReq("99999999-0000-4000-8000-000000000001")).status, 404);
});

test("tokens link: no link for revoked, used, expired, consumed or legacy (no ciphertext) invitations", async () => {
  const cases: [string, Record<string, unknown>][] = [
    ["revoked", { revokedAt: new Date() }],
    ["used", { usedAt: new Date() }],
    ["expired", { expiresAt: new Date(Date.now() - 1000) }],
    ["created", { status: "CREATED" }],
    ["in-progress", { status: "IN_PROGRESS" }],
    ["legacy", { tokenEncrypted: null }],
  ];
  for (const [i, [label, patch]] of cases.entries()) {
    const { id, token } = await createAsAdmin({ companyEmail: `l${i}@gamma.test`, managerEmail: undefined });
    Object.assign(invitation(id), patch);
    const res = await linkReq(id);
    assert.equal(res.status, 409, label);
    const json = await body(res);
    assert.equal(json.data, undefined);
    assertNotLeaked(json, token);
  }
});

test("tokens link: a tampered ciphertext gives a generic 500 with no crypto or key details", async () => {
  const { id } = await createAsAdmin();
  invitation(id).tokenEncrypted = Buffer.alloc(40, 7).toString("base64");
  const res = await linkReq(id);
  assert.equal(res.status, 500);
  const json = await body(res);
  assert.equal(json.code, "INTERNAL_ERROR");
  assert.equal(json.error, "Failed to retrieve invitation link");
  for (const needle of ["auth", "decipher", "Unsupported state", "INVITATION_TOKEN_ENCRYPTION_KEY", "at ", "stack"]) {
    assertNotLeaked(json, needle);
  }
});

// ─── Revoke ─────────────────────────────────────────────────────────

test("tokens revoke: admin revokes a pending invitation; the link is then refused; revoke is idempotent", async () => {
  const { id } = await createAsAdmin();
  const res = await revokeReq(id);
  assert.equal(res.status, 200);
  assert.ok(invitation(id).revokedAt instanceof Date);
  assert.equal((await linkReq(id)).status, 409);
  const firstRevokedAt = invitation(id).revokedAt;
  assert.equal((await revokeReq(id)).status, 200);
  assert.equal(invitation(id).revokedAt, firstRevokedAt, "second revoke does not rewrite the timestamp");
});

test("tokens revoke: consumed invitations cannot be revoked; bad and unknown IDs are 400 / 404", async () => {
  const { id } = await createAsAdmin();
  invitation(id).status = "CREATED";
  const res = await revokeReq(id);
  assert.equal(res.status, 409);
  assert.equal(invitation(id).revokedAt, null);
  assert.equal((await revokeReq("nope")).status, 400);
  assert.equal((await revokeReq("99999999-0000-4000-8000-000000000001")).status, 404);
});

// ─── Error disclosure ───────────────────────────────────────────────

test("tokens: a database failure returns a generic 500 with no internal details", async () => {
  const INTERNAL = 'PrismaClientKnownRequestError: relation "company_invitations" does not exist at /var/task/node_modules/.prisma';
  const delegate = db.client.companyInvitation as Record<string, (...a: unknown[]) => Promise<unknown>>;
  const orig = { findMany: delegate.findMany, create: delegate.create, findUnique: delegate.findUnique };
  const boom = async () => {
    throw new Error(INTERNAL);
  };
  delegate.findMany = delegate.create = delegate.findUnique = boom;
  try {
    as("admin");
    const id = "99999999-0000-4000-8000-000000000001";
    for (const res of [await listReq(), await createReq(VALID), await linkReq(id), await revokeReq(id)]) {
      assert.equal(res.status, 500);
      const json = await body(res);
      assert.equal(json.code, "INTERNAL_ERROR");
      for (const needle of ["Prisma", "/var/task", "company_invitations", "stack"]) assertNotLeaked(json, needle);
    }
  } finally {
    Object.assign(delegate, orig);
  }
});

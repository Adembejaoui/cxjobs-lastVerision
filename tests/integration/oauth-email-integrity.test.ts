/**
 * Phase 4A / Task B (H8): Google OAuth and email-address integrity.
 *
 * The OAuth branch is driven through the REAL Auth.js `handleLoginOrRegister`
 * (the exact code `/api/auth/callback/google` runs after Google has returned a
 * profile) with the REAL `@auth/prisma-adapter`, wrapped by our
 * `withEmailIdentityGuards`, over the in-memory fake Prisma. Only the network
 * leg to Google is absent: tests supply the profile Google would return.
 *
 * Also covered: invitation emails (admin tokens) against legacy mixed-case
 * users. Registration / login / reset case handling is covered by the NF-06
 * tests in auth-flows.routes.test.ts and is not duplicated here.
 */
process.env.INVITATION_TOKEN_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
process.env.NEXT_PUBLIC_APP_URL = "https://cxjobs.test";

import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { installMocks, resetState, as, req, body, db, IDS } from "./harness";

type Adapter = import("next-auth/adapters").Adapter;
type HandleLogin = (
  sessionToken: string | undefined,
  profile: Record<string, unknown>,
  account: Record<string, unknown>,
  options: Record<string, unknown>
) => Promise<{ user: { id: string }; isNewUser?: boolean }>;

let handleLoginOrRegister: HandleLogin;
let PrismaAdapter: typeof import("@auth/prisma-adapter").PrismaAdapter;
let guards: typeof import("@/lib/server/auth-adapter");
let tokens: typeof import("@/app/api/admin/tokens/route");

before(async () => {
  installMocks();
  // Not part of @auth/core's public exports; loaded by path so the test runs
  // the very same file next-auth uses (single copy in node_modules).
  const file = path.join(process.cwd(), "node_modules/@auth/core/lib/actions/callback/handle-login.js");
  ({ handleLoginOrRegister } = (await import(pathToFileURL(file).href)) as { handleLoginOrRegister: HandleLogin });
  ({ PrismaAdapter } = await import("@auth/prisma-adapter"));
  guards = await import("@/lib/server/auth-adapter");
  tokens = await import("@/app/api/admin/tokens/route");
});
beforeEach(async () => {
  await resetState();
});
after(() => setTimeout(() => process.exit(0), 50).unref());

const guardedAdapter = (): Adapter =>
  guards.withEmailIdentityGuards(
    PrismaAdapter(db.client as never),
    db.client.user as unknown as import("@/lib/server/auth-adapter").EmailOwnerDb
  );
const stockAdapter = (): Adapter => PrismaAdapter(db.client as never);

/** One Google callback, as Auth.js runs it after the provider round trip. */
function googleSignIn(adapter: Adapter, profile: Record<string, unknown>, sub = String(profile.id ?? "g-1")) {
  const account = { provider: "google", type: "oidc", providerAccountId: sub, access_token: "at", token_type: "bearer" };
  return handleLoginOrRegister(undefined, { id: sub, ...profile }, account, {
    adapter,
    jwt: {},
    events: {},
    session: { strategy: "jwt", generateSessionToken: () => "unused" },
    // Exactly what our Google provider config implies: NO dangerous linking.
    provider: { id: "google", allowDangerousEmailAccountLinking: false, account: (t: unknown) => t },
    cookies: { sessionToken: { name: "authjs.session-token" } },
  });
}

const now = new Date();
function addUser(id: string, email: string, role = "CANDIDATE", extra: Record<string, unknown> = {}) {
  db.table("user").push({
    id, email, role, name: email, isActive: true, isOnboarded: true, emailVerified: null, sessionVersion: 0,
    passwordHash: "$2b$12$hash", image: null, createdAt: now, updatedAt: now, deletedAt: null, ...extra,
  });
}
const usersWith = (email: string) => db.table("user").filter((u) => String(u.email).toLowerCase() === email.toLowerCase());

const LEGACY_ID = "00000000-0000-4000-8000-00000000e9a1";

// ---------------------------------------------------------------------------
// The original risk
// ---------------------------------------------------------------------------

test("root cause: the STOCK PrismaAdapter creates a duplicate account for a legacy mixed-case address", async () => {
  addUser(LEGACY_ID, "Legacy.User@CX.test");
  const before = db.table("user").length;
  const res = await googleSignIn(stockAdapter(), { email: "legacy.user@cx.test", name: "L", image: null });
  // This is the defect the guard fixes: a second, unrelated account.
  assert.equal(res.isNewUser, true);
  assert.notEqual(res.user.id, LEGACY_ID);
  assert.equal(db.table("user").length, before + 1);
  assert.equal(usersWith("legacy.user@cx.test").length, 2);
});

// ---------------------------------------------------------------------------
// Guarded adapter: no duplicates, no linking, no takeover
// ---------------------------------------------------------------------------

test("Google sign-in with a case variant of a legacy account is refused (OAuthAccountNotLinked), nothing created or linked", async () => {
  addUser(LEGACY_ID, "Legacy.User@CX.test");
  const users = db.table("user").length;
  for (const email of ["legacy.user@cx.test", "LEGACY.USER@CX.TEST", "Legacy.User@CX.test"]) {
    await assert.rejects(
      googleSignIn(guardedAdapter(), { email, name: "Attacker", image: null }, `g-${email}`),
      (e: Error) => e.name === "OAuthAccountNotLinked" || /OAuthAccountNotLinked/.test(String((e as { type?: string }).type))
    );
  }
  assert.equal(db.table("user").length, users);
  assert.equal(db.table("account").length, 0, "no OAuth account linked to the existing user");
  const legacy = db.table("user").find((u) => u.id === LEGACY_ID)!;
  assert.equal(legacy.email, "Legacy.User@CX.test", "existing row is never rewritten (no automatic merge)");
});

test("an existing CANDIDATE / COMPANY / ADMIN credentials account is never taken over through Google", async () => {
  // Seeded personas use lowercase addresses (the common case).
  for (const [email, id, role] of [
    ["cand@cx.test", IDS.candUser, "CANDIDATE"],
    ["a@cx.test", IDS.coAUser, "COMPANY"],
    ["admin@cx.test", IDS.adminUser, "ADMIN"],
  ] as const) {
    await assert.rejects(
      googleSignIn(guardedAdapter(), { email: email.toUpperCase(), name: "X", image: null }, `g-${role}`),
      (e: Error) => e.name === "OAuthAccountNotLinked" || /OAuthAccountNotLinked/.test(String((e as { type?: string }).type))
    );
    const row = db.table("user").find((u) => u.id === id)!;
    assert.equal(row.role, role, "role untouched");
  }
  assert.equal(db.table("account").length, 0);
  assert.equal(usersWith("cand@cx.test").length, 1);
  assert.equal(usersWith("a@cx.test").length, 1);
  assert.equal(usersWith("admin@cx.test").length, 1);
});

test("ambiguous legacy data (two case variants) still blocks a third account", async () => {
  addUser(LEGACY_ID, "Dup@CX.test");
  addUser("00000000-0000-4000-8000-00000000e9a2", "DUP@cx.test");
  const users = db.table("user").length;
  await assert.rejects(googleSignIn(guardedAdapter(), { email: "dup@cx.test", name: "D", image: null }));
  assert.equal(db.table("user").length, users);
  assert.equal(db.table("account").length, 0);
});

test("ILIKE wildcards in an address cannot make another account look like an owner", async () => {
  // `a_b` as a LIKE pattern matches `axb`; the strict re-check must not.
  addUser(LEGACY_ID, "Axb@CX.test");
  const res = await googleSignIn(guardedAdapter(), { email: "a_b@cx.test", name: "New", image: null });
  assert.equal(res.isNewUser, true);
  assert.notEqual(res.user.id, LEGACY_ID);
});

test("new Google user: stored lowercase, CANDIDATE, unverified and not onboarded whatever the profile claims", async () => {
  const res = await googleSignIn(guardedAdapter(), {
    email: "  New.Person@Gmail.COM ",
    name: "New Person",
    image: "https://lh3.googleusercontent.com/a/x",
    // Hostile / misconfigured profile() output must not reach the row.
    role: "ADMIN",
    isOnboarded: true,
    isActive: false,
    emailVerified: new Date(0),
    sessionVersion: 99,
    passwordHash: "x",
  });
  assert.equal(res.isNewUser, true);
  const row = db.table("user").find((u) => u.id === res.user.id)!;
  assert.equal(row.email, "new.person@gmail.com");
  assert.equal(row.role, "CANDIDATE");
  assert.equal(row.isOnboarded, false);
  assert.equal(row.isActive, true);
  assert.equal(row.emailVerified, null, "verification is only recorded later, for a matching verified address");
  assert.equal(row.sessionVersion, 0);
  assert.equal(row.passwordHash, null);
  assert.equal(row.name, "New Person");
  const acct = db.table("account");
  assert.equal(acct.length, 1);
  assert.equal(acct[0].userId, res.user.id);
});

test("a second sign-in with the same Google account reuses the linked user (no duplicate)", async () => {
  const first = await googleSignIn(guardedAdapter(), { email: "repeat@gmail.com", name: "R", image: null }, "g-repeat");
  const second = await googleSignIn(guardedAdapter(), { email: "Repeat@Gmail.com", name: "R", image: null }, "g-repeat");
  assert.equal(second.user.id, first.user.id);
  assert.equal(second.isNewUser, false);
  assert.equal(usersWith("repeat@gmail.com").length, 1);
  assert.equal(db.table("account").length, 1);
});

test("an already-linked COMPANY account keeps working and keeps its role", async () => {
  db.table("account").push({
    id: "acc-1", userId: IDS.coAUser, type: "oidc", provider: "google", providerAccountId: "g-company",
  });
  const res = await googleSignIn(guardedAdapter(), { email: "a@cx.test", name: "A", image: null }, "g-company");
  assert.equal(res.user.id, IDS.coAUser);
  assert.equal(res.isNewUser, false);
  assert.equal(db.table("user").find((u) => u.id === IDS.coAUser)!.role, "COMPANY");
  assert.equal(usersWith("a@cx.test").length, 1);
});

test("a Google account linked to user X signs in as X even if its address now belongs to user Y", async () => {
  // e.g. the Google account's address changed after linking. Identity is the
  // provider account id, never the email, so Y cannot be reached through X's
  // Google account and vice versa.
  db.table("account").push({
    id: "acc-2", userId: IDS.candUser, type: "oidc", provider: "google", providerAccountId: "g-cand",
  });
  const res = await googleSignIn(guardedAdapter(), { email: "admin@cx.test", name: "?", image: null }, "g-cand");
  assert.equal(res.user.id, IDS.candUser);
  assert.equal(db.table("user").find((u) => u.id === IDS.adminUser)!.role, "ADMIN");
});

// ---------------------------------------------------------------------------
// Provider email trust
// ---------------------------------------------------------------------------

test("only a strictly verified Google profile with an address is accepted at signIn", () => {
  const ok = guards.isTrustedGoogleProfile;
  assert.equal(ok({ email: "u@x.io" }, { email_verified: true }), true);
  assert.equal(ok({ email: "u@x.io" }, { email_verified: false }), false);
  assert.equal(ok({ email: "u@x.io" }, { email_verified: "true" }), false, "string 'true' is not a verification");
  assert.equal(ok({ email: "u@x.io" }, {}), false);
  assert.equal(ok({ email: "u@x.io" }, undefined), false);
  assert.equal(ok({ email: "" }, { email_verified: true }), false);
  assert.equal(ok({ email: "  " }, { email_verified: true }), false);
  assert.equal(ok({}, { email_verified: true }), false);
});

test("emailVerified is only trusted for the SAME address (case-insensitive), from Google, when verified", () => {
  const v = guards.providerVerifiesUserEmail;
  const g = { provider: "google" };
  assert.equal(v(g, { email: "User@X.io", email_verified: true }, { email: "user@x.io" }), true);
  assert.equal(v(g, { email: " user@x.io ", email_verified: true }, { email: "USER@x.io" }), true);
  assert.equal(v(g, { email: "other@x.io", email_verified: true }, { email: "user@x.io" }), false, "linked account with a different address");
  assert.equal(v(g, { email: "user@x.io", email_verified: false }, { email: "user@x.io" }), false);
  assert.equal(v(g, { email: "user@x.io", email_verified: "true" }, { email: "user@x.io" }), false);
  assert.equal(v({ provider: "credentials" }, { email: "user@x.io", email_verified: true }, { email: "user@x.io" }), false);
  assert.equal(v(undefined, { email: "user@x.io", email_verified: true }, { email: "user@x.io" }), false);
  assert.equal(v(g, { email_verified: true }, { email: "user@x.io" }), false);
  assert.equal(v(g, { email: "user@x.io", email_verified: true }, undefined), false);
});

test("lib/auth.ts wires the guarded adapter and never enables dangerous email linking", () => {
  const src = readFileSync(path.join(process.cwd(), "lib/auth.ts"), "utf8");
  assert.match(src, /adapter:\s*withEmailIdentityGuards\(/);
  assert.match(src, /providerVerifiedEmail = providerVerifiesUserEmail\(account, profile, user\)/);
  assert.match(src, /isTrustedGoogleProfile\(user, profile\)/);
  assert.doesNotMatch(src, /allowDangerousEmailAccountLinking\s*:/);
});

// ---------------------------------------------------------------------------
// Invitations (admin tokens) and legacy mixed-case users
// ---------------------------------------------------------------------------

test("invitation: a company email held by a legacy mixed-case user is refused (409)", async () => {
  addUser(LEGACY_ID, "Billing@Gamma.test");
  as("admin");
  const res = await tokens.POST(
    req("/api/admin/tokens", { method: "POST", json: { companyName: "Gamma", companyEmail: "billing@gamma.test", durationDays: 7 } })
  );
  assert.equal(res.status, 409);
  assert.equal((await body(res)).code, "COMPANY_EMAIL_IN_USE");
  assert.equal(db.table("companyInvitation").length, 0);
});

test("invitation: emails are stored normalized; manager == company detected across case and whitespace", async () => {
  as("admin");
  const ok = await tokens.POST(
    req("/api/admin/tokens", {
      method: "POST",
      json: { companyName: "Gamma", companyEmail: " Contact@Gamma.TEST ", managerEmail: "Gina@Gamma.test", durationDays: 7 },
    })
  );
  assert.equal(ok.status, 201);
  const row = db.table("companyInvitation")[0];
  assert.equal(row.companyEmail, "contact@gamma.test");
  assert.equal(row.managerEmail, "gina@gamma.test");

  const same = await tokens.POST(
    req("/api/admin/tokens", {
      method: "POST",
      json: { companyName: "Delta", companyEmail: "Boss@Delta.test", managerEmail: " boss@delta.TEST", durationDays: 7 },
    })
  );
  assert.equal(same.status, 409);
});

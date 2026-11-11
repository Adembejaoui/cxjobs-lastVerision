/**
 * Phase 4A / Task 1: authorization, ownership and mass-assignment coverage for
 *   GET/POST /api/profile
 *   POST     /api/onboarding
 * driven through the REAL handlers. `getAuthenticatedUser()`, the zod schemas,
 * the relation-ownership sync, the CV-reference check and the onboarding
 * completion rules are all real; only the session lookup (`auth()`), Prisma
 * (in-memory fake with real `where` semantics and transaction rollback) and
 * the Auth.js `unstable_update` session refresh are replaced.
 */
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { installMocks, resetState, as, req, body, db, IDS, CV_PATH, assertNotLeaked } from "./harness";

let profile: typeof import("@/app/api/profile/route");
let onboarding: typeof import("@/app/api/onboarding/route");

before(async () => {
  installMocks();
  profile = await import("@/app/api/profile/route");
  onboarding = await import("@/app/api/onboarding/route");
});
beforeEach(resetState);
after(() => setTimeout(() => process.exit(0), 50).unref());

const PASSWORD_HASH = "$2b$12$abcdefghijklmnopqrstuuSECRETHASHVALUEdonotleak000000";
const EXP_CAND2 = "66666666-0000-4000-8000-0000000000d2";
const EXP_CAND = "66666666-0000-4000-8000-0000000000d1";
const SKILL_CAND2 = "77777777-0000-4000-8000-0000000000d2";
const SKILL_CAND = "77777777-0000-4000-8000-0000000000d1";

/** Give both candidates relation rows so cross-candidate writes are observable. */
function seedRelations() {
  const exp = (id: string, candidateId: string, title: string) => ({
    id, candidateId, title, company: "Acme", location: "", startDate: new Date("2020-01-01"), endDate: null,
    isCurrent: false, description: "",
  });
  db.table("experience").push(exp(EXP_CAND, IDS.cand, "Mine"), exp(EXP_CAND2, IDS.cand2, "Theirs"));
  db.table("candidateSkill").push(
    { id: SKILL_CAND, candidateId: IDS.cand, name: "Mine", level: null },
    { id: SKILL_CAND2, candidateId: IDS.cand2, name: "Theirs", level: null }
  );
}

const user = (id: string) => db.table("user").find((u) => u.id === id)!;
const candidate = (id: string) => db.table("candidate").find((c) => c.id === id)!;
const company = (id: string) => db.table("companies").find((c) => c.id === id)!;

const getProfile = () => profile.GET();
const postProfile = (json: unknown) => profile.POST(req("/api/profile", { method: "POST", json }));
const postOnboarding = (json: unknown = {}) => onboarding.POST(req("/api/onboarding", { method: "POST", json }));

const REQUIRED = { gender: "Female", dateOfBirth: "1995-05-05" };
const COMPLETE_CANDIDATE = {
  ...REQUIRED, firstName: "Cand", lastName: "One", phone: "+21600000000", location: "Tunis", targetJobRole: "GENERAL",
  skills: [{ name: "Empathy" }],
};
const COMPANY_A = { name: "Alpha", slug: "alpha" };

// ═══ GET /api/profile ════════════════════════════════════════════════

test("profile GET: anonymous 401; suspended 403; not yet onboarded 403", async () => {
  as("anon");
  assert.equal((await getProfile()).status, 401);

  user(IDS.candUser).isActive = false;
  as("candidate");
  const disabled = await getProfile();
  assert.equal(disabled.status, 403);
  assert.equal((await body(disabled)).code, "ACCOUNT_DISABLED");

  user(IDS.candUser).isActive = true;
  user(IDS.candUser).isOnboarded = false; // DB state wins over the session claim (isOnboarded: true)
  const pending = await getProfile();
  assert.equal(pending.status, 403);
  assert.equal((await body(pending)).code, "ONBOARDING_REQUIRED");
});

test("profile GET: returns only the caller's own record and never credential or session fields", async () => {
  seedRelations();
  user(IDS.candUser).passwordHash = PASSWORD_HASH;
  user(IDS.cand2User).passwordHash = PASSWORD_HASH;
  as("candidate");
  const res = await getProfile();
  assert.equal(res.status, 200);
  const json = await body(res);
  assert.equal(json.data.id, IDS.candUser);
  assert.equal(json.data.candidate.id, IDS.cand);
  assert.deepEqual(json.data.candidate.experiences.map((e: { id: string }) => e.id), [EXP_CAND]);
  assert.deepEqual(json.data.candidate.skills.map((s: { id: string }) => s.id), [SKILL_CAND]);
  for (const k of ["passwordHash", "sessionVersion", "isActive", "emailVerified", "deletedAt"]) {
    assert.ok(!(k in json.data), `user.${k} must not be returned`);
  }
  assertNotLeaked(json, PASSWORD_HASH);
  assertNotLeaked(json, IDS.cand2);
  assertNotLeaked(json, "cand2@cx.test");

  as("companyA");
  const co = await body(await getProfile());
  assert.equal(co.data.companies.id, IDS.coA);
  assertNotLeaked(co, IDS.coB);
});

// ═══ POST /api/profile: authentication / role ═══════════════════════

test("profile POST: anonymous 401 and suspended 403, with no write", async () => {
  const snapshot = structuredClone(db.table("candidate"));
  as("anon");
  assert.equal((await postProfile({ ...REQUIRED, firstName: "X" })).status, 401);
  user(IDS.candUser).isActive = false;
  as("candidate");
  const res = await postProfile({ ...REQUIRED, firstName: "X" });
  assert.equal(res.status, 403);
  assert.deepEqual(db.table("candidate"), snapshot);
});

test("profile POST: ADMIN has no profile type (400) and nothing is created", async () => {
  as("admin");
  for (const payload of [{ ...REQUIRED, firstName: "Ad" }, COMPANY_A]) {
    const res = await postProfile(payload);
    assert.equal(res.status, 400);
    assert.equal((await body(res)).code, "INVALID_ROLE");
  }
  assert.ok(!db.table("candidate").some((c) => c.userId === IDS.adminUser));
  assert.ok(!db.table("companies").some((c) => c.userId === IDS.adminUser));
});

test("profile POST: the profile type follows the DB role, not the payload shape", async () => {
  // A candidate sending a company payload: company keys are stripped, no company row appears.
  as("candidate");
  await postProfile({ ...REQUIRED, ...COMPANY_A, slug: "cand-co" });
  assert.ok(!db.table("companies").some((c) => c.userId === IDS.candUser));

  // A company sending a candidate payload fails company validation, no candidate row appears.
  as("companyOrphan");
  const res = await postProfile({ ...COMPLETE_CANDIDATE });
  assert.equal(res.status, 400);
  assert.ok(!db.table("candidate").some((c) => c.userId === IDS.coOrphanUser));
  assert.ok(!db.table("companies").some((c) => c.userId === IDS.coOrphanUser));

  // A stale CANDIDATE session for a user whose DB role is COMPANY goes down the company path.
  user(IDS.candUser).role = "COMPANY";
  as("candidate");
  const stale = await postProfile({ ...REQUIRED, firstName: "Changed" });
  assert.equal(stale.status, 400);
  assert.equal(candidate(IDS.cand).firstName, "Cand");
});

// ═══ POST /api/profile: candidate mass assignment / ownership ═══════

test("profile POST (candidate): server-controlled fields in the payload are ignored", async () => {
  const before2 = structuredClone(candidate(IDS.cand2));
  as("candidate");
  const res = await postProfile({
    ...REQUIRED,
    firstName: "Renamed",
    id: IDS.cand2,
    userId: IDS.cand2User,
    cvParsed: true,
    cvExportCount: 999,
    lastCvExportAt: "2000-01-01T00:00:00.000Z",
    createdAt: "2000-01-01T00:00:00.000Z",
    // user-level privileges smuggled into the profile body
    role: "ADMIN",
    isActive: false,
    isOnboarded: false,
    sessionVersion: 99,
    email: "attacker@evil.test",
  });
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
  const mine = candidate(IDS.cand);
  assert.equal(mine.firstName, "Renamed");
  assert.equal(mine.userId, IDS.candUser);
  assert.notEqual(mine.cvParsed, true);
  assert.notEqual(mine.cvExportCount, 999);
  assert.equal(mine.lastCvExportAt, undefined);
  assert.deepEqual(candidate(IDS.cand2), before2, "the other candidate is untouched");
  const u = user(IDS.candUser);
  assert.equal(u.role, "CANDIDATE");
  assert.equal(u.isActive, true);
  assert.equal(u.sessionVersion, 0);
  assert.equal(u.email, "cand@cx.test");
});

test("profile POST (candidate): a client-supplied isOnboarded cannot complete onboarding", async () => {
  user(IDS.candUser).isOnboarded = false;
  // The shared seed now has phone/location (A1); this test needs them missing.
  candidate(IDS.cand).phone = null;
  candidate(IDS.cand).location = null;
  as("candidate");
  const res = await postProfile({ ...REQUIRED, isOnboarded: true }); // missing phone, location, role, skills
  assert.equal(res.status, 400);
  const json = await body(res);
  assert.equal(json.code, "VALIDATION_ERROR");
  assert.ok(json.details.phone && json.details.skills);
  assert.equal(user(IDS.candUser).isOnboarded, false);
  assert.equal(candidate(IDS.cand).gender, undefined, "the rejected save was rolled back");
});

test("profile POST (candidate): another candidate's experience/skill IDs are rejected and nothing changes", async () => {
  seedRelations();
  const snapshot = {
    exp: structuredClone(db.table("experience")),
    skill: structuredClone(db.table("candidateSkill")),
    cand: structuredClone(candidate(IDS.cand)),
  };
  as("candidate");
  const attempts = [
    { experiences: [{ id: EXP_CAND2, title: "Hijacked", company: "Evil", startDate: "2021-01" }] },
    { skills: [{ id: SKILL_CAND2, name: "Hijacked" }] },
    // own + foreign together: still refused, and the own-row edit is rolled back too
    { firstName: "Partial", skills: [{ id: SKILL_CAND, name: "Edited" }, { id: SKILL_CAND2, name: "Hijacked" }] },
  ];
  for (const extra of attempts) {
    const res = await postProfile({ ...REQUIRED, ...extra });
    assert.equal(res.status, 400);
    assert.equal((await body(res)).code, "INVALID_RELATION_ID");
  }
  assert.deepEqual(db.table("experience"), snapshot.exp);
  assert.deepEqual(db.table("candidateSkill"), snapshot.skill);
  assert.deepEqual(candidate(IDS.cand), snapshot.cand);
});

test("profile POST (candidate): clearing a relation deletes only the caller's own rows", async () => {
  seedRelations();
  as("candidate");
  const res = await postProfile({ ...REQUIRED, skills: [], experiences: [] });
  assert.equal(res.status, 200);
  assert.deepEqual(db.table("candidateSkill").map((s) => s.id), [SKILL_CAND2]);
  assert.deepEqual(db.table("experience").map((e) => e.id), [EXP_CAND2]);
  const created = await postProfile({ ...REQUIRED, skills: [{ name: "New", id: undefined }] });
  assert.equal(created.status, 200);
  const newSkill = db.table("candidateSkill").find((s) => s.name === "New")!;
  assert.equal(newSkill.candidateId, IDS.cand, "server binds new rows to the caller");
});

test("profile POST (candidate): a CV reference to another user's folder or an arbitrary URL is refused", async () => {
  as("candidate");
  const foreign = CV_PATH.replace(IDS.candUser, IDS.cand2User);
  for (const resumeUrl of [
    foreign,
    `https://testproj.supabase.invalid/storage/v1/object/public/cv/${foreign}`,
    "https://evil.test/cv.pdf",
    `../${IDS.cand2User}/x.pdf`,
  ]) {
    const res = await postProfile({ ...REQUIRED, resumeUrl });
    assert.equal(res.status, 400, resumeUrl);
    assert.equal((await body(res)).code, "INVALID_CV_REFERENCE");
  }
  assert.equal(candidate(IDS.cand).resumeUrl, CV_PATH);
});

test("profile POST: malformed payloads are rejected without writing or leaking internals", async () => {
  const snapshot = structuredClone(db.table("candidate"));
  as("candidate");
  const bad: unknown[] = [
    { ...REQUIRED, gender: "male" },
    { ...REQUIRED, dateOfBirth: "not-a-date" },
    { ...REQUIRED, skills: "Empathy" },
    { ...REQUIRED, experiences: [{ title: "" }] },
    { ...REQUIRED, avatarUrl: "javascript:alert(1)" },
    { ...REQUIRED, targetJobRole: "ADMIN'--" },
    { ...REQUIRED, summary: "x".repeat(2001) },
  ];
  for (const payload of bad) {
    const res = await postProfile(payload);
    assert.equal(res.status, 400, JSON.stringify(payload).slice(0, 80));
  }
  // Non-JSON body: refused (currently 500 INTERNAL_ERROR, see the Phase 4A report) with a generic message.
  const raw = await profile.POST(
    req("/api/profile", { method: "POST", body: "{not json", headers: { "content-type": "application/json" } })
  );
  assert.ok(raw.status >= 400);
  const json = await body(raw);
  assert.equal(json.success, false);
  for (const needle of ["SyntaxError", "JSON", "position", "at "]) assertNotLeaked(json, needle);
  assert.deepEqual(db.table("candidate"), snapshot);
});

// ═══ POST /api/profile: company ownership ═══════════════════════════

test("profile POST (company): server-controlled fields are ignored and only the caller's company changes", async () => {
  const beforeB = structuredClone(company(IDS.coB));
  as("companyA");
  const res = await postProfile({
    ...COMPANY_A,
    name: "Alpha Renamed",
    id: IDS.coB,
    userId: IDS.coBUser,
    isVerified: true,
    verifiedAt: "2020-01-01T00:00:00.000Z",
    deletedAt: "2020-01-01T00:00:00.000Z",
  });
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
  const a = company(IDS.coA);
  assert.equal(a.name, "Alpha Renamed");
  assert.equal(a.userId, IDS.coAUser);
  assert.notEqual(a.isVerified, true);
  assert.equal(a.verifiedAt, undefined);
  assert.equal(a.deletedAt, null);
  assert.deepEqual(company(IDS.coB), beforeB);
  assert.equal(db.table("companies").length, 2);
});

test("profile POST (company): another company's slug cannot be taken", async () => {
  const beforeB = structuredClone(company(IDS.coB));
  as("companyA");
  const res = await postProfile({ ...COMPANY_A, slug: "beta" });
  assert.equal(res.status, 400);
  assert.equal((await body(res)).code, "SLUG_TAKEN");
  assert.equal(company(IDS.coA).slug, "alpha");
  assert.deepEqual(company(IDS.coB), beforeB);
});

test("profile POST (company): another company's benefit IDs are rejected; clearing touches only own rows", async () => {
  const snapshot = structuredClone(db.table("companyBenefit"));
  as("companyA");
  for (const benefits of [
    [{ id: IDS.benB1, name: "Hijacked" }],
    [{ id: IDS.benA1, name: "A1 edited" }, { id: IDS.benB1, name: "Hijacked" }],
  ]) {
    const res = await postProfile({ ...COMPANY_A, benefits });
    assert.equal(res.status, 400);
    assert.equal((await body(res)).code, "INVALID_RELATION_ID");
  }
  const dup = await postProfile({ ...COMPANY_A, benefits: [{ id: IDS.benA1, name: "x" }, { id: IDS.benA1, name: "y" }] });
  assert.equal((await body(dup)).code, "DUPLICATE_RELATION_ID");
  assert.deepEqual(db.table("companyBenefit"), snapshot);

  const clear = await postProfile({ ...COMPANY_A, benefits: [] });
  assert.equal(clear.status, 200);
  assert.deepEqual(db.table("companyBenefit").map((b) => b.id), [IDS.benB1]);
});

test("profile POST (company): a company without a profile creates its own, bound to its own user", async () => {
  as("companyOrphan");
  const res = await postProfile({ name: "Orphan Co", slug: "orphan-co", userId: IDS.coAUser });
  assert.equal(res.status, 200);
  const created = db.table("companies").find((c) => c.slug === "orphan-co")!;
  assert.equal(created.userId, IDS.coOrphanUser);
  assert.equal(company(IDS.coA).userId, IDS.coAUser);
});

test("profile POST (company): unsafe URL schemes and malformed values are rejected", async () => {
  const snapshot = structuredClone(company(IDS.coA));
  as("companyA");
  for (const extra of [
    { website: "javascript:alert(1)" },
    { logoUrl: "data:text/html,<script>alert(1)</script>" },
    { culture: [{ title: "t", imageUrl: "javascript:alert(1)" }] },
    { slug: "Alpha Upper" },
    { foundedYear: 3000 },
    { emailCompany: "not-an-email" },
    { benefits: [{ id: "not-a-uuid", name: "x" }] },
  ]) {
    const res = await postProfile({ ...COMPANY_A, ...extra });
    assert.equal(res.status, 400, JSON.stringify(extra));
  }
  assert.deepEqual(company(IDS.coA), snapshot);
});

test("profile: a database failure returns a generic 500 with no internal details", async () => {
  const INTERNAL = 'PrismaClientKnownRequestError: relation "candidates" does not exist at /var/task/node_modules/.prisma';
  const userDelegate = db.client.user as Record<string, (...a: unknown[]) => Promise<unknown>>;
  const candDelegate = db.client.candidate as Record<string, (...a: unknown[]) => Promise<unknown>>;
  const origUser = userDelegate.findUnique;
  const origCand = candDelegate.findUnique;
  candDelegate.findUnique = async () => {
    throw new Error(INTERNAL);
  };
  try {
    as("candidate");
    const post = await postProfile({ ...REQUIRED });
    // GET reads the profile through the same user delegate the auth check uses:
    // fail only the second (profile) read.
    let n = 0;
    userDelegate.findUnique = async (...a: unknown[]) => {
      if (n++ === 0) return origUser(...a);
      throw new Error(INTERNAL);
    };
    const get = await getProfile();
    for (const res of [post, get]) {
      assert.equal(res.status, 500);
      const json = await body(res);
      assert.equal(json.code, "INTERNAL_ERROR");
      for (const needle of ["Prisma", "/var/task", "candidates", "stack"]) assertNotLeaked(json, needle);
    }
  } finally {
    userDelegate.findUnique = origUser;
    candDelegate.findUnique = origCand;
  }
});

// ═══ POST /api/onboarding ════════════════════════════════════════════

function makeCandidateComplete(candidateId: string) {
  Object.assign(candidate(candidateId), {
    gender: "Female", dateOfBirth: new Date("1995-05-05"), phone: "+21600000000", location: "Tunis", targetJobRole: "GENERAL",
  });
  db.table("candidateSkill").push({ id: SKILL_CAND, candidateId, name: "Empathy", level: null });
}

test("onboarding: anonymous 401; session for a missing user 404; suspended 403 (no state change)", async () => {
  as("anon");
  assert.equal((await postOnboarding()).status, 401);

  const users = db.table("user");
  users.splice(users.findIndex((u) => u.id === IDS.cand2User), 1);
  as("candidate2");
  assert.equal((await postOnboarding()).status, 404);

  user(IDS.candUser).isOnboarded = false;
  user(IDS.candUser).isActive = false;
  makeCandidateComplete(IDS.cand);
  as("candidate");
  const res = await postOnboarding();
  assert.equal(res.status, 403);
  assert.equal((await body(res)).code, "ACCOUNT_DISABLED");
  assert.equal(user(IDS.candUser).isOnboarded, false);
});

test("onboarding: already-onboarded users are refused (400 ALREADY_ONBOARDED)", async () => {
  for (const p of ["candidate", "companyA", "admin"] as const) {
    as(p);
    const res = await postOnboarding();
    assert.equal(res.status, 400);
    assert.equal((await body(res)).code, "ALREADY_ONBOARDED");
  }
});

test("onboarding (candidate): incomplete or missing profiles cannot be marked onboarded", async () => {
  user(IDS.candUser).isOnboarded = false;
  as("candidate");
  const incomplete = await postOnboarding();
  assert.equal(incomplete.status, 400);
  const json = await body(incomplete);
  assert.equal(json.code, "VALIDATION_ERROR");
  assert.ok(json.details.gender && json.details.dateOfBirth && json.details.skills);
  assert.equal(user(IDS.candUser).isOnboarded, false);

  db.table("candidate").splice(db.table("candidate").findIndex((c) => c.id === IDS.cand), 1);
  const missing = await postOnboarding();
  assert.equal(missing.status, 400);
  assert.equal((await body(missing)).code, "PROFILE_INCOMPLETE");
  assert.equal(user(IDS.candUser).isOnboarded, false);
});

test("onboarding (candidate): the request body cannot target another user, bypass checks or change the role", async () => {
  user(IDS.candUser).isOnboarded = false;
  user(IDS.cand2User).isOnboarded = false;
  as("candidate");
  const forged = { userId: IDS.cand2User, id: IDS.cand2User, role: "ADMIN", isOnboarded: true, isActive: true, skipValidation: true };
  // Incomplete profile: the payload does not force completion.
  assert.equal((await postOnboarding(forged)).status, 400);
  assert.equal(user(IDS.candUser).isOnboarded, false);

  makeCandidateComplete(IDS.cand);
  const res = await postOnboarding(forged);
  assert.equal(res.status, 200);
  const json = await body(res);
  assert.equal(json.data.id, IDS.candUser);
  assert.deepEqual(Object.keys(json.data).sort(), ["email", "id", "isOnboarded", "name", "role"]);
  assert.equal(user(IDS.candUser).isOnboarded, true);
  assert.equal(user(IDS.candUser).role, "CANDIDATE");
  assert.equal(user(IDS.cand2User).isOnboarded, false, "the other candidate is untouched");
  assert.equal(user(IDS.cand2User).role, "CANDIDATE");
});

test("onboarding (company): requires the caller's own company profile", async () => {
  user(IDS.coOrphanUser).isOnboarded = false;
  as("companyOrphan");
  const res = await postOnboarding({ companyId: IDS.coA });
  assert.equal(res.status, 400);
  assert.equal((await body(res)).code, "PROFILE_INCOMPLETE");
  assert.equal(user(IDS.coOrphanUser).isOnboarded, false);

  user(IDS.coAUser).isOnboarded = false;
  as("companyA");
  assert.equal((await postOnboarding()).status, 200);
  assert.equal(user(IDS.coAUser).isOnboarded, true);
  assert.equal(user(IDS.coOrphanUser).isOnboarded, false);
});

test("onboarding: a database failure returns a generic 500 with no internal details", async () => {
  const INTERNAL = 'PrismaClientKnownRequestError: relation "users" does not exist at /var/task/node_modules/.prisma';
  const delegate = db.client.user as Record<string, (...a: unknown[]) => Promise<unknown>>;
  const orig = delegate.findUnique;
  delegate.findUnique = async () => {
    throw new Error(INTERNAL);
  };
  try {
    as("candidate");
    const res = await postOnboarding();
    assert.equal(res.status, 500);
    const json = await body(res);
    assert.equal(json.code, "INTERNAL_ERROR");
    for (const needle of ["Prisma", "/var/task", "users", "stack"]) assertNotLeaked(json, needle);
  } finally {
    delegate.findUnique = orig;
  }
});

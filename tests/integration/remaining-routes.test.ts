/**
 * Phase 4A / Task A: the 16 API routes no test loaded before this phase.
 *
 * Focus: authentication, role checks, ownership / tenant scoping, privacy of
 * the response, mass assignment and input validation. Real handlers through
 * the shared harness (fake Prisma, chosen session, in-memory rate limiter).
 *
 *   admin:   admin/job-offers, admin/job-offers/[id], admin/overview, admin/users
 *   company: company/benefits, dashboard/company (GET; PUT removed),
 *            dashboard/company/analytics, job-offers/[jobId]/applications
 *   admin:   job-offers/expire
 *   cand.:   candidate/cv/export (GET, POST)
 *   public:  companies/[slug], job-offers/by-slug/[slug], profile/allCompanies,
 *            analytics/web-vitals, analytics/landing-visitor, health
 */
import { test, before, beforeEach, after, mock } from "node:test";
import assert from "node:assert/strict";
import { installMocks, resetState, as, req, params, body, db, IDS, SECRET_NOTE, CV_PATH, assertNotLeaked, type Persona } from "./harness";

let adminJobs: typeof import("@/app/api/admin/job-offers/route");
let adminJob: typeof import("@/app/api/admin/job-offers/[id]/route");
let overview: typeof import("@/app/api/admin/overview/route");
let adminUsers: typeof import("@/app/api/admin/users/route");
let benefits: typeof import("@/app/api/company/benefits/route");
let companyDash: typeof import("@/app/api/dashboard/company/route");
let companyAnalytics: typeof import("@/app/api/dashboard/company/analytics/route");
let jobApps: typeof import("@/app/api/job-offers/[jobId]/applications/route");
let expire: typeof import("@/app/api/job-offers/expire/route");
let cvExport: typeof import("@/app/api/candidate/cv/export/route");
let companyBySlug: typeof import("@/app/api/companies/[slug]/route");
let jobBySlug: typeof import("@/app/api/job-offers/by-slug/[slug]/route");
let allCompanies: typeof import("@/app/api/profile/allCompanies/route");
let webVitals: typeof import("@/app/api/analytics/web-vitals/route");
let landing: typeof import("@/app/api/analytics/landing-visitor/route");
let health: typeof import("@/app/api/health/route");
let logged: string[] = [];

before(async () => {
  installMocks();
  adminJobs = await import("@/app/api/admin/job-offers/route");
  adminJob = await import("@/app/api/admin/job-offers/[id]/route");
  overview = await import("@/app/api/admin/overview/route");
  adminUsers = await import("@/app/api/admin/users/route");
  benefits = await import("@/app/api/company/benefits/route");
  companyDash = await import("@/app/api/dashboard/company/route");
  companyAnalytics = await import("@/app/api/dashboard/company/analytics/route");
  jobApps = await import("@/app/api/job-offers/[jobId]/applications/route");
  expire = await import("@/app/api/job-offers/expire/route");
  cvExport = await import("@/app/api/candidate/cv/export/route");
  companyBySlug = await import("@/app/api/companies/[slug]/route");
  jobBySlug = await import("@/app/api/job-offers/by-slug/[slug]/route");
  allCompanies = await import("@/app/api/profile/allCompanies/route");
  webVitals = await import("@/app/api/analytics/web-vitals/route");
  landing = await import("@/app/api/analytics/landing-visitor/route");
  health = await import("@/app/api/health/route");
  const { logger } = await import("@/lib/logger");
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

const row = (model: string, id: string) => db.table(model).find((r) => r.id === id)!;
const snapshot = (model: string) => JSON.stringify(db.table(model));
const json = (url: string, method: string, payload: unknown) => req(url, { method, json: payload });

// ═══ Admin routes ══════════════════════════════════════════════════════════

const adminCalls = () => [
  ["GET admin/job-offers", () => adminJobs.GET(req("/api/admin/job-offers"))],
  ["PATCH admin/job-offers/[id]", () => adminJob.PATCH(json(`/api/admin/job-offers/${IDS.jobAPub}`, "PATCH", { title: "Hacked title" }), params({ id: IDS.jobAPub }))],
  ["GET admin/overview", () => overview.GET()],
  ["GET admin/users", () => adminUsers.GET(req("/api/admin/users"))],
] as const;

test("admin routes: anonymous 401; CANDIDATE / COMPANY 403; nothing written", async () => {
  const jobs = snapshot("jobOffer");
  for (const persona of ["anon", "candidate", "companyA", "companyOrphan"] as const) {
    as(persona);
    for (const [name, call] of adminCalls()) {
      const res = await call();
      const expected = persona === "anon" ? 401 : 403;
      assert.equal(res.status, expected, `${persona} ${name}`);
      const b = await body(res);
      assert.equal(b.success, false);
      assert.equal(b.data, undefined, `${persona} ${name}: no data`);
    }
  }
  assert.equal(snapshot("jobOffer"), jobs);
});

test("admin routes: a suspended admin is refused (403 ACCOUNT_DISABLED); role is read from the DB", async () => {
  row("user", IDS.adminUser).isActive = false;
  as("admin");
  for (const [name, call] of adminCalls()) {
    const res = await call();
    assert.equal(res.status, 403, name);
    assert.equal((await body(res)).code, "ACCOUNT_DISABLED", name);
  }
  // Stale ADMIN claim, DB role demoted: refused.
  row("user", IDS.adminUser).isActive = true;
  row("user", IDS.adminUser).role = "COMPANY";
  for (const [name, call] of adminCalls()) assert.equal((await call()).status, 403, `stale role ${name}`);
});

test("admin/users: lists only CANDIDATE/COMPANY, never secrets; role=ADMIN filter cannot widen the scope", async () => {
  as("admin");
  for (const url of ["/api/admin/users", "/api/admin/users?role=ADMIN", "/api/admin/users?role=CANDIDATE%27%20OR%201%3D1"]) {
    const res = await adminUsers.GET(req(url));
    assert.equal(res.status, 200, url);
    const b = await body(res);
    assert.ok(Array.isArray(b.data));
    assert.ok(!b.data.some((u: { role: string }) => u.role === "ADMIN"), `${url}: admin listed`);
    for (const u of b.data) {
      for (const k of ["passwordHash", "sessionVersion", "emailVerified", "accounts", "sessions"]) {
        assert.ok(!(k in u), `${url}: ${k} exposed`);
      }
    }
  }
});

test("admin/job-offers/[id] PATCH: server-controlled fields are ignored (no cross-company move), bad input rejected", async () => {
  as("admin");
  const before = { ...row("jobOffer", IDS.jobAPub) };
  const res = await adminJob.PATCH(
    json(`/api/admin/job-offers/${IDS.jobAPub}`, "PATCH", {
      title: "Admin edited title",
      companyId: IDS.coB,
      slug: "stolen-slug",
      deletedAt: new Date().toISOString(),
      views: 999999,
      applicationType: "EXTERNAL",
      externalApplyUrl: "https://evil.example",
      aiGenerated: true,
      id: IDS.jobBPub,
    }),
    params({ id: IDS.jobAPub })
  );
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
  const after = row("jobOffer", IDS.jobAPub);
  assert.equal(after.title, "Admin edited title");
  for (const k of ["companyId", "slug", "deletedAt", "views", "applicationType", "externalApplyUrl", "aiGenerated", "id"]) {
    assert.deepEqual(after[k], before[k], `${k} changed`);
  }
  assert.equal(row("jobOffer", IDS.jobBPub).title, "Beta Agent", "other job untouched");

  const bad = await adminJob.PATCH(
    req(`/api/admin/job-offers/${IDS.jobAPub}`, { method: "PATCH", body: "{not json", headers: { "content-type": "application/json" } }),
    params({ id: IDS.jobAPub })
  );
  assert.equal(bad.status, 400);
  assertNotLeaked(await body(bad), "SyntaxError");

  const onlyForbidden = await adminJob.PATCH(json(`/api/admin/job-offers/${IDS.jobAPub}`, "PATCH", { companyId: IDS.coB }), params({ id: IDS.jobAPub }));
  assert.equal(onlyForbidden.status, 400);

  const missing = await adminJob.PATCH(json("/api/admin/job-offers/x", "PATCH", { title: "Some title here" }), params({ id: "00000000-0000-4000-8000-000000000000" }));
  assert.equal(missing.status, 404);
});

test("admin/job-offers GET: invalid companyId and status filters are rejected (400)", async () => {
  as("admin");
  for (const q of ["companyId=../../users", "companyId=%27%20OR%201%3D1", "status=EVERYTHING"]) {
    const res = await adminJobs.GET(req(`/api/admin/job-offers?${q}`));
    assert.equal(res.status, 400, q);
  }
  const ok = await adminJobs.GET(req(`/api/admin/job-offers?companyId=${IDS.coA}`));
  assert.equal(ok.status, 200);
});

test("admin/overview: admin gets aggregate numbers only, never cached publicly", async () => {
  as("admin");
  const res = await overview.GET();
  assert.equal(res.status, 200);
  assert.match(res.headers.get("cache-control") ?? "", /no-store/);
  const b = await body(res);
  for (const v of Object.values(b.data)) assert.equal(typeof v, "number");
});

// ═══ Company-owned resources ═══════════════════════════════════════════════

test("company/benefits: only COMPANY sessions; each company sees only its own benefits", async () => {
  for (const persona of ["anon", "candidate", "admin"] as const) {
    as(persona);
    assert.equal((await benefits.GET()).status, 401, persona);
  }
  as("companyA");
  const a = await body(await benefits.GET());
  const ids = [...a.data.core, ...a.data.additional].map((b: { id: string }) => b.id).sort();
  assert.deepEqual(ids, [IDS.benA1, IDS.benA2].sort());
  assertNotLeaked(a, IDS.benB1);
  as("companyOrphan");
  assert.equal((await benefits.GET()).status, 404);
});

test("dashboard/company GET: auth and role enforced; data is scoped to the caller's company", async () => {
  as("anon");
  assert.equal((await companyDash.GET()).status, 401);
  for (const persona of ["candidate", "admin"] as const) {
    as(persona);
    assert.equal((await companyDash.GET()).status, 403, persona);
  }
  as("companyB");
  const res = await companyDash.GET();
  assert.equal(res.status, 200);
  const b = await body(res);
  // Company A's jobs and applications must not appear in B's dashboard. (B's
  // own applications, recruiter notes included, are B's data.)
  for (const needle of ["Alpha Secret Draft", IDS.jobADraft, IDS.jobAPub, IDS.coA, IDS.appA, IDS.appCand2]) assertNotLeaked(b, needle);
  assert.ok(JSON.stringify(b).includes(IDS.appB), "B's own application is present (the test is not vacuous)");
});

test("dashboard/company PUT was removed (F-19): no second company write path that replaces all benefits", async () => {
  // Next.js answers 405 for a method the route module does not export.
  assert.equal((companyDash as Record<string, unknown>).PUT, undefined);
  assert.equal(typeof companyDash.GET, "function");
  // The URL-scheme and mass-assignment protections it had are covered on the
  // supported path, POST /api/profile (tests/integration/company-profile-a6.test.ts).
});

test("dashboard/company/analytics: anonymous 401, non-company 403", async () => {
  as("anon");
  assert.equal((await companyAnalytics.GET(req("/api/dashboard/company/analytics"))).status, 401);
  for (const persona of ["candidate", "admin"] as const) {
    as(persona);
    assert.equal((await companyAnalytics.GET(req("/api/dashboard/company/analytics"))).status, 403, persona);
  }
});

test("job-offers/[jobId]/applications: only the owning company; no recruiter notes or CV paths; filters cannot widen scope", async () => {
  const call = (jobId: string, q = "") => jobApps.GET(req(`/api/job-offers/${jobId}/applications${q}`), params({ jobId }));
  as("anon");
  assert.equal((await call(IDS.jobAPub)).status, 401);
  for (const persona of ["companyB", "candidate", "companyOrphan"] as const) {
    as(persona);
    const res = await call(IDS.jobAPub);
    assert.equal(res.status, 403, persona);
    const b = await body(res);
    assert.equal(b.data, undefined);
    assertNotLeaked(b, IDS.appA);
  }

  as("companyA");
  for (const q of ["", "?search=%25", "?search=cand", "?status=NOUVEAU", "?isSaved=true", "?limit=100000&page=-1"]) {
    const res = await call(IDS.jobAPub, q);
    assert.equal(res.status, 200, q);
    const b = await body(res);
    const ids = b.data.map((a: { id: string }) => a.id);
    assert.ok(!ids.includes(IDS.appB), `${q}: another company's application listed`);
    assert.ok(ids.every((id: string) => ([IDS.appA, IDS.appCand2] as string[]).includes(id)), q);
    assertNotLeaked(b, SECRET_NOTE);
    assertNotLeaked(b, CV_PATH);
    assert.ok(b.pagination.limit <= 100, "limit clamped");
  }

  row("jobOffer", IDS.jobAPub).deletedAt = new Date();
  assert.equal((await call(IDS.jobAPub)).status, 404, "deleted job");
  assert.equal((await call("00000000-0000-4000-8000-000000000000")).status, 404, "unknown job");
});

test("job-offers/expire: admin only; closes only expired PUBLISHED jobs", async () => {
  const past = new Date(Date.now() - 864e5);
  row("jobOffer", IDS.jobAPub).expiresAt = past;
  row("jobOffer", IDS.jobBDraft).expiresAt = past;
  const jobs = snapshot("jobOffer");
  for (const persona of ["anon", "candidate", "companyA"] as const) {
    as(persona);
    const res = await expire.POST();
    assert.equal(res.status, persona === "anon" ? 401 : 403, persona);
  }
  assert.equal(snapshot("jobOffer"), jobs, "nothing closed by non-admins");

  as("admin");
  const res = await expire.POST();
  assert.equal(res.status, 200);
  assert.equal((await body(res)).data.closedCount, 1);
  assert.equal(row("jobOffer", IDS.jobAPub).status, "CLOSED");
  assert.equal(row("jobOffer", IDS.jobBDraft).status, "DRAFT", "draft untouched");
  assert.equal(row("jobOffer", IDS.jobBPub).status, "PUBLISHED", "unexpired untouched");
});

// ═══ Candidate CV export ═══════════════════════════════════════════════════

test("candidate/cv/export: candidates only; the claim is per-candidate and enforces the cooldown", async () => {
  for (const id of [IDS.cand, IDS.cand2]) Object.assign(row("candidate", id), { lastCvExportAt: null, cvExportCount: 0 });
  for (const persona of ["anon", "companyA", "admin"] as const) {
    as(persona);
    assert.equal((await cvExport.GET()).status, 401, `${persona} GET`);
    assert.equal((await cvExport.POST()).status, 401, `${persona} POST`);
  }
  as("candidate");
  assert.equal((await cvExport.GET()).status, 200);
  assert.equal((await cvExport.POST()).status, 200);
  const second = await cvExport.POST();
  assert.equal(second.status, 429);
  assert.equal((await body(second)).code, "COOLDOWN_ACTIVE");
  assert.equal(row("candidate", IDS.cand).cvExportCount, 1);
  assert.equal(row("candidate", IDS.cand2).cvExportCount, 0, "other candidate untouched");
  assert.equal(row("candidate", IDS.cand2).lastCvExportAt, null);
});

// ═══ Public routes: no drafts, no private fields ═══════════════════════════

test("companies/[slug]: lists and counts only live jobs; no owner or contact fields", async () => {
  as("anon");
  const res = await companyBySlug.GET(req("/api/companies/alpha"), params({ slug: "alpha" }));
  assert.equal(res.status, 200);
  const b = await body(res);
  assert.equal(b.data._count.jobs, 1);
  assert.deepEqual(b.data.jobs.map((j: { id: string }) => j.id), [IDS.jobAPub]);
  assertNotLeaked(b, "Alpha Secret Draft");
  for (const k of ["userId", "emailCompany", "deletedAt", "isVerified"]) assert.ok(!(k in b.data), k);
  row("companies", IDS.coA).deletedAt = new Date();
  assert.equal((await companyBySlug.GET(req("/api/companies/alpha"), params({ slug: "alpha" }))).status, 404);
});

test("profile/allCompanies: public job counts exclude drafts / deleted / expired (Phase 4A fix); no private fields", async () => {
  row("jobOffer", IDS.jobBPub).expiresAt = new Date(Date.now() - 1000);
  const res = await allCompanies.GET(req("/api/profile/allCompanies"));
  assert.equal(res.status, 200);
  const b = await body(res);
  const byId = Object.fromEntries(b.data.map((c: { id: string; _count: { jobs: number } }) => [c.id, c._count.jobs]));
  assert.equal(byId[IDS.coA], 1, "Alpha: 1 published + 1 draft → 1");
  assert.equal(byId[IDS.coB], 0, "Beta: 1 expired + 1 draft → 0");
  for (const c of b.data) for (const k of ["userId", "emailCompany", "deletedAt"]) assert.ok(!(k in c), k);
});

test("job-offers/by-slug: drafts are invisible to the public and to other companies; owner and admin can read", async () => {
  const draftSlug = String(row("jobOffer", IDS.jobADraft).slug);
  const call = () => jobBySlug.GET(req(`/api/job-offers/by-slug/${draftSlug}`), params({ slug: draftSlug }));
  const expectations: [Persona, number][] = [
    ["anon", 404],
    ["candidate", 404],
    ["companyB", 404],
    ["companyA", 200],
    ["admin", 200],
  ];
  for (const [persona, status] of expectations) {
    as(persona);
    const res = await call();
    assert.equal(res.status, status, persona);
    if (status === 404) assertNotLeaked(await body(res), "Alpha Secret Draft");
  }
  as("anon");
  const pubSlug = String(row("jobOffer", IDS.jobAPub).slug);
  const pub = await jobBySlug.GET(req(`/api/job-offers/by-slug/${pubSlug}`), params({ slug: pubSlug }));
  assert.equal(pub.status, 200);
  assertNotLeaked(await body(pub), SECRET_NOTE);
});

test("analytics/web-vitals: strict payload shape (Phase 4A fix); attacker strings never reach the logs", async () => {
  const ok = await webVitals.POST(json("/api/analytics/web-vitals", "POST", {
    name: "LCP", value: 1234.5, rating: "good", delta: 12, id: "v4-1700000000000-123", page: "/jobs", timestamp: Date.now(),
  }));
  assert.equal(ok.status, 200);

  const INJECT = "INJECTED\nFAKE LOG LINE admin=true";
  for (const payload of [
    { name: INJECT, value: 1 },
    { name: "LCP", value: "1" },
    { name: "LCP", value: 1, page: INJECT },
    { name: "LCP", value: 1, page: "https://evil.example/x" },
    { name: "LCP", value: 1, id: "x".repeat(500) },
    { name: "LCP", value: 1, rating: INJECT },
    { name: "LCP", value: 1, extra: INJECT },
    { name: "LCP", value: Number.MAX_VALUE },
    [],
    null,
  ]) {
    const res = await webVitals.POST(json("/api/analytics/web-vitals", "POST", payload));
    assert.equal(res.status, 400, JSON.stringify(payload).slice(0, 80));
  }
  const nonJson = await webVitals.POST(req("/api/analytics/web-vitals", { method: "POST", body: "not json" }));
  assert.equal(nonJson.status, 400);
  assert.ok(!logged.some((l) => l.includes("INJECTED") || l.includes("evil.example")), "attacker text logged");
});

test("analytics/web-vitals: per-IP limit (60/min)", async () => {
  const send = () => webVitals.POST(req("/api/analytics/web-vitals", { method: "POST", ip: "203.0.113.77", json: { name: "CLS", value: 0.01 } }));
  for (let i = 0; i < 60; i++) assert.equal((await send()).status, 200, `request ${i + 1}`);
  assert.equal((await send()).status, 429);
});

test("analytics/landing-visitor: httpOnly visitor cookie, only a hash stored, per-IP limit", async () => {
  const res = await landing.POST(req("/api/analytics/landing-visitor", { method: "POST", ip: "203.0.113.90" }));
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie") ?? "";
  assert.match(cookie, /cx_visitor_id=/);
  assert.match(cookie, /HttpOnly/i);
  const raw = /cx_visitor_id=([^;]+)/.exec(cookie)![1];
  const rows = db.table("landingPageVisitor");
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].visitorHash, raw);
  assert.match(String(rows[0].visitorHash), /^[0-9a-f]{64}$/);
  for (let i = 1; i < 30; i++) await landing.POST(req("/api/analytics/landing-visitor", { method: "POST", ip: "203.0.113.90" }));
  assert.equal((await landing.POST(req("/api/analytics/landing-visitor", { method: "POST", ip: "203.0.113.90" }))).status, 429);
});

test("health: reports a status without exposing errors, hostnames or configuration", async () => {
  const res = await health.GET(req("/api/health", { ip: "203.0.113.120" }));
  assert.ok([200, 503].includes(res.status), String(res.status));
  const b = await body(res);
  assert.ok(["healthy", "degraded", "unhealthy"].includes(b.status));
  const s = JSON.stringify(b);
  for (const needle of ["testproj", "supabase.invalid", "Network access blocked", "at ", "Error:", "SERVICE_ROLE", "DATABASE_URL", "test-service-role"]) {
    assert.ok(!s.includes(needle), `health leaked: ${needle}`);
  }
});

test("health (A4): per-IP limit returns 429; other clients are unaffected", async () => {
  for (let i = 0; i < 30; i++) await health.GET(req("/api/health", { ip: "203.0.113.121" }));
  const limited = await health.GET(req("/api/health", { ip: "203.0.113.121" }));
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get("Retry-After"));
  const other = await health.GET(req("/api/health", { ip: "203.0.113.122" }));
  assert.notEqual(other.status, 429);
});

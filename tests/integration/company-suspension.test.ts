/**
 * Phase 6A / F-04: company suspension enforcement.
 *
 * Suspension is the existing model: the company's single owning user gets
 * `isActive = false` through PATCH /api/admin/users/[id] (which also bumps
 * sessionVersion). Every test suspends through that REAL admin route, then
 * drives the REAL public and company routes (and the real public job page)
 * against the in-memory DB.
 *
 * About sessions: in production a suspended company holds no valid session
 * (sessionVersion revocation, credentials refuse inactive users). The harness
 * keeps the session alive on purpose, to model the window in which a JWT is
 * still accepted (Redis unavailable, ≤ 15 min) and to prove that every
 * company-side write is refused from the DATABASE state, not the session.
 */
import { test, before, beforeEach, after, mock } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { installMocks, resetState, as, req, params, body, db, IDS, cache, assertNotLeaked } from "./harness";

let jobs: typeof import("@/app/api/job-offers/route");
let job: typeof import("@/app/api/job-offers/[jobId]/route");
let bySlug: typeof import("@/app/api/job-offers/by-slug/[slug]/route");
let views: typeof import("@/app/api/job-offers/[jobId]/views/route");
let companyApi: typeof import("@/app/api/companies/[slug]/route");
let allCompanies: typeof import("@/app/api/profile/allCompanies/route");
let applications: typeof import("@/app/api/application/route");
let application: typeof import("@/app/api/application/[id]/route");
let adminUser: typeof import("@/app/api/admin/users/[id]/route");
let adminJob: typeof import("@/app/api/admin/job-offers/[id]/route");
let profile: typeof import("@/app/api/profile/route");
let companyDash: typeof import("@/app/api/dashboard/company/route");
let candidateDash: typeof import("@/app/api/dashboard/candidate/route");
type PageFn = { default: (p: { params: Promise<{ slug: string }> }) => Promise<unknown> };
type JobEl = { props: { job: { id: string }; isHistorical: boolean } };
let jobPage: PageFn;
let previewPage: PageFn;
class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}

class NotFoundSignal extends Error {}

before(async () => {
  installMocks();
  const navigation = {
    namedExports: {
      notFound: () => {
        throw new NotFoundSignal("NEXT_NOT_FOUND");
      },
      redirect: (url: string) => {
        throw new RedirectSignal(url);
      },
      permanentRedirect: (url: string) => {
        throw new RedirectSignal(url);
      },
    },
  };
  for (const s of ["next/navigation", pathToFileURL(require.resolve("next/navigation")).href]) {
    try {
      mock.module(s, navigation);
    } catch (e) {
      if ((e as { code?: string }).code !== "ERR_INVALID_STATE") throw e;
    }
  }
  // The page renders a client component; only its props are inspected.
  const client = path.join(process.cwd(), "app/(public)/jobs/[slug]/job-detail-client.tsx");
  mock.module(pathToFileURL(client).href, { namedExports: { JobDetailClient: () => null } });

  jobs = await import("@/app/api/job-offers/route");
  job = await import("@/app/api/job-offers/[jobId]/route");
  bySlug = await import("@/app/api/job-offers/by-slug/[slug]/route");
  views = await import("@/app/api/job-offers/[jobId]/views/route");
  companyApi = await import("@/app/api/companies/[slug]/route");
  allCompanies = await import("@/app/api/profile/allCompanies/route");
  applications = await import("@/app/api/application/route");
  application = await import("@/app/api/application/[id]/route");
  adminUser = await import("@/app/api/admin/users/[id]/route");
  adminJob = await import("@/app/api/admin/job-offers/[id]/route");
  profile = await import("@/app/api/profile/route");
  companyDash = await import("@/app/api/dashboard/company/route");
  candidateDash = await import("@/app/api/dashboard/candidate/route");
  jobPage = (await import("@/app/(public)/jobs/[slug]/page")) as unknown as PageFn;
  previewPage = (await import("@/app/(public)/jobs/[slug]/preview/page")) as unknown as PageFn;
});
beforeEach(async () => {
  await resetState();
});
after(() => setTimeout(() => process.exit(0), 50).unref());

const row = (model: string, id: string) => db.table(model).find((r) => r.id === id)!;
const json = (url: string, method: string, payload: unknown) => req(url, { method, json: payload });
const slugOf = (jobId: string) => String(row("jobOffer", jobId).slug);

/** Suspend / reactivate company A through the real admin endpoint. */
async function setCompanyAActive(isActive: boolean) {
  as("admin");
  const res = await adminUser.PATCH(json(`/api/admin/users/${IDS.coAUser}`, "PATCH", { isActive }), params({ id: IDS.coAUser }));
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
}
async function listIds(query = "") {
  const res = await jobs.GET(req(`/api/job-offers${query}`));
  assert.equal(res.status, 200);
  const b = await body(res);
  return { ids: b.data.map((j: { id: string }) => j.id) as string[], total: b.pagination.total as number };
}
/** The JobDetailClient element rendered by a page (possibly inside a fragment). */
function findJobElement(node: unknown): JobEl | null {
  if (!node || typeof node !== "object") return null;
  const el = node as { props?: { job?: unknown; children?: unknown } };
  if (el.props?.job) return el as JobEl;
  const children = el.props?.children;
  for (const c of Array.isArray(children) ? children : [children]) {
    const found = findJobElement(c);
    if (found) return found;
  }
  return null;
}
async function render(page: PageFn, slug: string): Promise<JobEl | null | { redirect: string }> {
  try {
    return findJobElement(await page.default({ params: Promise.resolve({ slug }) }));
  } catch (e) {
    if (e instanceof NotFoundSignal) return null;
    if (e instanceof RedirectSignal) return { redirect: e.url };
    throw e;
  }
}
/** Public, cached job page: identical for every visitor (A10). */
async function renderJobPage(slug: string) {
  return (await render(jobPage, slug)) as JobEl | null;
}
/** Signed-in preview: owner, admin or applicant (A10/P5). */
async function renderPreview(slug: string) {
  return render(previewPage, slug);
}
function addPublishedJobForA(id: string, extra: Record<string, unknown> = {}) {
  const base = { ...row("jobOffer", IDS.jobAPub) };
  db.table("jobOffer").push({ ...base, id, slug: `alpha-extra-${id.slice(-4)}`, title: `Alpha Extra ${id.slice(-4)}`, ...extra });
}

// ═══ A. Public job listings ═══════════════════════════════════════════════

test("A: an active company's published job is listed; suspending the company removes all its jobs", async () => {
  as("anon");
  const before = await listIds();
  assert.ok(before.ids.includes(IDS.jobAPub) && before.ids.includes(IDS.jobBPub));

  await setCompanyAActive(false);
  for (const persona of ["anon", "candidate", "companyB"] as const) {
    as(persona);
    const after = await listIds();
    assert.ok(!after.ids.includes(IDS.jobAPub), `${persona}: suspended company's job listed`);
    assert.ok(after.ids.includes(IDS.jobBPub), `${persona}: active company's job missing`);
    assert.equal(after.total, before.total - 1, `${persona}: total still counts the suspended job`);
  }
});

test("A: no filter, search, pagination or companyId narrowing exposes a suspended company's jobs", async () => {
  addPublishedJobForA("33333333-0000-4000-8000-0000000000a3");
  addPublishedJobForA("33333333-0000-4000-8000-0000000000a4");
  await setCompanyAActive(false);
  as("anon");
  const queries = [
    "?search=Alpha",
    "?search=agent",
    "?location=Tunis",
    `?companyId=${IDS.coA}`,
    `?companyId=${IDS.coA}&status=PUBLISHED`,
    "?status=DRAFT",
    "?contractType=CDI",
    "?employmentType=FULL_TIME",
    "?activityType=CUSTOMER_SERVICE",
    "?sort=newest",
    ...[1, 2, 3, 4, 5].map((p) => `?limit=1&page=${p}`),
  ];
  for (const q of queries) {
    const { ids } = await listIds(q);
    for (const id of ids) assert.equal(row("jobOffer", id).companyId, IDS.coB, `${q}: job ${id} of a suspended company listed`);
  }
  const companyFiltered = await listIds(`?companyId=${IDS.coA}`);
  assert.equal(companyFiltered.total, 0);
});

test("A: a soft-deleted company's jobs are hidden; drafts and expired jobs stay hidden for active companies", async () => {
  row("companies", IDS.coB).deletedAt = new Date();
  row("jobOffer", IDS.jobAPub).expiresAt = new Date(Date.now() - 1000);
  as("anon");
  const { ids, total } = await listIds();
  assert.deepEqual(ids, []);
  assert.equal(total, 0);
});

// ═══ B. Job detail ══════════════════════════════════════════════════════════

test("B: job detail API: active → 200; suspended, deleted-company, expired → 404 without company data", async () => {
  const get = (persona: Parameters<typeof as>[0], id: string = IDS.jobAPub) => {
    as(persona);
    return job.GET(req(`/api/job-offers/${id}`), params({ jobId: id }));
  };
  assert.equal((await get("anon")).status, 200);

  await setCompanyAActive(false);
  for (const persona of ["anon", "candidate", "companyB"] as const) {
    const res = await get(persona);
    assert.equal(res.status, 404, persona);
    const b = await body(res);
    assertNotLeaked(b, "Alpha");
    assertNotLeaked(b, "suspend");
  }
  // The admin keeps full visibility.
  assert.equal((await get("admin")).status, 200);

  row("companies", IDS.coB).deletedAt = new Date();
  assert.equal((await get("anon", IDS.jobBPub)).status, 404, "deleted company");
});

test("B: an expired job of an active company is 404 on the public detail routes", async () => {
  row("jobOffer", IDS.jobAPub).expiresAt = new Date(Date.now() - 1000);
  as("anon");
  assert.equal((await job.GET(req(`/api/job-offers/${IDS.jobAPub}`), params({ jobId: IDS.jobAPub }))).status, 404);
  const slug = slugOf(IDS.jobAPub);
  assert.equal((await bySlug.GET(req(`/api/job-offers/by-slug/${slug}`), params({ slug }))).status, 404);
  assert.equal(await renderJobPage(slug), null);
});

test("B: by-slug API (used by the apply page) hides a suspended company's job from the public and other companies", async () => {
  await setCompanyAActive(false);
  const slug = slugOf(IDS.jobAPub);
  for (const persona of ["anon", "candidate", "candidate2", "companyB"] as const) {
    as(persona);
    const res = await bySlug.GET(req(`/api/job-offers/by-slug/${slug}`), params({ slug }));
    assert.equal(res.status, 404, persona);
    assertNotLeaked(await body(res), "Alpha");
  }
});

test("B: job page: suspended → notFound for everyone on the public page; an applicant keeps a read-only view via preview", async () => {
  const slug = slugOf(IDS.jobAPub);
  as("anon");
  assert.ok(await renderJobPage(slug), "active company: page renders");

  await setCompanyAActive(false);
  // The public page never reads the session (A10): it is a 404 for everyone.
  for (const persona of ["anon", "companyB", "candidate"] as const) {
    as(persona);
    assert.equal(await renderJobPage(slug), null, persona);
  }

  // `candidate` applied to this job (appA): history stays visible, read-only.
  as("candidate");
  const own = (await renderPreview(slug)) as JobEl;
  assert.ok(own && "props" in own, "applicant can still open the job from their history");
  assert.equal(own.props.job.id, IDS.jobAPub);
  assert.equal(own.props.isHistorical, true, "rendered as historical, so no apply action");

  // Another company never sees it through the preview either.
  as("companyB");
  assert.deepEqual(await renderPreview(slug), { redirect: `/jobs/${slug}` });
  // Anonymous visitors are asked to sign in.
  as("anon");
  const anon = (await renderPreview(slug)) as { redirect: string };
  assert.ok(anon.redirect.startsWith("/login?callbackUrl="), JSON.stringify(anon));

  // `candidate2` never applied to B's job: suspended B → no access.
  as("admin");
  await adminUser.PATCH(json(`/api/admin/users/${IDS.coBUser}`, "PATCH", { isActive: false }), params({ id: IDS.coBUser }));
  as("candidate2");
  assert.equal(await renderJobPage(slugOf(IDS.jobBPub)), null);
  assert.deepEqual(await renderPreview(slugOf(IDS.jobBPub)), { redirect: `/jobs/${slugOf(IDS.jobBPub)}` });
});

test("A10: preview shows the owner its own draft; the admin any job; the public page 404s for the draft", async () => {
  const slug = slugOf(IDS.jobADraft);
  as("companyA");
  const owner = (await renderPreview(slug)) as JobEl;
  assert.equal(owner.props.job.id, IDS.jobADraft);
  assert.equal(owner.props.isHistorical, true, "a draft is not open for applications");
  as("admin");
  assert.equal(((await renderPreview(slug)) as JobEl).props.job.id, IDS.jobADraft);
  as("companyA");
  assert.equal(await renderJobPage(slug), null, "public page: drafts do not exist");
});

test("B: views cannot be recorded on a suspended company's job", async () => {
  await setCompanyAActive(false);
  const before = row("jobOffer", IDS.jobAPub).views;
  as("anon");
  const res = await views.POST(req(`/api/job-offers/${IDS.jobAPub}/views`, { method: "POST" }), params({ jobId: IDS.jobAPub }));
  assert.equal(res.status, 404);
  assert.equal(row("jobOffer", IDS.jobAPub).views, before);
});

test("B: candidate dashboard recommendations exclude suspended companies (and expired jobs)", async () => {
  const recommended = async () => {
    as("candidate");
    const res = await candidateDash.GET();
    assert.equal(res.status, 200);
    return ((await body(res)).data.recommendedJobs as { id: string }[]).map((j) => j.id);
  };
  const before = await recommended();
  assert.ok(before.includes(IDS.jobAPub) && before.includes(IDS.jobBPub), `baseline not vacuous: ${before}`);

  await setCompanyAActive(false);
  row("jobOffer", IDS.jobBPub).expiresAt = new Date(Date.now() - 1000);
  const after = await recommended();
  assert.ok(!after.includes(IDS.jobAPub), "suspended company's job recommended");
  assert.ok(!after.includes(IDS.jobBPub), "expired job recommended");
});

// ═══ C. Company profiles ═══════════════════════════════════════════════════

test("C: company profile API and company listing exclude a suspended company; private fields stay private", async () => {
  as("anon");
  const ok = await companyApi.GET(req("/api/companies/alpha"), params({ slug: "alpha" }));
  assert.equal(ok.status, 200);
  const okBody = await body(ok);
  for (const k of ["userId", "emailCompany", "deletedAt", "users"]) assert.ok(!(k in okBody.data), k);

  await setCompanyAActive(false);
  as("anon");
  const gone = await companyApi.GET(req("/api/companies/alpha"), params({ slug: "alpha" }));
  assert.equal(gone.status, 404);
  assertNotLeaked(await body(gone), "suspend");

  const list = await body(await allCompanies.GET(req("/api/profile/allCompanies")));
  const ids = list.data.map((c: { id: string }) => c.id);
  assert.ok(!ids.includes(IDS.coA), "suspended company listed");
  assert.ok(ids.includes(IDS.coB));
  assert.equal(list.pagination.total, ids.length);
  for (const c of list.data) for (const k of ["userId", "emailCompany", "users", "isActive"]) assert.ok(!(k in c), k);
});

// ═══ D. Applications ═══════════════════════════════════════════════════════

const apply = (jobOfferId: string, extra: Record<string, unknown> = {}) =>
  applications.POST(json("/api/application", "POST", { jobOfferId, coverLetter: "Hello there", ...extra }));

test("D: a candidate can apply to an active company's published job", async () => {
  as("candidate2");
  const res = await apply(IDS.jobBPub);
  assert.equal(res.status, 201, JSON.stringify(await res.clone().json()));
});

test("D: applying to a suspended company's job is refused generically and creates nothing", async () => {
  await setCompanyAActive(false);
  as("admin");
  await adminUser.PATCH(json(`/api/admin/users/${IDS.coBUser}`, "PATCH", { isActive: false }), params({ id: IDS.coBUser }));
  const before = db.table("application").length;
  as("candidate2");
  const res = await apply(IDS.jobBPub);
  assert.equal(res.status, 404);
  const b = await body(res);
  assert.equal(b.code, "NOT_FOUND");
  assertNotLeaked(b, "suspend");
  assert.equal(db.table("application").length, before);
});

test("D: client-supplied company or activity state is ignored", async () => {
  await setCompanyAActive(false);
  // cand2 has no application to A's other published job: add one.
  addPublishedJobForA("33333333-0000-4000-8000-0000000000a5");
  as("candidate2");
  const res = await apply("33333333-0000-4000-8000-0000000000a5", {
    companyActive: true,
    isActive: true,
    company: { isActive: true, deletedAt: null, users: { isActive: true } },
    companyId: IDS.coB,
  });
  assert.equal(res.status, 404);
  assert.ok(!db.table("application").some((a) => a.jobOfferId === "33333333-0000-4000-8000-0000000000a5"));
});

test("D: deleted company, expired job and draft job all refuse applications", async () => {
  as("candidate2");
  row("companies", IDS.coB).deletedAt = new Date();
  assert.equal((await apply(IDS.jobBPub)).status, 404, "deleted company");
  assert.equal((await apply(IDS.jobADraft)).status, 404, "draft");
  addPublishedJobForA("33333333-0000-4000-8000-0000000000a6", { expiresAt: new Date(Date.now() - 1000) });
  assert.equal((await apply("33333333-0000-4000-8000-0000000000a6")).status, 404, "expired");
});

test("D: duplicate-application behaviour is unchanged for active companies", async () => {
  as("candidate"); // already applied to jobAPub (appA)
  const res = await apply(IDS.jobAPub);
  assert.equal(res.status, 409, "F4/A1: a duplicate is a conflict, not a malformed request");
  assert.equal((await body(res)).code, "DUPLICATE_APPLICATION");
});

test("D: existing applications are preserved and stay readable by their owners after suspension", async () => {
  const snapshot = JSON.stringify(db.table("application"));
  await setCompanyAActive(false);
  assert.equal(JSON.stringify(db.table("application")), snapshot, "applications untouched by suspension");
  as("candidate");
  const list = await body(await applications.GET(req("/api/application")));
  const ids = list.data.map((a: { id: string }) => a.id);
  assert.ok(ids.includes(IDS.appA), "application to the suspended company still in history");
  const one = await application.GET(req(`/api/application/${IDS.appA}`), params({ id: IDS.appA }));
  assert.equal(one.status, 200);
  assertNotLeaked(await body(one), "INTERNAL: weak communicator");
});

// ═══ E. Company-side operations ════════════════════════════════════════════

const jobPayload = {
  title: "Support Agent Night Shift",
  description: "Handle inbound customer requests over phone and chat.",
  contractType: "CDI",
  employmentType: "FULL_TIME",
  activityType: "CUSTOMER_SERVICE",
  customLocation: "Tunis",
  status: "PUBLISHED",
};

test("E: an active company can create and publish a job", async () => {
  as("companyA");
  const res = await jobs.POST(json("/api/job-offers", "POST", jobPayload));
  assert.equal(res.status, 201, JSON.stringify(await res.clone().json()));
});

test("E: a suspended company cannot create, publish, edit, or process applications, even with a live session", async () => {
  await setCompanyAActive(false);
  const jobsBefore = JSON.stringify(db.table("jobOffer"));
  const appsBefore = JSON.stringify(db.table("application"));
  const companiesBefore = JSON.stringify(db.table("companies"));
  as("companyA");

  const created = await jobs.POST(json("/api/job-offers", "POST", jobPayload));
  assert.equal(created.status, 403);
  assert.equal((await body(created)).code, "COMPANY_SUSPENDED");

  const published = await job.PUT(json(`/api/job-offers/${IDS.jobADraft}`, "PUT", { status: "PUBLISHED" }), params({ jobId: IDS.jobADraft }));
  assert.equal(published.status, 403);
  assert.equal((await body(published)).code, "COMPANY_SUSPENDED");

  const edited = await job.PUT(json(`/api/job-offers/${IDS.jobAPub}`, "PUT", { title: "Changed while suspended" }), params({ jobId: IDS.jobAPub }));
  assert.equal(edited.status, 403);

  const processed = await application.PUT(json(`/api/application/${IDS.appA}`, "PUT", { status: "ENTRETIEN", notes: "x" }), params({ id: IDS.appA }));
  assert.equal(processed.status, 403);
  assert.equal((await body(processed)).code, "COMPANY_SUSPENDED");

  // PUT /api/dashboard/company was removed (F-19); POST /api/profile is the only company write path.
  assert.equal((companyDash as Record<string, unknown>).PUT, undefined);
  const profilePost = await profile.POST(json("/api/profile", "POST", { name: "Renamed", slug: "alpha" }));
  assert.equal(profilePost.status, 403, "profile POST: existing DB isActive check");

  assert.equal(JSON.stringify(db.table("jobOffer")), jobsBefore, "no job created or changed");
  assert.equal(JSON.stringify(db.table("application")), appsBefore, "no application changed");
  assert.equal(JSON.stringify(db.table("companies")), companiesBefore, "company profile unchanged");
});

test("E: ownership checks are unchanged: an active company still cannot edit another company's job", async () => {
  as("companyB");
  const res = await job.PUT(json(`/api/job-offers/${IDS.jobAPub}`, "PUT", { title: "Hijack" }), params({ jobId: IDS.jobAPub }));
  assert.equal(res.status, 403);
  assert.equal((await body(res)).code, "FORBIDDEN");
  assert.equal(row("jobOffer", IDS.jobAPub).title, "Alpha Agent");
});

test("E: an admin can still act on a suspended company's job (e.g. close it)", async () => {
  await setCompanyAActive(false);
  as("admin");
  const res = await adminJob.PATCH(json(`/api/admin/job-offers/${IDS.jobAPub}`, "PATCH", { status: "CLOSED" }), params({ id: IDS.jobAPub }));
  assert.equal(res.status, 200);
  assert.equal(row("jobOffer", IDS.jobAPub).status, "CLOSED");
});

// ═══ F. Admin suspension / reactivation ═══════════════════════════════════

test("F: admin suspension sets isActive=false and revokes sessions; reactivation restores isActive", async () => {
  const sv = Number(row("user", IDS.coAUser).sessionVersion);
  await setCompanyAActive(false);
  assert.equal(row("user", IDS.coAUser).isActive, false);
  assert.equal(row("user", IDS.coAUser).sessionVersion, sv + 1);
  await setCompanyAActive(true);
  assert.equal(row("user", IDS.coAUser).isActive, true);
});

test("F: a company cannot suspend or reactivate itself or others; a candidate cannot either", async () => {
  for (const persona of ["companyA", "companyB", "candidate"] as const) {
    as(persona);
    for (const target of [IDS.coAUser, IDS.coBUser]) {
      const res = await adminUser.PATCH(json(`/api/admin/users/${target}`, "PATCH", { isActive: false }), params({ id: target }));
      assert.equal(res.status, 403, `${persona} → ${target}`);
    }
  }
  assert.equal(row("user", IDS.coAUser).isActive, true);
  assert.equal(row("user", IDS.coBUser).isActive, true);
});

test("F: company profile updates cannot write suspension state (isActive / deletedAt / users)", async () => {
  as("companyB");
  const forged = { isActive: false, deletedAt: new Date().toISOString(), users: { isActive: false }, user: { isActive: true } };
  const viaProfile = await profile.POST(json("/api/profile", "POST", { name: "Beta", slug: "beta", ...forged }));
  assert.equal(viaProfile.status, 200, JSON.stringify(await viaProfile.clone().json()));
  assert.equal(row("user", IDS.coBUser).isActive, true);
  assert.equal(row("companies", IDS.coB).deletedAt, null);

  // ...and a suspended company cannot reactivate itself through them.
  as("admin");
  await adminUser.PATCH(json(`/api/admin/users/${IDS.coBUser}`, "PATCH", { isActive: false }), params({ id: IDS.coBUser }));
  as("companyB");
  await profile.POST(json("/api/profile", "POST", { name: "Beta", slug: "beta", isActive: true, users: { isActive: true } }));
  assert.equal(row("user", IDS.coBUser).isActive, false);
});

// ═══ G. Cache invalidation and reactivation ════════════════════════════════

test("G: suspension and reactivation invalidate exactly the public job and company caches", async () => {
  await setCompanyAActive(false);
  for (const tag of ["tag:job-offers", "tag:job-offer", "tag:companies"]) {
    assert.ok(cache.revalidated.includes(tag), `missing ${tag} after suspension: ${cache.revalidated.join(",")}`);
  }
  cache.revalidated.length = 0;
  await setCompanyAActive(true);
  assert.ok(cache.revalidated.includes("tag:job-offers") && cache.revalidated.includes("tag:companies"), "after reactivation");
});

test("G: no invalidation when nothing about public visibility changed", async () => {
  as("admin");
  // Name-only edit of a company account; and a candidate suspension.
  await adminUser.PATCH(json(`/api/admin/users/${IDS.coAUser}`, "PATCH", { name: "Alpha Owner" }), params({ id: IDS.coAUser }));
  await adminUser.PATCH(json(`/api/admin/users/${IDS.coAUser}`, "PATCH", { isActive: true }), params({ id: IDS.coAUser }));
  await adminUser.PATCH(json(`/api/admin/users/${IDS.candUser}`, "PATCH", { isActive: false }), params({ id: IDS.candUser }));
  assert.deepEqual(cache.revalidated.filter((c) => c.startsWith("tag:")), []);
});

test("G: reactivation restores only jobs that are themselves eligible (no draft, expired or deleted job reappears)", async () => {
  addPublishedJobForA("33333333-0000-4000-8000-0000000000a7", { expiresAt: new Date(Date.now() - 1000) });
  addPublishedJobForA("33333333-0000-4000-8000-0000000000a8", { deletedAt: new Date() });
  await setCompanyAActive(false);
  await setCompanyAActive(true);
  as("anon");
  const { ids } = await listIds(`?companyId=${IDS.coA}`);
  assert.deepEqual(ids, [IDS.jobAPub], "only the still-eligible published job is back");
  assert.equal(row("jobOffer", IDS.jobADraft).status, "DRAFT", "draft not auto-published");
  assert.equal((await companyApi.GET(req("/api/companies/alpha"), params({ slug: "alpha" }))).status, 200);
  as("candidate2");
  addPublishedJobForA("33333333-0000-4000-8000-0000000000a9");
  assert.equal((await apply("33333333-0000-4000-8000-0000000000a9")).status, 201, "applications accepted again");
});

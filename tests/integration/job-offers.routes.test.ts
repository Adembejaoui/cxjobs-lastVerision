import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { installMocks, resetState, as, req, params, body, db, IDS } from "./harness";

let list: typeof import("@/app/api/job-offers/route");
let one: typeof import("@/app/api/job-offers/[jobId]/route");
let views: typeof import("@/app/api/job-offers/[jobId]/views/route");
before(async () => {
  installMocks();
  list = await import("@/app/api/job-offers/route");
  one = await import("@/app/api/job-offers/[jobId]/route");
  views = await import("@/app/api/job-offers/[jobId]/views/route");
});

beforeEach(resetState);
after(() => setTimeout(() => process.exit(0), 50).unref());

const titles = (json: { data: { title: string }[] }) => json.data.map((j) => j.title).sort();

// ─── GET /api/job-offers ───────────────────────────────────────────────

test("GET list: anonymous sees only PUBLISHED jobs", async () => {
  const res = await list.GET(req("/api/job-offers"));
  assert.equal(res.status, 200);
  assert.deepEqual(titles(await body(res)), ["Alpha Agent", "Beta Agent"]);
});

test("GET list: anonymous ?status=DRAFT does not reveal drafts", async () => {
  const json = await body(await list.GET(req("/api/job-offers?status=DRAFT")));
  assert.deepEqual(titles(json), ["Alpha Agent", "Beta Agent"]);
});

test("GET list: candidate with forged companyId+status sees only public jobs", async () => {
  as("candidate");
  const json = await body(await list.GET(req(`/api/job-offers?companyId=${IDS.coA}&status=DRAFT`)));
  assert.deepEqual(titles(json), ["Alpha Agent"]);
});

test("GET list: company asking for its own companyId sees its drafts and published jobs only", async () => {
  as("companyA");
  const res = await list.GET(req(`/api/job-offers?companyId=${IDS.coA}`));
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(titles(await body(res)), ["Alpha Agent", "Alpha Secret Draft"]);
});

test("GET list (NF-03): company browsing the catalogue sees every company's PUBLISHED jobs", async () => {
  as("companyA");
  const res = await list.GET(req("/api/job-offers?status=PUBLISHED"));
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(titles(await body(res)), ["Alpha Agent", "Beta Agent"]);
});

test("GET list: company with forged companyId of another company gets only that company's PUBLIC jobs", async () => {
  as("companyA");
  const json = await body(await list.GET(req(`/api/job-offers?companyId=${IDS.coB}&status=DRAFT`)));
  assert.deepEqual(titles(json), ["Beta Agent"]);
});

test("GET list: COMPANY user without a profile never gets an unfiltered private list", async () => {
  as("companyOrphan");
  const json = await body(await list.GET(req("/api/job-offers?status=DRAFT")));
  assert.deepEqual(titles(json), ["Alpha Agent", "Beta Agent"]);
});

test("GET list: admin sees all companies' drafts", async () => {
  as("admin");
  const json = await body(await list.GET(req("/api/job-offers?status=DRAFT")));
  assert.deepEqual(titles(json), ["Alpha Secret Draft", "Beta Secret Draft"]);
});

test("GET list: malformed enum filters are rejected with 400", async () => {
  for (const q of ["status=HACKED", "contractType=X", "employmentType=Y", "activityType=Z"]) {
    assert.equal((await list.GET(req(`/api/job-offers?${q}`))).status, 400, q);
  }
});

test("GET list: rate limit returns 429 with Retry-After", async () => {
  let last: Response | undefined;
  for (let i = 0; i < 61; i++) last = await list.GET(req("/api/job-offers", { ip: "203.0.113.50" }));
  assert.equal(last!.status, 429);
  assert.ok(Number(last!.headers.get("retry-after")) >= 1);
});

// ─── POST /api/job-offers ─────────────────────────────────────────────

const newJob = (extra: Record<string, unknown> = {}) => ({ title: "Night Shift Agent", ...extra });

test("POST: unauthenticated → 401, candidate → 403", async () => {
  assert.equal((await list.POST(req("/api/job-offers", { method: "POST", json: newJob() }))).status, 401);
  as("candidate");
  assert.equal((await list.POST(req("/api/job-offers", { method: "POST", json: newJob() }))).status, 403);
});

test("POST: company can create with its own benefits; companyId comes from the session, not the body", async () => {
  as("companyA");
  const res = await list.POST(
    req("/api/job-offers", { method: "POST", json: newJob({ benefitIds: [IDS.benA1, IDS.benA2], companyId: IDS.coB, featured: true }) })
  );
  assert.equal(res.status, 201);
  const created = (await body(res)).data;
  assert.equal(created.companyId, IDS.coA);
  assert.equal(created.featured, false);
  assert.deepEqual(created.benefits.map((b: { benefitId: string }) => b.benefitId).sort(), [IDS.benA1, IDS.benA2].sort());
});

test("POST: another company's benefit, unknown or mixed IDs → 400 and nothing created", async () => {
  as("companyA");
  for (const ids of [[IDS.benB1], ["99999999-0000-4000-8000-000000000000"], [IDS.benA1, IDS.benB1]]) {
    const before = db.table("jobOffer").length;
    const res = await list.POST(req("/api/job-offers", { method: "POST", json: newJob({ benefitIds: ids }) }));
    assert.equal(res.status, 400);
    assert.equal((await body(res)).code, "INVALID_BENEFITS");
    assert.equal(db.table("jobOffer").length, before);
  }
});

test("POST: javascript: externalApplyUrl rejected", async () => {
  as("companyA");
  const res = await list.POST(
    req("/api/job-offers", { method: "POST", json: newJob({ applicationType: "EXTERNAL", externalApplyUrl: "javascript:alert(1)" }) })
  );
  assert.equal(res.status, 400);
});

test("POST: malformed body → 400 without internal details", async () => {
  as("companyA");
  const res = await list.POST(req("/api/job-offers", { method: "POST", json: { title: 42 } }));
  assert.equal(res.status, 400);
  const json = await body(res);
  assert.equal(json.error, "Validation failed");
  assert.doesNotMatch(JSON.stringify(json), /prisma|stack|at \w+ \(/i);
});

// ─── PUT /api/job-offers/[jobId] ──────────────────────────────────────

const put = (jobId: string, json: unknown) =>
  one.PUT(req(`/api/job-offers/${jobId}`, { method: "PUT", json }), params({ jobId }));

test("PUT: owner can update; cross-company update is 403 and changes nothing", async () => {
  as("companyA");
  assert.equal((await put(IDS.jobADraft, { title: "Renamed Draft Job" })).status, 200);
  as("companyB");
  const res = await put(IDS.jobADraft, { title: "Hijacked Title!!" });
  assert.equal(res.status, 403);
  assert.equal(db.table("jobOffer").find((j) => j.id === IDS.jobADraft)!.title, "Renamed Draft Job");
});

test("PUT: cross-tenant benefit attachment rejected and existing benefits untouched", async () => {
  as("companyA");
  assert.equal((await put(IDS.jobAPub, { benefitIds: [IDS.benA1] })).status, 200);
  const res = await put(IDS.jobAPub, { benefitIds: [IDS.benA1, IDS.benB1] });
  assert.equal(res.status, 400);
  assert.equal((await body(res)).code, "INVALID_BENEFITS");
  const links = db.table("jobOfferBenefit").filter((b) => b.jobOfferId === IDS.jobAPub).map((b) => b.benefitId);
  assert.deepEqual(links, [IDS.benA1]);
});

test("PUT: company cannot mass-assign featured/highlight/publishedAt", async () => {
  as("companyA");
  const res = await put(IDS.jobAPub, { featured: true, highlight: true, publishedAt: "2000-01-01T00:00:00Z", title: "Alpha Agent v2" });
  assert.equal(res.status, 200);
  const row = db.table("jobOffer").find((j) => j.id === IDS.jobAPub)!;
  assert.equal(row.featured, false);
  assert.equal(row.highlight, false);
  assert.notEqual((row.publishedAt as Date).getUTCFullYear(), 2000);
});

test("PUT: admin may edit another company's job but only with THAT company's benefits", async () => {
  as("admin");
  assert.equal((await put(IDS.jobBPub, { benefitIds: [IDS.benB1] })).status, 200);
  assert.equal((await put(IDS.jobBPub, { benefitIds: [IDS.benA1] })).status, 400);
});

test("PUT: unauthenticated → 401; unknown job → 404; invalid transition → 400", async () => {
  assert.equal((await put(IDS.jobAPub, { title: "Anonymous edit" })).status, 401);
  as("companyA");
  assert.equal((await put("99999999-0000-4000-8000-000000000000", { title: "Nope nope" })).status, 404);
  assert.equal((await put(IDS.jobAPub, { status: "DRAFT" })).status, 400);
});

// ─── Phase 2 regressions: search semantics & partial updates ───────────

const setJob = (id: string, patch: Record<string, unknown>) =>
  Object.assign(db.table("jobOffer").find((j) => j.id === id)!, patch);

test("GET list (NF-02): activityType filter is applied to the PUBLIC catalogue", async () => {
  setJob(IDS.jobBPub, { activityType: "SALES_LEAD_GENERATION" });
  const json = await body(await list.GET(req("/api/job-offers?activityType=SALES_LEAD_GENERATION")));
  assert.deepEqual(titles(json), ["Beta Agent"]);
  const multi = await body(await list.GET(req("/api/job-offers?activityType=SALES_LEAD_GENERATION,CUSTOMER_SERVICE")));
  assert.deepEqual(titles(multi), ["Alpha Agent", "Beta Agent"]);
});

test("GET list (P1 #1): search AND location must both match", async () => {
  setJob(IDS.jobBPub, { customLocation: "Sousse" });
  db.table("companies").find((c) => c.id === IDS.coB)!.location = "Sousse";
  // "Agent" matches both titles; only Alpha is in Tunis.
  const json = await body(await list.GET(req("/api/job-offers?search=Agent&location=Tunis")));
  assert.deepEqual(titles(json), ["Alpha Agent"]);
  // A keyword that matches nothing must not be "rescued" by the location.
  const none = await body(await list.GET(req("/api/job-offers?search=Nonexistent&location=Tunis")));
  assert.deepEqual(titles(none), []);
});

test("GET list: garbled salary params are ignored instead of producing a 500", async () => {
  const res = await list.GET(req("/api/job-offers?salaryMin=abc&salaryMax=1e9"));
  assert.equal(res.status, 200);
});

test("PUT (NF-01): a status-only update keeps an EXTERNAL job EXTERNAL", async () => {
  setJob(IDS.jobADraft, { applicationType: "EXTERNAL", externalApplyUrl: "https://careers.alpha.test/apply" });
  as("companyA");
  const res = await put(IDS.jobADraft, { status: "PUBLISHED" });
  assert.equal(res.status, 200);
  const row = db.table("jobOffer").find((j) => j.id === IDS.jobADraft)!;
  assert.equal(row.applicationType, "EXTERNAL");
  assert.equal(row.externalApplyUrl, "https://careers.alpha.test/apply");
});

test("PUT: cross-field rules use the merged final state", async () => {
  as("companyA");
  // Switching to EXTERNAL without any URL (stored or submitted) is rejected.
  assert.equal((await put(IDS.jobADraft, { applicationType: "EXTERNAL" })).status, 400);
  // salaryMax below the STORED salaryMin is rejected even when sent alone.
  setJob(IDS.jobADraft, { salaryMin: 2000 });
  const res = await put(IDS.jobADraft, { salaryMax: 1000 });
  assert.equal(res.status, 400);
  assert.ok((await body(res)).details.salaryMax);
});

test("POST: salaryMin greater than salaryMax is rejected", async () => {
  as("companyA");
  const res = await list.POST(
    req("/api/job-offers", { method: "POST", json: { title: "Salary check job", salaryMin: 3000, salaryMax: 1000 } })
  );
  assert.equal(res.status, 400);
});

// ─── NF-07: view counter ──────────────────────────────────────────────

const view = (jobId: string, ip: string) =>
  views.POST(req(`/api/job-offers/${jobId}/views`, { method: "POST", ip }), params({ jobId }));
const viewsOf = (id: string) => db.table("jobOffer").find((j) => j.id === id)!.views as number;

test("NF-07: one counted view per visitor per job; repeats are acknowledged but not counted", async () => {
  assert.equal((await view(IDS.jobAPub, "203.0.113.70")).status, 200);
  assert.equal((await view(IDS.jobAPub, "203.0.113.70")).status, 200);
  assert.equal((await view(IDS.jobAPub, "203.0.113.70")).status, 200);
  assert.equal(viewsOf(IDS.jobAPub), 1);
  await view(IDS.jobAPub, "203.0.113.71");
  assert.equal(viewsOf(IDS.jobAPub), 2);
});

test("NF-07: drafts, deleted and expired jobs cannot be inflated", async () => {
  assert.equal((await view(IDS.jobADraft, "203.0.113.72")).status, 404);
  setJob(IDS.jobBPub, { deletedAt: new Date() });
  assert.equal((await view(IDS.jobBPub, "203.0.113.73")).status, 404);
  setJob(IDS.jobAPub, { expiresAt: new Date(Date.now() - 1000) });
  assert.equal((await view(IDS.jobAPub, "203.0.113.74")).status, 404);
  assert.equal(viewsOf(IDS.jobADraft) + viewsOf(IDS.jobBPub) + viewsOf(IDS.jobAPub), 0);
});

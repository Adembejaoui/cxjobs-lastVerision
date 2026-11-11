/**
 * Launch-plan remediation regressions (8 Nov plan, worked 11 Nov).
 * Real route handlers, in-memory DB (see harness.ts). Covers:
 *   S7  daily per-user AI quota (consume, cap, refund on failure, isolation)
 *   S5  image URLs restricted to this app's storage; social links validated
 *   A1  completed profile enforced by the API; job/duplicate checks first
 *   A2  scheduled expiry: CRON_SECRET auth, idempotent, caches invalidated
 *   A6  partial company saves, old slugs redirect, immediate cache expiry
 *   A7  status workflow, history, notifications, notifications API scoping
 */
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { installMocks, resetState, as, req, params, body, db, ai, cache, IDS, SECRET_NOTE } from "./harness";

let gen: typeof import("@/app/api/job-offers/generate-with-ai/route");
let applications: typeof import("@/app/api/application/route");
let application: typeof import("@/app/api/application/[id]/route");
let profile: typeof import("@/app/api/profile/route");
let companyApi: typeof import("@/app/api/companies/[slug]/route");
let expire: typeof import("@/app/api/job-offers/expire/route");
let notifications: typeof import("@/app/api/notifications/route");

before(async () => {
  installMocks();
  gen = await import("@/app/api/job-offers/generate-with-ai/route");
  applications = await import("@/app/api/application/route");
  application = await import("@/app/api/application/[id]/route");
  profile = await import("@/app/api/profile/route");
  companyApi = await import("@/app/api/companies/[slug]/route");
  expire = await import("@/app/api/job-offers/expire/route");
  notifications = await import("@/app/api/notifications/route");
});
beforeEach(async () => {
  await resetState();
  delete process.env.AI_DAILY_QUOTA;
  delete process.env.CRON_SECRET;
});
after(() => setTimeout(() => process.exit(0), 50).unref());

const row = (model: string, id: string) => db.table(model).find((r) => r.id === id)!;
const OWN_LOGO = "https://hvbbactmgfhecqbetlhg.supabase.co/storage/v1/object/public/logos/u1/1700000000000-logo.webp";

// ═══ S7: daily AI quota ═════════════════════════════════════════════════

const genReq = (ip: string) =>
  gen.POST(req("/api/job-offers/generate-with-ai", { method: "POST", json: { title: "Customer Agent" }, ip }));

test("S7: the daily AI quota caps paid calls per user across IPs; other users are unaffected", async () => {
  process.env.AI_DAILY_QUOTA = "3";
  as("companyA");
  const statuses: number[] = [];
  // Distinct IPs and spaced calls: the per-minute limits are not what trips.
  for (let i = 0; i < 4; i++) statuses.push((await genReq(`192.0.2.${10 + i}`)).status);
  assert.deepEqual(statuses, [200, 200, 200, 429]);
  const denied = await genReq("192.0.2.20");
  const b = await body(denied);
  assert.equal(b.code, "AI_QUOTA_EXCEEDED");
  assert.ok(denied.headers.get("Retry-After"), "tells the client when to retry");
  assert.equal(ai.calls.length, 3, "no AI call beyond the quota");

  as("companyB");
  assert.equal((await genReq("192.0.2.30")).status, 200, "quota is per user");
});

test("S7: a failed AI call does not consume the quota (refund)", async () => {
  process.env.AI_DAILY_QUOTA = "1";
  as("companyA");
  ai.failWith = new Error("provider down");
  assert.equal((await genReq("192.0.2.40")).status, 500);
  ai.failWith = null;
  assert.equal((await genReq("192.0.2.41")).status, 200, "the failed call was refunded");
  assert.equal((await genReq("192.0.2.42")).status, 429);
});

test("S7: invalid input is rejected before the quota is consumed", async () => {
  process.env.AI_DAILY_QUOTA = "1";
  as("companyA");
  const bad = await gen.POST(req("/api/job-offers/generate-with-ai", { method: "POST", json: { title: 5 }, ip: "192.0.2.50" }));
  assert.equal(bad.status, 400);
  assert.equal((await genReq("192.0.2.51")).status, 200);
});

test("S7: concurrent requests cannot overshoot the quota", async () => {
  process.env.AI_DAILY_QUOTA = "2";
  as("companyA");
  const results = await Promise.all([0, 1, 2, 3].map((i) => genReq(`192.0.2.${60 + i}`)));
  assert.equal(results.filter((r) => r.status === 200).length, 2);
  assert.equal(results.filter((r) => r.status === 429).length, 2);
});

// ═══ S5 / A6: company profile ════════════════════════════════════════════

const postProfile = (json: unknown) => profile.POST(req("/api/profile", { method: "POST", json }));

test("S5: image URLs must be this app's storage; javascript:/foreign hosts rejected; nothing written", async () => {
  as("companyA");
  const before = JSON.stringify(row("companies", IDS.coA));
  for (const [field, value] of [
    ["logoUrl", "https://evil.example/pixel.png"],
    ["logoUrl", "https://hvbbactmgfhecqbetlhg.supabase.co.evil.example/storage/v1/object/public/logos/a.png"],
    ["logoUrl", "https://othersupabaseproj.supabase.co/storage/v1/object/public/logos/a.png"],
    ["logoUrl", "http://hvbbactmgfhecqbetlhg.supabase.co/storage/v1/object/public/logos/a.png"],
    ["coverImageUrl", "https://hvbbactmgfhecqbetlhg.supabase.co/storage/v1/object/public/cv/u1/cv.pdf"],
    ["coverImageUrl", "javascript:alert(1)"],
    ["linkedinUrl", "javascript:alert(document.cookie)"],
    ["twitterUrl", "data:text/html,<script>alert(1)</script>"],
    ["website", "vbscript:msgbox(1)"],
  ] as const) {
    const res = await postProfile({ [field]: value });
    assert.equal(res.status, 400, `${field}=${value}`);
  }
  assert.equal(JSON.stringify(row("companies", IDS.coA)), before);

  const ok = await postProfile({ logoUrl: OWN_LOGO, linkedinUrl: "https://www.linkedin.com/company/alpha" });
  assert.equal(ok.status, 200, JSON.stringify(await ok.clone().json()));
  assert.equal(row("companies", IDS.coA).logoUrl, OWN_LOGO);
});

test("A6: saving one field leaves every other field (and benefits + job links) unchanged", async () => {
  as("companyA");
  Object.assign(row("companies", IDS.coA), {
    description: "About Alpha",
    website: "https://alpha.example",
    location: "Tunis",
    companySize: "51-200",
  });
  db.table("jobOfferBenefit").push({ id: "jb-1", jobOfferId: IDS.jobAPub, benefitId: IDS.benA1 });
  const benefitsBefore = JSON.stringify(db.table("companyBenefit"));

  const res = await postProfile({ logoUrl: OWN_LOGO });
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
  const a = row("companies", IDS.coA);
  assert.equal(a.logoUrl, OWN_LOGO);
  assert.equal(a.name, "Alpha");
  assert.equal(a.slug, "alpha");
  assert.equal(a.description, "About Alpha");
  assert.equal(a.website, "https://alpha.example");
  assert.equal(a.location, "Tunis");
  assert.equal(a.companySize, "51-200");
  assert.equal(JSON.stringify(db.table("companyBenefit")), benefitsBefore, "benefits untouched");
  assert.ok(db.table("jobOfferBenefit").some((l) => l.id === "jb-1"), "job benefit link intact");

  // A second save, same story (the F3 done-when: "saving twice leaves benefits intact").
  assert.equal((await postProfile({ description: "Updated" })).status, 200);
  assert.equal(JSON.stringify(db.table("companyBenefit")), benefitsBefore);
  assert.equal(row("companies", IDS.coA).logoUrl, OWN_LOGO);

  // An explicit null still clears a field.
  assert.equal((await postProfile({ website: null })).status, 200);
  assert.equal(row("companies", IDS.coA).website, null);
});

test("A6: a profile save expires the public company and job caches at once (not stale-while-revalidate)", async () => {
  as("companyA");
  assert.equal((await postProfile({ description: "New text" })).status, 200);
  const tags = cache.tagProfiles.filter((t) => ["companies", "job-offers", "job-offer"].includes(t.tag));
  assert.ok(tags.length >= 3, JSON.stringify(cache.tagProfiles));
  for (const t of tags) assert.deepEqual(t.profile, { expire: 0 }, t.tag);
  assert.ok(cache.revalidated.includes("path:/companies/[slug]"));
});

test("A6: creating a profile still requires name and slug", async () => {
  as("companyOrphan");
  const res = await postProfile({ description: "No name" });
  assert.equal(res.status, 400);
  const b = await body(res);
  assert.ok(b.details.name && b.details.slug);
  assert.equal((await postProfile({ name: "Orphan Co", slug: "orphan-co" })).status, 200);
});

test("A6: changing the slug keeps old links working and the old slug cannot be taken by another company", async () => {
  as("companyA");
  assert.equal((await postProfile({ slug: "alpha-cx" })).status, 200);
  assert.equal(row("companies", IDS.coA).slug, "alpha-cx");
  assert.ok(db.table("companySlugRedirect").some((r) => r.slug === "alpha" && r.companyId === IDS.coA));

  // Public API: the old slug redirects (308) to the current one.
  as("anon");
  const old = await companyApi.GET(req("/api/companies/alpha"), params({ slug: "alpha" }));
  assert.equal(old.status, 308);
  assert.ok(old.headers.get("location")?.endsWith("/api/companies/alpha-cx"));
  assert.equal((await companyApi.GET(req("/api/companies/alpha-cx"), params({ slug: "alpha-cx" }))).status, 200);

  // Another company cannot claim the old slug.
  as("companyB");
  const steal = await postProfile({ slug: "alpha" });
  assert.equal(steal.status, 400);
  assert.equal((await body(steal)).code, "SLUG_TAKEN");

  // The company can move back to its old slug; it stops being a redirect.
  as("companyA");
  assert.equal((await postProfile({ slug: "alpha" })).status, 200);
  assert.ok(!db.table("companySlugRedirect").some((r) => r.slug === "alpha"));
  assert.ok(db.table("companySlugRedirect").some((r) => r.slug === "alpha-cx" && r.companyId === IDS.coA));
});

test("A6: an unknown slug with no redirect is still a 404 (no enumeration of suspended companies)", async () => {
  as("anon");
  assert.equal((await companyApi.GET(req("/api/companies/nope"), params({ slug: "nope" }))).status, 404);
});

// ═══ A1 / F4: application eligibility ═══════════════════════════════════

const apply = (jobOfferId: string) =>
  applications.POST(req("/api/application", { method: "POST", json: { jobOfferId, coverLetter: "Hello" } }));

test("A1: an incomplete profile cannot apply (server-side); the answer lists what is missing", async () => {
  Object.assign(row("candidate", IDS.cand2), { phone: null, location: null });
  as("candidate2");
  const res = await apply(IDS.jobBPub);
  assert.equal(res.status, 400);
  const b = await body(res);
  assert.equal(b.code, "PROFILE_INCOMPLETE");
  assert.deepEqual(b.details.missingRequired, ["phone", "location"]);
  assert.equal(db.table("application").filter((a) => a.candidateId === IDS.cand2 && a.jobOfferId === IDS.jobBPub).length, 0);
});

test("A1/F4: a gone job and an existing application take precedence over the profile check", async () => {
  Object.assign(row("candidate", IDS.cand), { phone: null });
  as("candidate");
  assert.equal((await apply(IDS.jobADraft)).status, 404, "draft job: not found, not 'complete your profile'");
  const dup = await apply(IDS.jobAPub);
  assert.equal(dup.status, 409);
  assert.equal((await body(dup)).code, "DUPLICATE_APPLICATION");
});

// ═══ A7: status workflow, history, notifications ═════════════════════════

const putApp = (id: string, json: unknown) =>
  application.PUT(req(`/api/application/${id}`, { method: "PUT", json }), params({ id }));

test("A7: a new application starts the history and notifies the owning company only", async () => {
  as("candidate2");
  const res = await apply(IDS.jobBPub);
  assert.equal(res.status, 201, JSON.stringify(await res.clone().json()));
  const created = (await body(res)).data;
  assert.equal(JSON.stringify(created).includes(IDS.coBUser), false, "owner user id never returned");

  const history = db.table("applicationStatusHistory").filter((h) => h.applicationId === created.id);
  assert.equal(history.length, 1);
  assert.equal(history[0].fromStatus, null);
  assert.equal(history[0].toStatus, "NOUVEAU");

  const notes = db.table("notification");
  assert.equal(notes.length, 1);
  assert.equal(notes[0].userId, IDS.coBUser);
  assert.equal(notes[0].type, "NEW_APPLICATION");
  assert.equal(notes[0].link, `/dashboard/company/jobs/${IDS.jobBPub}/applications`);
  assert.equal(JSON.stringify(notes[0]).includes("Cand"), false, "no candidate name in the notification");
});

test("A7: Rejected → Hired is refused (409) and nothing is recorded", async () => {
  row("application", IDS.appA).status = "REFUSE";
  as("companyA");
  const res = await putApp(IDS.appA, { status: "EMBAUCHES" });
  assert.equal(res.status, 409);
  const b = await body(res);
  assert.equal(b.code, "INVALID_STATUS_TRANSITION");
  assert.deepEqual(b.details.allowed, ["EN_COURS_EXAMEN", "REFUSE"]);
  assert.equal(row("application", IDS.appA).status, "REFUSE");
  assert.equal(db.table("applicationStatusHistory").length, 0);
  assert.equal(db.table("notification").length, 0);
});

test("A7: a valid change is applied, recorded with its author, and the candidate is notified (no notes leaked)", async () => {
  as("companyA"); // appA is EN_COURS_EXAMEN in the seed
  const res = await putApp(IDS.appA, { status: "ENTRETIEN", notes: "Call on Monday" });
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
  assert.equal(row("application", IDS.appA).status, "ENTRETIEN");
  assert.equal(row("application", IDS.appA).notes, "Call on Monday");

  const [h] = db.table("applicationStatusHistory");
  assert.equal(h.fromStatus, "EN_COURS_EXAMEN");
  assert.equal(h.toStatus, "ENTRETIEN");
  assert.equal(h.changedById, IDS.coAUser);

  const [n] = db.table("notification");
  assert.equal(n.userId, IDS.candUser);
  assert.equal(n.type, "APPLICATION_STATUS_CHANGED");
  assert.match(String(n.body), /Interview/);
  assert.equal(JSON.stringify(n).includes("Call on Monday"), false);
  assert.equal(JSON.stringify(n).includes(SECRET_NOTE), false);
});

test("A7: saving the same status (e.g. notes only) is a no-op for the workflow", async () => {
  as("companyA");
  assert.equal((await putApp(IDS.appA, { status: "EN_COURS_EXAMEN", notes: "x" })).status, 200);
  assert.equal((await putApp(IDS.appA, { isSaved: false })).status, 200);
  assert.equal(db.table("applicationStatusHistory").length, 0);
  assert.equal(db.table("notification").length, 0);
});

test("A7: another company cannot change the status (still 403, nothing recorded)", async () => {
  as("companyB");
  assert.equal((await putApp(IDS.appA, { status: "REFUSE" })).status, 403);
  assert.equal(db.table("applicationStatusHistory").length, 0);
});

test("A7: notifications API is scoped to the signed-in user; marking others' ids changes nothing", async () => {
  const now = new Date();
  db.table("notification").push(
    { id: "a0000000-0000-4000-8000-000000000001", userId: IDS.candUser, type: "APPLICATION_STATUS_CHANGED", title: "Mine", body: null, link: "/dashboard/candidate/applications", readAt: null, createdAt: now },
    { id: "a0000000-0000-4000-8000-000000000002", userId: IDS.cand2User, type: "APPLICATION_STATUS_CHANGED", title: "Theirs", body: null, link: null, readAt: null, createdAt: now }
  );
  as("anon");
  assert.equal((await notifications.GET()).status, 401);

  as("candidate");
  const list = await notifications.GET();
  const lb = await body(list);
  assert.equal(list.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(lb.data.map((n: { title: string }) => n.title), ["Mine"]);
  assert.equal(lb.unreadCount, 1);

  const patchOthers = await notifications.PATCH(
    req("/api/notifications", { method: "PATCH", json: { ids: ["a0000000-0000-4000-8000-000000000002"] } })
  );
  assert.equal((await body(patchOthers)).data.updated, 0);
  assert.equal(row("notification", "a0000000-0000-4000-8000-000000000002").readAt, null);

  const all = await notifications.PATCH(req("/api/notifications", { method: "PATCH", json: { all: true } }));
  assert.equal((await body(all)).data.updated, 1);
  assert.ok(row("notification", "a0000000-0000-4000-8000-000000000001").readAt);
  assert.equal(row("notification", "a0000000-0000-4000-8000-000000000002").readAt, null);

  const bad = await notifications.PATCH(req("/api/notifications", { method: "PATCH", json: { ids: ["x"], userId: IDS.cand2User } }));
  assert.equal(bad.status, 400);
});

// ═══ A2: scheduled expiry ═══════════════════════════════════════════════

const cronReq = (auth?: string) =>
  expire.GET(req("/api/job-offers/expire", { headers: auth ? { authorization: auth } : {} }));

test("A2: the cron endpoint is disabled without CRON_SECRET and refuses a wrong secret", async () => {
  assert.equal((await cronReq("Bearer anything")).status, 503);
  process.env.CRON_SECRET = "s".repeat(32);
  assert.equal((await cronReq()).status, 401);
  assert.equal((await cronReq("Bearer wrong")).status, 401);
  assert.equal((await cronReq(`Bearer ${"s".repeat(31)}x`)).status, 401);
});

test("A2: a scheduled run closes only expired published jobs, is idempotent, and expires the caches", async () => {
  process.env.CRON_SECRET = "s".repeat(32);
  const past = new Date(Date.now() - 60_000);
  row("jobOffer", IDS.jobAPub).expiresAt = past; // published + expired → close
  row("jobOffer", IDS.jobADraft).expiresAt = past; // draft → untouched
  row("jobOffer", IDS.jobBPub).expiresAt = new Date(Date.now() + 864e5); // still valid → untouched

  const first = await cronReq(`Bearer ${"s".repeat(32)}`);
  assert.equal(first.status, 200);
  assert.equal((await body(first)).data.closedCount, 1);
  assert.equal(row("jobOffer", IDS.jobAPub).status, "CLOSED");
  assert.ok(row("jobOffer", IDS.jobAPub).closedAt);
  assert.equal(row("jobOffer", IDS.jobADraft).status, "DRAFT");
  assert.equal(row("jobOffer", IDS.jobBPub).status, "PUBLISHED");
  assert.ok(cache.tagProfiles.some((t) => t.tag === "job-offers" && JSON.stringify(t.profile) === '{"expire":0}'));

  const second = await cronReq(`Bearer ${"s".repeat(32)}`);
  assert.equal((await body(second)).data.closedCount, 0, "safe to retry");
});

test("A2: the manual run stays admin-only", async () => {
  as("companyA");
  assert.equal((await expire.POST()).status, 403);
  as("admin");
  assert.equal((await expire.POST()).status, 200);
});

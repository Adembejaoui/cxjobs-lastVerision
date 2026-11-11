/**
 * Q2: end-to-end candidate journey through the REAL route handlers:
 *
 *   register → complete profile (onboarding) → find a job with combined
 *   filters → apply → duplicate refused → company sees and processes the
 *   application → candidate sees the new status and a notification.
 *
 * Scope and limits (stated honestly):
 *   - The database is the in-memory fake used by every integration test
 *     (no Postgres is available to the test environment). Constraints that
 *     only Postgres enforces are covered elsewhere or listed as open in
 *     docs/PRODUCTION-READINESS-REMEDIATION.md.
 *   - The signed-in session is built from the DATABASE row created by the
 *     real register route (role/onboarding are never chosen by the test).
 *     The real Auth.js login, cookies and JWT callback are exercised by
 *     tests/integration/auth-flows.routes.test.ts; Next's request scope that
 *     `auth()` needs inside other routes does not exist outside a server.
 *   - No browser: UI behaviour is in the manual QA plan (Q4).
 */
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { installMocks, resetState, as, asUser, req, params, body, db, IDS, SECRET_NOTE } from "./harness";

let register: typeof import("@/app/api/auth/register/route");
let profile: typeof import("@/app/api/profile/route");
let jobs: typeof import("@/app/api/job-offers/route");
let applications: typeof import("@/app/api/application/route");
let application: typeof import("@/app/api/application/[id]/route");
let jobApps: typeof import("@/app/api/job-offers/[jobId]/applications/route");
let notifications: typeof import("@/app/api/notifications/route");

before(async () => {
  installMocks();
  register = await import("@/app/api/auth/register/route");
  profile = await import("@/app/api/profile/route");
  jobs = await import("@/app/api/job-offers/route");
  applications = await import("@/app/api/application/route");
  application = await import("@/app/api/application/[id]/route");
  jobApps = await import("@/app/api/job-offers/[jobId]/applications/route");
  notifications = await import("@/app/api/notifications/route");
});
beforeEach(async () => {
  await resetState();
});
after(() => setTimeout(() => process.exit(0), 50).unref());

async function waitForUser(email: string, ms = 3000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const u = db.table("user").find((r) => r.email === email);
    if (u) return u;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`user ${email} was not created`);
}

test("Q2: a new candidate registers, completes the profile, finds a job and applies; the company processes it", async () => {
  // 1. Register (mixed case: stored lowercase, A5).
  const reg = await register.POST(
    req("/api/auth/register", { method: "POST", json: { email: "New.Candidate@Example.com", password: "Strong-Pass-9", name: "New Candidate" } })
  );
  assert.equal(reg.status, 201);
  const user = await waitForUser("new.candidate@example.com");
  assert.equal(user.role, "CANDIDATE", "role is set by the server");
  assert.equal(user.isOnboarded, false);

  // 2. Signed in (session mirrors the DB row). Applying before onboarding fails.
  asUser(String(user.id));
  const early = await applications.POST(req("/api/application", { method: "POST", json: { jobOfferId: IDS.jobAPub } }));
  assert.equal(early.status, 400);

  // 3. Complete the profile (onboarding).
  const onboard = await profile.POST(
    req("/api/profile", {
      method: "POST",
      json: {
        gender: "Female",
        dateOfBirth: "1996-04-12",
        firstName: "New",
        lastName: "Candidate",
        phone: "+21650000000",
        location: "Tunis",
        headline: "Bilingual customer agent",
        targetJobRole: "GENERAL",
        skills: [{ name: "Empathy" }],
      },
    })
  );
  assert.equal(onboard.status, 200, JSON.stringify(await onboard.clone().json()));
  assert.equal(db.table("user").find((u) => u.id === user.id)!.isOnboarded, true);
  asUser(String(user.id)); // session refreshed from the DB (isOnboarded now true)

  // 4. Find the job: keyword AND city must both match (P1), as an anonymous visitor would.
  as("anon");
  const search = await jobs.GET(req("/api/job-offers?search=Alpha&location=Tunis&status=PUBLISHED"));
  assert.equal(search.status, 200);
  const found = (await body(search)).data as { id: string; title: string }[];
  assert.deepEqual(found.map((j) => j.id), [IDS.jobAPub], "only Tunis jobs matching 'Alpha'");
  const none = await jobs.GET(req("/api/job-offers?search=Alpha&location=Sousse&status=PUBLISHED"));
  assert.equal((await body(none)).data.length, 0, "AND, not OR");

  // 5. Apply, then a duplicate is refused clearly (F4).
  asUser(String(user.id));
  const applied = await applications.POST(
    req("/api/application", { method: "POST", json: { jobOfferId: IDS.jobAPub, coverLetter: "I would love to join." } })
  );
  assert.equal(applied.status, 201, JSON.stringify(await applied.clone().json()));
  const applicationId = (await body(applied)).data.id as string;
  const dup = await applications.POST(req("/api/application", { method: "POST", json: { jobOfferId: IDS.jobAPub } }));
  assert.equal(dup.status, 409);
  assert.equal((await body(dup)).code, "DUPLICATE_APPLICATION");
  // "Already applied" is visible on load (the check the job/apply pages make).
  const mine = await applications.GET(req(`/api/application?jobId=${IDS.jobAPub}`));
  assert.equal((await body(mine)).data.length, 1);

  // 6. The company is notified, sees the applicant and moves the status on.
  as("companyA");
  const companyNotes = await body(await notifications.GET());
  assert.ok(companyNotes.data.some((n: { type: string }) => n.type === "NEW_APPLICATION"));
  const list = await jobApps.GET(req(`/api/job-offers/${IDS.jobAPub}/applications`), params({ jobId: IDS.jobAPub }));
  assert.equal(list.status, 200);
  assert.ok(JSON.stringify(await body(list)).includes(applicationId));
  const moved = await application.PUT(
    req(`/api/application/${applicationId}`, { method: "PUT", json: { status: "ENTRETIEN", notes: SECRET_NOTE } }),
    params({ id: applicationId })
  );
  assert.equal(moved.status, 200);

  // 7. The candidate sees the new status, a notification, and never the recruiter notes.
  asUser(String(user.id));
  const detail = await application.GET(req(`/api/application/${applicationId}`), params({ id: applicationId }));
  const d = await body(detail);
  assert.equal(d.data.status, "ENTRETIEN");
  assert.equal(JSON.stringify(d).includes(SECRET_NOTE), false, "S3: no recruiter notes");
  const candNotes = await body(await notifications.GET());
  assert.equal(candNotes.unreadCount, 1);
  assert.equal(candNotes.data[0].type, "APPLICATION_STATUS_CHANGED");
  assert.equal(JSON.stringify(candNotes).includes(SECRET_NOTE), false);

  // History: submitted, then moved to interview by the company.
  const history = db.table("applicationStatusHistory").filter((h) => h.applicationId === applicationId);
  assert.deepEqual(history.map((h) => [h.fromStatus, h.toStatus]), [[null, "NOUVEAU"], ["NOUVEAU", "ENTRETIEN"]]);
});

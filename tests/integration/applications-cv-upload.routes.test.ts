import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import {
  installMocks, resetState, as, req, params, body, db, storage, IDS, CV_PATH, SECRET_NOTE, assertNotLeaked,
} from "./harness";

let appList: typeof import("@/app/api/application/route");
let appOne: typeof import("@/app/api/application/[id]/route");
let appCv: typeof import("@/app/api/application/[id]/cv/route");
let profileCv: typeof import("@/app/api/profile/cv/route");
let upload: typeof import("@/app/api/upload/route");
let dashCand: typeof import("@/app/api/dashboard/candidate/route");

before(async () => {
  installMocks();
  appList = await import("@/app/api/application/route");
  appOne = await import("@/app/api/application/[id]/route");
  appCv = await import("@/app/api/application/[id]/cv/route");
  profileCv = await import("@/app/api/profile/cv/route");
  upload = await import("@/app/api/upload/route");
  dashCand = await import("@/app/api/dashboard/candidate/route");
});
beforeEach(resetState);
after(() => setTimeout(() => process.exit(0), 50).unref());

const getOne = (id: string) => appOne.GET(req(`/api/application/${id}`), params({ id }));

// ─── GET /api/application ─────────────────────────────────────────────

test("GET applications: unauthenticated → 401", async () => {
  assert.equal((await appList.GET(req("/api/application"))).status, 401);
});

test("GET applications: candidate sees only own applications and never recruiter notes", async () => {
  as("candidate");
  const json = await body(await appList.GET(req("/api/application")));
  assert.deepEqual(json.data.map((a: { id: string }) => a.id).sort(), [IDS.appA, IDS.appB].sort());
  assertNotLeaked(json, SECRET_NOTE);
});

test("GET applications: company sees only applications to its own jobs", async () => {
  as("companyA");
  const json = await body(await appList.GET(req("/api/application")));
  assert.deepEqual(json.data.map((a: { id: string }) => a.id).sort(), [IDS.appA, IDS.appCand2].sort());
});

test("GET applications: company forging another company's jobId gets nothing", async () => {
  as("companyA");
  const json = await body(await appList.GET(req(`/api/application?jobId=${IDS.jobBPub}`)));
  assert.equal(json.data.length, 0);
});

test("GET applications: COMPANY without profile → 404, not an unscoped list", async () => {
  as("companyOrphan");
  assert.equal((await appList.GET(req("/api/application"))).status, 404);
});

// ─── GET /api/application/[id] ───────────────────────────────────────

test("GET application: candidate reads own application WITHOUT recruiter notes", async () => {
  as("candidate");
  const res = await getOne(IDS.appA);
  assert.equal(res.status, 200);
  const json = await body(res);
  assert.equal(json.data.id, IDS.appA);
  assert.equal("notes" in json.data, false);
  assertNotLeaked(json, SECRET_NOTE);
});

test("GET application: candidate cannot read another candidate's application (forged id)", async () => {
  as("candidate2");
  assert.equal((await getOne(IDS.appA)).status, 404);
});

test("GET application: owning company sees notes; unrelated company is denied", async () => {
  as("companyA");
  const json = await body(await getOne(IDS.appA));
  assert.equal(json.data.notes, SECRET_NOTE);
  as("companyB");
  const res = await getOne(IDS.appA);
  assert.equal(res.status, 403);
  assertNotLeaked(await body(res), SECRET_NOTE);
});

test("GET application: admin may read full record", async () => {
  as("admin");
  assert.equal((await body(await getOne(IDS.appA))).data.notes, SECRET_NOTE);
});

test("GET candidate dashboard: recent applications never include notes", async () => {
  as("candidate");
  const res = await dashCand.GET();
  assertNotLeaked(await body(res), SECRET_NOTE);
});

test("PUT application: candidate cannot write notes/status; unrelated company forbidden", async () => {
  const putApp = (id: string, json: unknown) => appOne.PUT(req(`/api/application/${id}`, { method: "PUT", json }), params({ id }));
  as("candidate");
  assert.equal((await putApp(IDS.appA, { notes: "self-praise", status: "EMBAUCHES" })).status, 403);
  as("companyB");
  assert.equal((await putApp(IDS.appA, { notes: "x" })).status, 403);
  assert.equal(db.table("application").find((a) => a.id === IDS.appA)!.notes, SECRET_NOTE);
});

// ─── CV access ──────────────────────────────────────────────────────

const cv = (id: string, q = "") => appCv.GET(req(`/api/application/${id}/cv${q}`), params({ id }));

test("CV: unauthenticated → 401 and nothing signed", async () => {
  assert.equal((await cv(IDS.appA)).status, 401);
  assert.equal(storage.signed.length, 0);
});

test("CV: applicant, owning company and admin get a 60s signed redirect", async () => {
  for (const p of ["candidate", "companyA", "admin"] as const) {
    as(p);
    const res = await cv(IDS.appA, "?download=1");
    assert.equal(res.status, 302, p);
    assert.match(res.headers.get("location") ?? "", /\/object\/sign\/cv\//);
    assert.equal(res.headers.get("cache-control"), "private, no-store");
  }
  assert.ok(storage.signed.every((s) => s.bucket === "cv" && s.expiresIn === 60 && s.path === CV_PATH && s.download));
  assert.equal(storage.publicUrlCalls.length, 0);
});

test("CV: other candidate and unrelated company get 404 and no URL is signed", async () => {
  for (const p of ["candidate2", "companyB", "companyOrphan"] as const) {
    as(p);
    assert.equal((await cv(IDS.appA)).status, 404, p);
  }
  assert.equal(storage.signed.length, 0);
});

test("CV: application pointing at ANOTHER user's object is refused", async () => {
  db.table("application").find((a) => a.id === IDS.appCand2)!.cvUrl = CV_PATH; // cand2's app → cand1's file
  as("companyA");
  assert.equal((await cv(IDS.appCand2)).status, 404);
  assert.equal(storage.signed.length, 0);
});

test("CV: legacy stored signed URL still resolves to the object path", async () => {
  db.table("application").find((a) => a.id === IDS.appA)!.cvUrl =
    `https://testproj.supabase.invalid/storage/v1/object/sign/cv/${CV_PATH}?token=EXPIRED`;
  as("companyA");
  assert.equal((await cv(IDS.appA)).status, 302);
  assert.equal(storage.signed[0].path, CV_PATH);
});

test("CV: /api/profile/cv serves only the caller's own CV", async () => {
  as("candidate");
  assert.equal((await profileCv.GET(req("/api/profile/cv"))).status, 302);
  as("candidate2");
  assert.equal((await profileCv.GET(req("/api/profile/cv"))).status, 404);
  as("anon");
  assert.equal((await profileCv.GET(req("/api/profile/cv"))).status, 401);
});

// ─── Upload ─────────────────────────────────────────────────────────

const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\n"), Buffer.alloc(64, 0x20), Buffer.from("\n%%EOF\n")]);
function uploadReq(type: string, file: Blob, name: string, extraQuery = "") {
  const fd = new FormData();
  fd.append("file", file, name);
  return upload.POST(req(`/api/upload?type=${type}${extraQuery}`, { method: "POST", body: fd }));
}

test("upload: candidate CV stored privately under own folder with server-chosen name/type", async () => {
  as("candidate");
  const res = await uploadReq("cv", new Blob([pdf], { type: "application/pdf" }), "../../etc/My CV.pdf");
  assert.equal(res.status, 200);
  const json = await body(res);
  assert.match(json.data.path, new RegExp(`^${IDS.candUser}/\\d+-[0-9a-f-]{36}\\.pdf$`));
  const [key, obj] = [...storage.objects.entries()][0];
  assert.equal(key, `cv/${json.data.path}`);
  assert.equal(obj.contentType, "application/pdf");
  assert.equal(storage.publicUrlCalls.length, 0);
  assert.equal(storage.signed[0].expiresIn, 120); // short preview only
});

test("upload: HTML disguised as PDF (fake extension + forged MIME) rejected", async () => {
  as("candidate");
  const html = new Blob(["<html><script>alert(1)</script></html>"], { type: "application/pdf" });
  const res = await uploadReq("cv", html, "cv.pdf");
  assert.equal(res.status, 400);
  assert.equal(storage.objects.size, 0);
});

test("upload: real PDF with .html extension rejected", async () => {
  as("candidate");
  assert.equal((await uploadReq("cv", new Blob([pdf], { type: "application/pdf" }), "cv.html")).status, 400);
});

test("upload: oversized file rejected before storage", async () => {
  as("candidate");
  const big = new Blob([pdf, Buffer.alloc(6 * 1024 * 1024)], { type: "application/pdf" });
  const res = await uploadReq("cv", big, "cv.pdf");
  assert.ok(res.status === 400 || res.status === 413);
  assert.equal(storage.objects.size, 0);
});

test("upload: role and target checks (unauth 401, company cannot upload CV, non-admin targetUserId 403)", async () => {
  assert.equal((await uploadReq("cv", new Blob([pdf], { type: "application/pdf" }), "cv.pdf")).status, 401);
  as("companyA");
  assert.equal((await uploadReq("cv", new Blob([pdf], { type: "application/pdf" }), "cv.pdf")).status, 403);
  as("candidate");
  const res = await uploadReq("cv", new Blob([pdf], { type: "application/pdf" }), "cv.pdf", `&targetUserId=${IDS.cand2User}`);
  assert.equal(res.status, 403);
  assert.equal(storage.objects.size, 0);
});

// ─── Phase 2 regressions: application availability guard ──────────────

const applyTo = (jobOfferId: string) =>
  appList.POST(req("/api/application", { method: "POST", json: { jobOfferId, coverLetter: "hi" } }));
const jobRow = (id: string) => db.table("jobOffer").find((j) => j.id === id)!;

test("POST application (P1 #12): EXTERNAL jobs refuse internal applications", async () => {
  Object.assign(jobRow(IDS.jobBPub), { applicationType: "EXTERNAL", externalApplyUrl: "https://beta.test/apply" });
  as("candidate2");
  const res = await applyTo(IDS.jobBPub);
  assert.equal(res.status, 400);
  assert.equal((await body(res)).code, "EXTERNAL_APPLICATION");
  assert.equal(db.table("application").filter((a) => a.jobOfferId === IDS.jobBPub && a.candidateId === IDS.cand2).length, 0);
});

test("POST application (P1 #11): expired jobs refuse applications", async () => {
  jobRow(IDS.jobBPub).expiresAt = new Date(Date.now() - 1000);
  as("candidate2");
  assert.equal((await applyTo(IDS.jobBPub)).status, 404);
});

test("POST application: open INTERNAL job accepts, and the response hides the company owner's user id", async () => {
  as("candidate2");
  const res = await applyTo(IDS.jobBPub);
  assert.equal(res.status, 201);
  const json = await body(res);
  assert.equal(json.data.jobOffer.company.userId, undefined);
});

test("GET applications (P1 #16): invalid status / jobId filters are 400, not 500", async () => {
  as("candidate");
  assert.equal((await appList.GET(req("/api/application?status=HACKED"))).status, 400);
  assert.equal((await appList.GET(req("/api/application?jobId=not-a-uuid"))).status, 400);
});

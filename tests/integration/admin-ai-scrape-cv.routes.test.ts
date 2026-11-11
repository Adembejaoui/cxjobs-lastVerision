import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { createMemoryRevocationStore } from "../helpers/revocation-store";
import { installMocks, resetState, as, req, params, body, db, ai, IDS, assertNotLeaked } from "./harness";

let adminUser: typeof import("@/app/api/admin/users/[id]/route");
let scrape: typeof import("@/app/api/job-offers/scrape-from-url/route");
let gen: typeof import("@/app/api/job-offers/generate-with-ai/route");
let cvParse: typeof import("@/app/api/onboarding/cv-parse/route");
let jobs: typeof import("@/app/api/job-offers/route");
let appOne: typeof import("@/app/api/application/[id]/route");
let revocation: typeof import("@/lib/server/session-revocation");
let revocationData = new Map<string, { v: string; ex: number }>();
const published = { get: (k: string) => revocationData.get(k)?.v, clear: () => revocationData.clear() };

before(async () => {
  installMocks();
  adminUser = await import("@/app/api/admin/users/[id]/route");
  scrape = await import("@/app/api/job-offers/scrape-from-url/route");
  gen = await import("@/app/api/job-offers/generate-with-ai/route");
  cvParse = await import("@/app/api/onboarding/cv-parse/route");
  jobs = await import("@/app/api/job-offers/route");
  appOne = await import("@/app/api/application/[id]/route");
  revocation = await import("@/lib/server/session-revocation");
});
beforeEach(async () => {
  await resetState();
  published.clear();
  const mem = createMemoryRevocationStore();
  revocationData = mem.data;
  revocation.__setRevocationStoreForTests(mem.store);
});
after(() => setTimeout(() => process.exit(0), 50).unref());

// ─── Admin user update → session revocation ─────────────────────────

const patchUser = (id: string, json: unknown) =>
  adminUser.PATCH(req(`/api/admin/users/${id}`, { method: "PATCH", json }), params({ id }));

test("admin PATCH: suspension bumps sessionVersion in DB and publishes it", async () => {
  as("admin");
  assert.equal((await patchUser(IDS.coAUser, { isActive: false })).status, 200);
  assert.equal(db.table("user").find((u) => u.id === IDS.coAUser)!.sessionVersion, 1);
  assert.equal(published.get(`session-version:${IDS.coAUser}`), "1");
});

test("admin PATCH: email change revokes; harmless name change does not", async () => {
  as("admin");
  await patchUser(IDS.candUser, { name: "Renamed" });
  assert.equal(db.table("user").find((u) => u.id === IDS.candUser)!.sessionVersion, 0);
  await patchUser(IDS.candUser, { email: "changed@cx.test" });
  assert.equal(db.table("user").find((u) => u.id === IDS.candUser)!.sessionVersion, 1);
});

test("admin PATCH: non-admins are refused and nothing changes", async () => {
  for (const p of ["candidate", "companyA"] as const) {
    as(p);
    assert.equal((await patchUser(IDS.coBUser, { isActive: false })).status, 403);
  }
  as("anon");
  assert.equal((await patchUser(IDS.coBUser, { isActive: false })).status, 401);
  assert.equal(db.table("user").find((u) => u.id === IDS.coBUser)!.isActive, true);
});

// ─── Scrape from URL (SSRF through the real route) ──────────────────

const scrapeReq = (url: unknown, ip?: string) =>
  scrape.POST(req("/api/job-offers/scrape-from-url", { method: "POST", json: { url }, ip }));

test("scrape: unauthenticated 401, candidate 403", async () => {
  assert.equal((await scrapeReq("https://8.8.8.8/")).status, 401);
  as("candidate");
  assert.equal((await scrapeReq("https://8.8.8.8/")).status, 403);
});

test("scrape: internal / metadata / non-https targets never reach the fetcher or the AI", async () => {
  as("companyA");
  for (const u of [
    "https://169.254.169.254/latest/meta-data/",
    "https://127.0.0.1/",
    "https://[::ffff:127.0.0.1]/",
    "https://2130706433/",
    "https://localhost/",
    "https://metadata.google.internal/",
    "https://8.8.8.8:6379/",
  ]) {
    const res = await scrapeReq(u, `203.0.113.${Math.floor(Math.random() * 200) + 1}`);
    assert.ok([400, 502].includes(res.status), `${u} → ${res.status}`);
    // Reset per-user scrape budget so all cases run.
    const rl = await import("@/lib/rate-limit");
    rl.__setRateLimitStoreForTests(rl.createMemoryStore());
  }
  for (const u of ["http://example.com/", "file:///etc/passwd", "javascript:alert(1)", 42]) {
    assert.equal((await scrapeReq(u)).status, 400, String(u));
  }
  assert.equal(ai.calls.length, 0);
});

test("scrape: per-account limit (5/min) holds across IPs", async () => {
  as("companyA");
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await scrapeReq("https://127.0.0.1/", `203.0.113.${100 + i}`)).status);
  assert.equal(statuses[5], 429);
});

// ─── AI generation ──────────────────────────────────────────────────

const genReq = (json: unknown, ip?: string) =>
  gen.POST(req("/api/job-offers/generate-with-ai", { method: "POST", json, ip }));

test("AI generate: 401 / 403 before any AI call; company allowed", async () => {
  assert.equal((await genReq({ title: "Customer Agent" })).status, 401);
  as("candidate");
  assert.equal((await genReq({ title: "Customer Agent" })).status, 403);
  assert.equal(ai.calls.length, 0);
  as("companyA");
  assert.equal((await genReq({ title: "Customer Agent" })).status, 200);
  assert.equal(ai.calls.length, 1);
});

test("AI generate: malformed input 400; per-account limit 429 across IPs", async () => {
  as("companyA");
  assert.equal((await genReq({ title: 123 })).status, 400);
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await genReq({ title: "Customer Agent" }, `198.51.100.${200 + i}`)).status);
  assert.equal(statuses.at(-1), 429);
  assert.ok(ai.calls.length <= 5);
});

// ─── CV parse ───────────────────────────────────────────────────────

const u8 = (b: Buffer) => new Uint8Array(b);

function pdfBytes(text: string): Buffer {
  const stream = `BT /F1 12 Tf 20 100 Td (${text}) Tj ET`;
  const objs = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
    `<</Length ${stream.length}>>stream\n${stream}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  let out = "%PDF-1.4\n";
  const offs: number[] = [];
  objs.forEach((o, i) => {
    offs.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

function cvReq(file: Blob, name: string, extra: Record<string, string> = {}, ip?: string) {
  const fd = new FormData();
  fd.append("cv", file, name);
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return cvParse.POST(req("/api/onboarding/cv-parse", { method: "POST", body: fd, ip }));
}

test("cv-parse: candidate can parse a real PDF", async () => {
  as("candidate");
  const res = await cvReq(new Blob([u8(pdfBytes("Jane Doe jane@example.com"))], { type: "application/pdf" }), "cv.pdf", { useAI: "false" });
  assert.equal(res.status, 200);
  assert.equal((await body(res)).success, true);
});

test("cv-parse: forged MIME / fake extension / non-PDF rejected before parsing", async () => {
  as("candidate");
  const html = new Blob(["<html><script>alert(1)</script></html>"], { type: "application/pdf" });
  assert.equal((await cvReq(html, "cv.pdf")).status, 400);
  assert.equal((await cvReq(new Blob([u8(pdfBytes("x"))], { type: "application/pdf" }), "cv.exe")).status, 400);
  assert.equal(ai.calls.length, 0);
});

test("cv-parse: roles and limits", async () => {
  const f = () => new Blob([u8(pdfBytes("x"))], { type: "application/pdf" });
  assert.equal((await cvReq(f(), "cv.pdf")).status, 401);
  as("companyA");
  assert.equal((await cvReq(f(), "cv.pdf")).status, 403);
  as("candidate");
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await cvReq(f(), "cv.pdf", { useAI: "false" }, `192.0.2.${10 + i}`)).status);
  assert.equal(statuses.at(-1), 429);
});

test("cv-parse: oversized body rejected with 413 before buffering", async () => {
  as("candidate");
  const fd = new FormData();
  fd.append("cv", new Blob([u8(Buffer.alloc(16))], { type: "application/pdf" }), "cv.pdf");
  const res = await cvParse.POST(
    req("/api/onboarding/cv-parse", { method: "POST", body: fd, headers: { "content-length": String(50 * 1024 * 1024) } })
  );
  assert.equal(res.status, 413);
});

// ─── S10: internal error disclosure through routes ──────────────────

const INTERNAL = 'PrismaClientKnownRequestError: relation "job_offers" does not exist at /var/task/node_modules/.prisma/client';

test("errors: database failure returns a generic 500 with no internal details", async () => {
  const jobDelegate = db.client.jobOffer as { findMany: (...a: unknown[]) => Promise<unknown> };
  const appDelegate = db.client.application as { findUnique: (...a: unknown[]) => Promise<unknown> };
  const origFind = jobDelegate.findMany;
  const origApp = appDelegate.findUnique;
  jobDelegate.findMany = async () => {
    throw new Error(INTERNAL);
  };
  appDelegate.findUnique = async () => {
    throw new Error(INTERNAL);
  };
  try {
    as("admin");
    const r1 = await jobs.GET(req("/api/job-offers"));
    const r2 = await appOne.GET(req(`/api/application/${IDS.appA}`), params({ id: IDS.appA }));
    for (const r of [r1, r2]) {
      assert.equal(r.status, 500);
      const json = await body(r);
      assert.equal(json.code, "INTERNAL_ERROR");
      assertNotLeaked(json, "Prisma");
      assertNotLeaked(json, "/var/task");
      assertNotLeaked(json, "job_offers");
    }
  } finally {
    jobDelegate.findMany = origFind;
    appDelegate.findUnique = origApp;
  }
});

test("errors: corrupt PDF returns a fixed message, not the parser's", async () => {
  as("candidate");
  const corrupt = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("\u0000\u0001garbage".repeat(50)), Buffer.from("\n%%EOF\n")]);
  const res = await cvReq(new Blob([u8(corrupt)], { type: "application/pdf" }), "cv.pdf", { useAI: "false" });
  const json = await body(res);
  assert.ok([200, 400].includes(res.status));
  assertNotLeaked(json, "pdf.js");
  assertNotLeaked(json, "InvalidPDFException");
  assertNotLeaked(json, "node_modules");
});

// ─── Phase 2 (NF-15): admin email change and outstanding one-time tokens ──

test("NF-15: a real address change revokes reset/verification tokens and clears emailVerified", async () => {
  const future = new Date(Date.now() + 3600_000);
  db.table("passwordResetToken").push({ id: "prt-1", email: "cand@cx.test", token: "a".repeat(64), userId: IDS.candUser, expires: future, createdAt: new Date() });
  db.table("emailVerificationToken").push({ id: "evt-1", email: "cand@cx.test", token: "b".repeat(64), userId: IDS.candUser, expires: future, createdAt: new Date() });
  as("admin");
  assert.equal((await patchUser(IDS.candUser, { email: "New.Owner@CX.test" })).status, 200);
  const row = db.table("user").find((u) => u.id === IDS.candUser)!;
  assert.equal(row.email, "new.owner@cx.test");
  assert.equal(row.emailVerified, null);
  assert.equal(db.table("passwordResetToken").filter((t) => t.userId === IDS.candUser).length, 0);
  assert.equal(db.table("emailVerificationToken").filter((t) => t.userId === IDS.candUser).length, 0);
});

test("NF-15: a case-only normalization is not an identity change (verification kept)", async () => {
  const user = db.table("user").find((u) => u.id === IDS.candUser)!;
  user.email = "Cand@CX.test";
  const verifiedAt = user.emailVerified;
  as("admin");
  assert.equal((await patchUser(IDS.candUser, { email: "cand@cx.test" })).status, 200);
  assert.equal(user.email, "cand@cx.test");
  assert.equal(user.emailVerified, verifiedAt);
});

// ─── Phase 3 (H4): AI timeouts and failures at the route level ────────

test("H4: AI generate maps a provider timeout to a generic 504 and passes a deadline signal", async () => {
  const { AIServiceError } = await import("@/lib/ai-errors");
  ai.failWith = new AIServiceError("Failed to generate job description", "timeout");
  as("companyA");
  const res = await genReq({ title: "Customer Agent" });
  assert.equal(res.status, 504);
  const json = await body(res);
  assert.equal(json.code, "AI_TIMEOUT");
  assert.equal(json.details, undefined);
  assert.ok(ai.calls[0].signal instanceof AbortSignal, "the route must bound the AI call with a signal");
});

test("H4: AI generate maps other provider failures to a fixed 500 message", async () => {
  const { AIServiceError } = await import("@/lib/ai-errors");
  ai.failWith = new AIServiceError("Failed to generate job description", "unavailable");
  as("companyA");
  const res = await genReq({ title: "Customer Agent" });
  assert.equal(res.status, 500);
  const json = await body(res);
  assert.equal(json.code, "AI_GENERATION_FAILED");
  assert.doesNotMatch(JSON.stringify(json), /unavailable|stack|status/i);
});

test("H4: cv-parse falls back to basic parsing when the AI step times out", async () => {
  const { AIServiceError } = await import("@/lib/ai-errors");
  ai.failWith = new AIServiceError("Failed to parse CV with AI", "timeout");
  as("candidate");
  const res = await cvReq(new Blob([u8(pdfBytes("Jane Doe jane@example.com"))], { type: "application/pdf" }), "cv.pdf");
  assert.equal(res.status, 200);
  const json = await body(res);
  assert.equal(json.success, true);
  assert.equal(json.data.email, "jane@example.com"); // basic extraction still worked
  assert.ok(ai.calls.some((c) => c.fn === "parseCVWithAI" && c.signal instanceof AbortSignal));
});

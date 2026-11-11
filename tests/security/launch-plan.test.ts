/**
 * Launch-plan remediation: unit-level security and business-rule tests for
 * the pure modules added on 11 Nov (no DB, no network).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createMemoryStore, checkRateLimitAsync, refundRateLimitAsync } from "../../lib/rate-limit";
import {
  canTransitionApplication,
  statusOptionsFrom,
  APPLICATION_STATUSES,
} from "../../lib/application-status";
import { isOwnStorageImageUrl, trustedStorageHosts } from "../../lib/security/safe-url";
import { candidateCompleteness } from "../../lib/candidate-profile-completeness";
import { buildJobPostingJsonLd, serializeJsonLd } from "../../lib/seo/job-posting";
import { assertSeedTargetAllowed, requireSeedPassword } from "../../prisma/seed-guard";
import { validateEnv } from "../../lib/env";
import { findSeedCredentialProblems } from "../helpers/seed-credential-scan";

// ─── S7: refund primitive ──────────────────────────────────────────────

test("S7: refund gives back exactly one unit and never goes below zero or creates a key", async () => {
  const store = createMemoryStore();
  const cfg = { windowMs: 60_000, max: 2 };
  assert.equal((await checkRateLimitAsync("q", cfg, store)).allowed, true);
  assert.equal((await checkRateLimitAsync("q", cfg, store)).allowed, true);
  assert.equal((await checkRateLimitAsync("q", cfg, store)).allowed, false);
  await refundRateLimitAsync("q", store);
  await refundRateLimitAsync("q", store);
  assert.equal((await checkRateLimitAsync("q", cfg, store)).allowed, true, "refunded units are usable again");
  // Refunding an unknown key is a no-op (no negative credit banked).
  for (let i = 0; i < 5; i++) await refundRateLimitAsync("never-hit", store);
  const fresh = { windowMs: 60_000, max: 1 };
  assert.equal((await checkRateLimitAsync("never-hit", fresh, store)).allowed, true);
  assert.equal((await checkRateLimitAsync("never-hit", fresh, store)).allowed, false);
});

test("S7: the refund Lua script never creates a key and never goes negative (static check)", async () => {
  const { REFUND_LUA } = await import("../../lib/rate-limit");
  assert.match(REFUND_LUA, /if c > 0 then/);
  assert.doesNotMatch(REFUND_LUA, /INCR|SET\b|PEXPIRE/);
});

// ─── A7: application workflow ──────────────────────────────────────────

test("A7: forbidden transitions (Rejected → Hired/Interview, New → Hired, anything → New)", () => {
  assert.equal(canTransitionApplication("REFUSE", "EMBAUCHES"), false);
  assert.equal(canTransitionApplication("REFUSE", "ENTRETIEN"), false);
  assert.equal(canTransitionApplication("NOUVEAU", "EMBAUCHES"), false);
  for (const s of APPLICATION_STATUSES) {
    if (s !== "NOUVEAU") assert.equal(canTransitionApplication(s, "NOUVEAU"), false, `${s} → NOUVEAU`);
  }
  assert.equal(canTransitionApplication("BOGUS", "REFUSE"), false);
  assert.equal(canTransitionApplication("REFUSE", "BOGUS"), false);
});

test("A7: allowed transitions and same-status no-ops", () => {
  assert.equal(canTransitionApplication("NOUVEAU", "EN_COURS_EXAMEN"), true);
  assert.equal(canTransitionApplication("EN_COURS_EXAMEN", "ENTRETIEN"), true);
  assert.equal(canTransitionApplication("ENTRETIEN", "EMBAUCHES"), true);
  assert.equal(canTransitionApplication("REFUSE", "EN_COURS_EXAMEN"), true, "reconsider via review");
  assert.equal(canTransitionApplication("EMBAUCHES", "REFUSE"), true, "offer withdrawn");
  for (const s of APPLICATION_STATUSES) assert.equal(canTransitionApplication(s, s), true);
  assert.deepEqual(statusOptionsFrom("REFUSE"), ["EN_COURS_EXAMEN", "REFUSE"]);
});

// ─── S5: own-storage image URLs ────────────────────────────────────────

test("S5: only https public image buckets of this app's Supabase project are accepted", () => {
  const hosts = trustedStorageHosts("https://stagingref.supabase.co");
  const ok = (u: string) => isOwnStorageImageUrl(u, hosts);
  assert.equal(ok("https://hvbbactmgfhecqbetlhg.supabase.co/storage/v1/object/public/logos/u/a.webp"), true);
  assert.equal(ok("https://stagingref.supabase.co/storage/v1/object/public/avatars/u/a.webp"), true);
  for (const bad of [
    "javascript:alert(1)",
    "http://hvbbactmgfhecqbetlhg.supabase.co/storage/v1/object/public/logos/u/a.webp",
    "https://evil.supabase.co/storage/v1/object/public/logos/u/a.webp",
    "https://hvbbactmgfhecqbetlhg.supabase.co.evil.example/storage/v1/object/public/logos/a.webp",
    "https://hvbbactmgfhecqbetlhg.supabase.co:8443/storage/v1/object/public/logos/u/a.webp",
    "https://user:pw@hvbbactmgfhecqbetlhg.supabase.co/storage/v1/object/public/logos/u/a.webp",
    "https://hvbbactmgfhecqbetlhg.supabase.co/storage/v1/object/public/cv/u/cv.pdf",
    "https://hvbbactmgfhecqbetlhg.supabase.co/storage/v1/object/sign/logos/u/a.webp",
    "https://hvbbactmgfhecqbetlhg.supabase.co/storage/v1/object/public/logos/",
    "https://hvbbactmgfhecqbetlhg.supabase.co/storage/v1/object/public/logos/%2e%2e/cv/x.pdf",
    "https://evil.example/pixel.png",
    "data:image/png;base64,AAAA",
  ]) {
    assert.equal(ok(bad), false, bad);
  }
  // A non-Supabase env value never widens the list.
  assert.deepEqual(trustedStorageHosts("https://evil.example"), ["hvbbactmgfhecqbetlhg.supabase.co"]);
});

// ─── A1: profile completeness ──────────────────────────────────────────

test("A1: phone and location are required, plus at least 50% of sections", () => {
  const base = { skillsCount: 0, languagesCount: 0, experiencesCount: 0 };
  assert.deepEqual(candidateCompleteness({ ...base, firstName: "A", lastName: "B" }).missingRequired, ["phone", "location"]);
  const minimal = candidateCompleteness({ ...base, phone: "1", location: "Tunis" });
  assert.equal(minimal.canApply, false, "22% is below 50%");
  const enough = candidateCompleteness({ ...base, firstName: "A", lastName: "B", phone: "1", location: "Tunis", headline: "Agent" });
  assert.equal(enough.percent, 56);
  assert.equal(enough.canApply, true);
  assert.equal(candidateCompleteness({ ...base, phone: "   ", location: "x", firstName: "a", lastName: "b", headline: "h" }).canApply, false, "blank phone");
});

// ─── U3: structured data ───────────────────────────────────────────────

const JOB = {
  title: "Agent </script><script>alert(1)</script>",
  slug: "agent-1",
  description: "Great job & benefits",
  contractType: "CDI",
  isRemote: false,
  customLocation: "Tunis",
  applicationType: "INTERNAL",
  publishedAt: new Date("2026-11-01T10:00:00Z"),
  createdAt: new Date("2026-10-30T10:00:00Z"),
  expiresAt: new Date("2026-12-01T10:00:00Z"),
  company: { name: "Alpha", slug: "alpha", website: "https://alpha.example", logoUrl: null, location: "Tunis" },
};

test("U3: JobPosting has the required fields and never invents data", () => {
  const ld = buildJobPostingJsonLd(JOB);
  assert.equal(ld["@type"], "JobPosting");
  assert.equal(ld.datePosted, "2026-11-01T10:00:00.000Z");
  assert.equal(ld.validThrough, "2026-12-01T10:00:00.000Z");
  assert.equal(ld.employmentType, "FULL_TIME");
  assert.equal(ld.directApply, true);
  assert.deepEqual(ld.jobLocation, { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: "Tunis" } });
  assert.equal("baseSalary" in ld, false, "no salary unit is stored, so no salary is claimed");
  const remote = buildJobPostingJsonLd({ ...JOB, isRemote: true, customLocation: "Remote", company: { ...JOB.company, location: null } });
  assert.equal(remote.jobLocationType, "TELECOMMUTE");
  assert.equal("jobLocation" in remote, false);
});

test("U3: serialized JSON-LD cannot close its <script> element", () => {
  const out = serializeJsonLd(buildJobPostingJsonLd(JOB));
  assert.equal(out.includes("</script"), false);
  assert.equal(out.includes("<"), false);
  assert.equal(out.includes("&"), false);
  assert.deepEqual(JSON.parse(out).title, JOB.title, "still valid JSON with the original text");
});

// ─── N1: seed guard ────────────────────────────────────────────────────

test("N1: seeds refuse the production database (no override) and unconfirmed remote databases", () => {
  assert.throws(() => assertSeedTargetAllowed("postgresql://u:p@db.hvbbactmgfhecqbetlhg.supabase.co:5432/postgres", {}), /PRODUCTION/);
  assert.throws(
    () =>
      assertSeedTargetAllowed("postgresql://postgres.hvbbactmgfhecqbetlhg:p@aws-0.pooler.supabase.com:6543/postgres", {
        SEED_ALLOW_DATABASE_HOST: "aws-0.pooler.supabase.com",
      }),
    /PRODUCTION/,
    "the production ref in the user name is detected too"
  );
  assert.throws(() => assertSeedTargetAllowed("postgresql://u:p@staging.example:5432/db", {}), /non-local/);
  assert.doesNotThrow(() =>
    assertSeedTargetAllowed("postgresql://u:p@staging.example:5432/db", { SEED_ALLOW_DATABASE_HOST: "staging.example" })
  );
  assert.doesNotThrow(() => assertSeedTargetAllowed("postgresql://u:p@localhost:5432/db", {}));
  assert.throws(() => requireSeedPassword({}), /SEED_TEST_PASSWORD/);
  assert.throws(() => requireSeedPassword({ SEED_TEST_PASSWORD: "short" }), /12 characters/);
  assert.equal(requireSeedPassword({ SEED_TEST_PASSWORD: "a-long-test-password" }), "a-long-test-password");
});

// The rules live in one pure function (tests/helpers/seed-credential-scan.ts)
// and are proven on small synthetic fixtures, so this test never depends on
// gitignored local load-test files (Release Gate 0, finding G0-6).
const SAFE_GENERATOR_FIXTURE = [
  "const TEST_PASSWORD = process.env.K6_TEST_PASSWORD;",
  "if (!TEST_PASSWORD) { console.error('K6_TEST_PASSWORD is required'); process.exit(1); }",
  "const email = `candidate${i}@cxjobs.test`;",
].join(String.fromCharCode(10));

test("N1: the credential rules flag each unsafe pattern in synthetic fixtures", () => {
  const cases: Array<[string, string]> = [
    ['const TEST_PASSWORD = "synthetic-not-a-real-pw";', "hard-coded-password"],
    ["const PASSWORD = 'synthetic-not-a-real-pw';", "hard-coded-password"],
    ["const TEST_PASSWORD = process.env.K6_TEST_PASSWORD || 'synthetic-fallback';", "fallback-password-literal"],
    ["const pw = process.env.K6_COMPANY_PASSWORD ?? `synthetic-fallback`;", "fallback-password-literal"],
    ["const email = `user${i}@gmail.com`;", "real-mail-domain"],
  ];
  for (const [fixture, expected] of cases) {
    assert.ok(findSeedCredentialProblems(fixture).includes(expected as never), `${expected}: ${fixture}`);
  }
  assert.deepEqual(findSeedCredentialProblems(SAFE_GENERATOR_FIXTURE), [], "a compliant generator passes");
});

test("N1: no shared test password remains in the tracked seed and session generator", async () => {
  const fs = await import("node:fs");
  // Tracked files only: they always exist in CI. A missing file throws and
  // FAILS the test (it is never skipped). The gitignored local load-test
  // files (prisma/seed-k6.ts, tests/k6/generate-company-sessions.js, ...)
  // are covered by the same rules through the fixtures above.
  for (const f of ["prisma/seed.ts", "tests/k6/generate-candidate-sessions.js"]) {
    const src = fs.readFileSync(f, "utf8");
    assert.deepEqual(findSeedCredentialProblems(src), [], f);
  }
});

// ─── A2 / S7: environment warnings ─────────────────────────────────────

test("A2: production without a strong CRON_SECRET warns (by name only)", () => {
  const r = validateEnv({ NODE_ENV: "production", CRON_SECRET: "short" } as NodeJS.ProcessEnv, "production");
  assert.ok(r.warnings.some((w) => w.names.includes("CRON_SECRET")));
  assert.equal(JSON.stringify(r).includes("short"), false, "values are never echoed");
  const ok = validateEnv({ NODE_ENV: "production", CRON_SECRET: "x".repeat(32) } as NodeJS.ProcessEnv, "production");
  assert.equal(ok.warnings.some((w) => w.names.includes("CRON_SECRET")), false);
});

// ─── A3: headers ───────────────────────────────────────────────────────

function loadHeaders(): Array<{ source: string; headers: { key: string; value: string }[] }> {
  const res = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "-e",
      "import('./next.config.ts').then(async (m) => { const c = await (m.default.default ?? m.default); console.log('JSON:' + JSON.stringify(await c.headers())); })",
    ],
    { env: { ...process.env, NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "" }, encoding: "utf8", timeout: 60_000 }
  );
  const line = res.stdout.split("\n").find((l) => l.startsWith("JSON:"));
  assert.ok(line, `config did not load: ${res.stderr}`);
  return JSON.parse(line!.slice(5));
}

test("A3: every page gets frame protection, nosniff and a staged full CSP; production CSP has no unsafe-eval", () => {
  const rules = loadHeaders();
  const page = rules.find((r) => r.source === "/((?!api/).*)")!;
  const get = (k: string) => page.headers.find((h) => h.key === k)?.value ?? "";
  assert.equal(get("X-Frame-Options"), "DENY");
  assert.equal(get("X-Content-Type-Options"), "nosniff");
  assert.match(get("Content-Security-Policy"), /frame-ancestors 'none'/);
  const ro = get("Content-Security-Policy-Report-Only");
  assert.match(ro, /default-src 'self'/);
  assert.match(ro, /script-src 'self'/);
  assert.match(ro, /object-src 'none'/);
  assert.doesNotMatch(ro, /unsafe-eval/);
  assert.doesNotMatch(ro, /\*/);
  const all = rules.find((r) => r.source === "/(.*)")!;
  assert.equal(all.headers.find((h) => h.key === "Referrer-Policy")?.value, "strict-origin-when-cross-origin");
});

// ─── Migrations: the A6/A7 migration is purely additive ────────────────

test("A6/A7: the new migration only creates (no DROP, no ALTER of existing columns, no data rewrite)", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = fs.readdirSync("prisma/migrations").find((d) => d.endsWith("_slug_redirects_status_history_notifications"));
  assert.ok(dir, "migration present");
  const sql = fs
    .readFileSync(path.join("prisma/migrations", dir!, "migration.sql"), "utf8")
    .replace(/--.*$/gm, "");
  assert.doesNotMatch(sql, /\bDROP\b/i);
  assert.doesNotMatch(sql, /\b(UPDATE|DELETE|TRUNCATE)\b(?!\s+(CASCADE|SET NULL))/i);
  assert.doesNotMatch(sql, /ALTER TABLE "(users|applications|companies|job_offers)" (ALTER|DROP|RENAME)/i);
  for (const t of ["company_slug_redirects", "application_status_history", "notifications"]) {
    assert.match(sql, new RegExp(`CREATE TABLE "${t}"`));
  }
  const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
  for (const m of ["CompanySlugRedirect", "ApplicationStatusHistory", "Notification"]) assert.match(schema, new RegExp(`model ${m} \{`));
  // Ordering: lexically after every earlier migration (Prisma applies in name order).
  const all = fs.readdirSync("prisma/migrations").filter((d) => /^\d{14}_/.test(d)).sort();
  assert.equal(all.at(-1), dir);
});

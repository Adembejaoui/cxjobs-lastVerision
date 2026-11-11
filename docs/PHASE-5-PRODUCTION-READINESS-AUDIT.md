# Phase 5: Comprehensive production readiness deep audit (audit only)

- **Date:** 2026-11-10
- **Subject:** the working tree on `hardening/production-readiness` (HEAD `6e77684` plus uncommitted Phase 1–4A changes), read as it stands.
- **Method:** static review of code, configuration, tests and documentation, with file and function evidence; safe local checks (§H).
- **Excluded by instruction:** seed scripts and seed data, test accounts/companies/jobs, commit readiness and Git history, deployment. Phase 4B findings N1 (seed accounts) and N3/B1 (untracked files) are therefore **not re-assessed here**. They remain recorded in `docs/PHASE-4B-AUDIT.md`.
- **Safety:** no source, configuration, schema, migration, test or dependency was changed. No database, Supabase, Upstash, Resend, Google, OpenAI or Vercel service was contacted. No secret was printed. Only this file and `docs/PRODUCTION-READINESS-AUDIT.md` were written.

Statuses: **PASS** (implemented correctly, with code and/or test evidence) · **PARTIAL** (implemented with a gap) · **FAIL** (missing or incorrect) · **NOT VERIFIED** (depends on an external system that was not tested).

---

## A. Executive summary

### Verdict: **NOT PRODUCTION-READY** (code: largely ready; infrastructure: unverified)

| Layer | Readiness |
|---|---|
| Application security (authZ, IDOR, mass assignment, tokens, files, SSRF) | **PASS**, strong. Every route self-guards; 408/409 local tests pass, and the one failure is a load-sensitive timing test (F-33) |
| Business logic and data integrity | **PARTIAL**: suspension doesn't take a company's jobs offline; application status has no transition rules; no audit trail |
| Reliability and observability | **FAIL**: no error tracking, alerting or structured audit log; no `maxDuration`; no scheduled expiry |
| Performance at scale | **PARTIAL / NOT VERIFIED**: search indexes are not applied yet; per-request Redis read; connection-limit headroom unknown |
| External infrastructure (Supabase, Upstash, Resend, Google, OpenAI, Vercel) | **NOT VERIFIED**; no isolated test environment exists |

**Critical production blockers (P0)** — no P0 *code* defect was found. The P0 items are unverified infrastructure on which data privacy depends:
- **F-01:** CV bucket privacy is not verified, and an earlier report described it as public.
- **F-02:** the database migrations required by the code are not applied, and drift is unverified. Without the `sessionVersion` column, every authenticated request fails.

**High-priority risks (P1):**
- **F-03:** no error monitoring or alerting.
- **F-04:** a suspended company's jobs stay public and keep receiving applications and CVs.
- **F-05:** email delivery is unverified and likely unconfigured, so password reset and verification are effectively unavailable, and with verification off, email ownership is never proven.
- **F-06:** AI/PDF route budgets exceed the possible default function limits (no `maxDuration`).
- **F-07:** existing duplicate emails lock users out (data unverified).
- **F-08:** Redis behaviour is not verified on Upstash, and an outage disables login.
- **F-09:** the local Prisma CLI targets the Supabase database.

**Medium (P2):**
- No admin audit trail.
- Application status transitions are unrestricted.
- Orphaned storage objects are never deleted.
- Unbounded text and array input.
- Lockout DoS on per-account login limits.
- IPv6 rate-limit granularity.
- Unthrottled heavy writes.
- The page CSP has no `script-src`.
- Untested DELETE and duplicate-apply paths.
- No scheduled expiry.
- The unused `PUT /api/dashboard/company`.
- A per-request Redis read.
- Pool and connection headroom unknown.
- No Postgres-backed or browser tests.
- Node version not pinned.
- A flaky PDF-timeout test (F-33).

**Implemented correctly:**
- Server-side authorization on every route; DB-derived roles for admin routes.
- Ownership checks against the DB company.
- Allow-listed fields, so mass assignment is blocked.
- Private-bucket CV design with 60 s signed URLs after authorization.
- Content-sniffed uploads with server-chosen paths.
- An isolated, bounded PDF parser.
- SSRF-hardened scraping.
- Bounded AI calls.
- Hashed, single-use, expiring tokens delivered in URL fragments.
- `sessionVersion` revocation.
- Enumeration-safe auth responses.
- Atomic Lua rate limits with explicit fail modes.
- Redacting logger, generic errors, security headers.
- No raw-HTML rendering.
- Pagination clamped to 100.
- Streaming Excel export.
- The onboarding-loop fix.
- A DB-free build.

---

## B. Findings

Each finding lists its area, severity, status and evidence (file paths and functions), then the problem, its impact, the recommendation and how to verify the fix.

### P0: must be resolved before launch

**F-01 · Storage · P0 · NOT VERIFIED** — The `cv` bucket's visibility and policies are unknown.
- **Evidence:** the code assumes a private bucket: `lib/supabase.ts:198-209` (`getPublicUrl` refuses `cv`), `lib/server/cv-download.ts`, `lib/security/cv-access.ts:12` (60 s TTL). Earlier audit: "production `cv` bucket reported public". `docs/security/PRODUCTION_READINESS.md` §2 claims a "cxjobs-test" verification that conflicts with "no test project exists".
- **Problem:** if the bucket is public, every stored object path is a permanent anonymous CV link. Paths reach companies through application lists, export and `GET /api/dashboard/company`. Legacy rows may hold full public URLs.
- **Impact:** personal-data exposure that no code can revoke.
- **Recommendation:** read-only SQL (`PHASE-4B-AUDIT.md` §8.3); with approval, make the bucket private and drop any `cv` policies for `anon`/`authenticated`.
- **Verification:** `storage.buckets.public = false`; zero `cv` policies; `…/object/public/cv/<path>` returns 400/404; the authorized route returns a 302 whose URL expires after about 60 s.

**F-02 · Database · P0 · NOT VERIFIED** — Required migrations are not applied, and schema drift is unknown.
- **Evidence:** `prisma/migrations/20261109120000_add_user_session_version` (selected on every authenticated request by `lib/auth-user-record.ts`) and `…130000_restore_trigram_search_indexes`. `20261012143343` notes an earlier `db push`. There is no shadow-DB diff.
- **Problem:** code deployed before migration 1 means every session fails. Without migration 2, catalogue search sequential-scans. Unknown drift can break `migrate deploy`.
- **Impact:** full authentication outage, or slow search.
- **Recommendation:** read-only `prisma migrate status` plus the size check; `migrate deploy` only, before the code goes live; create the trigram indexes `CONCURRENTLY` by hand first if the tables are large.
- **Verification:** `migrate status` clean; column present with default 0; 5 `*_trgm` indexes; `EXPLAIN` shows a Bitmap Index Scan.

### P1: should fix before launch

**F-03 · Observability · P1 · FAIL** — No error tracking, alerting or uptime monitoring.
- **Evidence:** no Sentry, Logtail, OTel or Vercel Analytics in `package.json`. `lib/logger.ts` writes pino JSON to stdout only. `/api/health` exists but nothing polls it. `app/error.tsx` and `global-error.tsx` show a digest only.
- **Problem:** production failures are only visible by reading Vercel runtime logs by hand, and log retention depends on the plan.
- **Impact:** outages, auth failures and limiter fail-closed states go unnoticed; incidents can't be diagnosed after retention expires.
- **Recommendation:** add an error tracker with PII scrubbing (`sendDefaultPii: false`, using the existing redaction list) or a Vercel log drain; an uptime check on `/api/health`; alerts on 5xx rate, "Rate limiter backend error" and "Database pool error".
- **Verification:** a forced staging error appears in the tracker without personal data, and an alert fires.

**F-04 · Business logic · P1 · FAIL** — Suspending a company doesn't take its jobs offline.
- **Evidence:** no `isActive` filter in the catalogue (`app/api/job-offers/route.ts:39-53`), on job detail, `companies/[slug]`, or in `POST /api/application` (`app/api/application/route.ts:24-30` checks only the job's `deletedAt`/`status`/`expiresAt`). `companies.deletedAt` and `users.deletedAt` exist but are never set (repo-wide search).
- **Problem:** a suspended (e.g. fraudulent) company stays listed, and candidates keep applying and attaching CVs to it.
- **Impact:** candidate data flows to an account the platform has blocked.
- **Recommendation:** filter `company: { users: { isActive: true }, deletedAt: null }` in the public queries and the apply check, or close the jobs inside the suspension transaction (`app/api/admin/users/[id]/route.ts`); invalidate the job cache tags.
- **Verification:** an integration test suspends company A, then checks that A's jobs are absent from the list, detail and company page, and that apply returns 404.

**F-05 · Email · P1 · NOT VERIFIED** — Email is likely unconfigured, so reset and verification don't work and ownership is never proven.
- **Evidence:** `lib/email/index.ts:101-107` defaults to `disabled`. The local `.env` has no `EMAIL_PROVIDER`, `APP_URL` or `RESEND_*` (key names only). `REQUIRE_EMAIL_VERIFICATION` is off by default (`lib/auth-callbacks.ts`). There is no retry (`createResendTransport`, 8 s timeout).
- **Problem:** if production matches the local file, no email is ever sent while users see "check your inbox". Anyone can register with someone else's address, and the real owner can't reclaim it, because reset mail never arrives.
- **Impact:** a broken account-recovery path, and accounts squatted under other people's addresses.
- **Recommendation:** configure Resend per environment (verified domain, SPF/DKIM); confirm the startup validation warns nothing; once delivery works, enable verification with a grandfathering plan; consider one retry on 5xx or timeout.
- **Verification:** reset, verify and "account exists" mails arrive on staging with `#token=` links on the staging host; no tokens in logs.

**F-06 · External / Vercel · P1 · NOT VERIFIED** — Function duration settings aren't declared anywhere.
- **Evidence:** no `maxDuration` export and no `vercel.json`. Route budgets: `scrape-from-url` 22 s (`ROUTE_TIMEOUT_MS`), `generate-with-ai` 45 s (`AI_ROUTE_DEADLINE_MS`). `onboarding/cv-parse` has no route deadline: PDF 10 s (`lib/server/pdf-text-worker.ts`) plus AI 20 s × 2 attempts (`lib/ai-service.ts:15-16`).
- **Problem:** on non-Fluid default limits (10/15 s), the platform kills these routes, and the client gets an unhandled 504 instead of the app's error.
- **Impact:** AI features and CV autofill fail under normal latency.
- **Recommendation:** check the plan and Fluid setting; export `maxDuration = 60` on the three routes; give cv-parse an overall deadline.
- **Verification:** staging calls with a slowed AI stub finish with the app's 504 JSON, not a platform timeout.

**F-07 · Auth / data · P1 · NOT VERIFIED** — Existing case-variant duplicate accounts break login.
- **Evidence:** `lib/server/user-email.ts` (`findUserByEmail` returns null when ambiguous; an exact match wins); `users.email @unique` is case-sensitive (`schema.prisma:13`).
- **Problem:** two variants with no lowercase row means the person is locked out (login, reset and Google). A lowercase row plus a variant leaves the variant's data unreachable.
- **Impact:** user lockout and orphaned accounts.
- **Recommendation:** read-only counts (`PHASE-4B-AUDIT.md` §8.4), resolve manually, then a `lower(email)` migration with a unique index.
- **Verification:** the counts are 0, and the unique index exists.

**F-08 · Redis · P1 · NOT VERIFIED** — Rate limiting and revocation have never run on Upstash.
- **Evidence:** `lib/rate-limit.ts:69-90` (`FIXED_WINDOW_LUA`, `EVAL`) and `lib/server/session-revocation.ts:30-40` (`PUBLISH_MAX_LUA`); tested only against a local REST fake (`tests/integration/redis-upstash.test.ts`). Login, register, reset and AI limits are fail-closed by design.
- **Problem:** if `EVAL` isn't permitted, or the token or URL is wrong, every fail-closed limiter denies requests.
- **Impact:** login, registration and AI unavailable while the public catalogue still works.
- **Recommendation:** a staging run of audit §7.3; separate Upstash databases per environment; monitor "Rate limiter backend error" (F-03).
- **Verification:** limits trigger at the configured counts; suspension is immediate; deliberately breaking the token on a throwaway Preview gives the designed fail-closed/fail-open split.

**F-09 · Database ops · P1 · FAIL** — The local Prisma CLI targets the Supabase database.
- **Evidence:** the `.env` direct URL classifies as Supabase-hosted, port 5432 (value not printed). `prisma.config.ts:12` uses it for every CLI command. `package.json` has `db:migrate` (`migrate dev`) and `db:push`.
- **Problem:** a routine `npm run db:migrate` or `db:push` from this checkout acts on the only database. `migrate dev` offers a **reset** on drift.
- **Impact:** a data-loss risk through operator error.
- **Recommendation:** keep production credentials out of the default `.env`; use only `migrate deploy`/`status` against production with an explicitly loaded env file; consider removing `db:push`.
- **Verification:** `npx prisma migrate status` with the default env doesn't reach Supabase.

### P2: important improvements

**F-10 · Auditability · P2 · FAIL** — Admin actions leave no trace.
- **Evidence:** only invitation actions log (`app/api/admin/tokens/**`). Suspension, email change and company edits (`admin/users/[id]`) and admin job edits (`admin/job-offers/[id]`) neither log nor persist anything; there's no audit model in the schema.
- **Problem:** there's no record of who suspended a user or changed a job or email.
- **Impact:** no accountability, and no incident or dispute reconstruction.
- **Recommendation:** an append-only `admin_audit_log` (actor, action, target, changed field names, timestamp), or at minimum a structured log line per action without personal values.
- **Verification:** each admin mutation in tests writes exactly one audit row.

**F-11 · Business logic · P2 · PARTIAL** — Application status changes are unrestricted and last write wins.
- **Evidence:** `app/api/application/[id]/route.ts:204-240` updates `status`/`notes` with no transition rules (`updateApplicationSchema`, `lib/validations/job.ts:245`) and no version check; it also allows updates on soft-deleted jobs. Job transitions *are* enforced (`VALID_TRANSITIONS`, `job.ts:192`).
- **Problem:** EMBAUCHES → NOUVEAU is allowed; two recruiters overwrite each other's notes without warning.
- **Impact:** inconsistent hiring state and lost notes.
- **Recommendation:** define allowed application transitions; optimistic concurrency (`where: { id, updatedAt }`); refuse writes on deleted jobs (or document that it's allowed).
- **Verification:** unit tests for the transitions; a test where two updates race and one gets a 409.

**F-12 · Storage · P2 · FAIL** — Orphaned and replaced files are never deleted.
- **Evidence:** `DELETE /api/upload` exists (`app/api/upload/route.ts:401`) but no client calls it (repo-wide search). Replacing a CV only overwrites `resumeUrl` (`app/api/profile/route.ts:612-620`). Applications snapshot `cvUrl` (`app/api/application/route.ts:344`).
- **Problem:** every replaced or abandoned CV and image stays in storage forever. Deleting on replace would break past applications.
- **Impact:** storage growth, and CVs kept indefinitely (a data-retention and privacy obligation).
- **Recommendation:** a retention policy; a periodic job that deletes objects referenced by no `resumeUrl`/`cvUrl`/image column (after a grace period).
- **Verification:** a dry-run report of unreferenced objects on staging.

**F-13 · API · P2 · PARTIAL** — Text and array lengths are unbounded.
- **Evidence:** `lib/validations/job.ts:39,51,101,113` (job `description`, `requirements[]`); `profile.ts` has 41 `z.string()` against 4 `.max()`. Profile relation arrays are synced with **one UPDATE per row** inside an interactive transaction (`app/api/profile/route.ts:180,246,294,343`).
- **Problem:** multi-MB descriptions, or thousands of skills, are accepted (limited only by the ≈4.5 MB platform body limit). Large arrays can exceed Prisma's interactive-transaction timeout (5 s by default).
- **Impact:** storage and render bloat, slow pages, failed saves, DB load.
- **Recommendation:** `.max()` on every free-text field and array (e.g. 20k characters for descriptions, 50 items per array).
- **Verification:** schema tests for over-long input return 400.

**F-14 · Rate limiting · P2 · PARTIAL** — The per-account login limit enables lockout, and IPv6 rotation bypasses per-IP limits.
- **Evidence:** `lib/auth.ts:58-59` (`LOGIN_ACCOUNT_LIMIT` 10 per 15 min across all IPs); `lib/utils.ts:187-207` (`getClientIp` keys the full address).
- **Problem:** anyone can keep a victim's login blocked indefinitely (NF-11). One IPv6 /64 provides practically unlimited distinct per-IP keys.
- **Impact:** targeted denial of login; per-IP limits are weak against IPv6 attackers (per-account and per-email limits still hold).
- **Recommendation:** key IPv6 by /64; consider limits keyed by account plus IP prefix, or a CAPTCHA after N failures, instead of a hard account block.
- **Verification:** unit tests for /64 normalization and the lockout behaviour.

**F-15 · Rate limiting · P2 · PARTIAL** — Heavy writes and some public reads are unthrottled.
- **Evidence:** no `checkRateLimit` in `profile` (POST: transactional multi-table writes), `application/[id]` (PUT), `onboarding`, `admin/users`, `admin/users/[id]`, `admin/job-offers/[id]`, `candidate/cv/export`, `company/benefits`, `dashboard/*`, `job-offers/expire`, or the public `companies/[slug]`, `profile/allCompanies` and `health`. Public routes are CDN-cacheable (`s-maxage=60`); `health` is cached 15 s per instance.
- **Problem:** an authenticated user can hammer the expensive profile transaction; public uncached variants (query-string permutations) reach the DB.
- **Impact:** DB load and a cost amplification vector.
- **Recommendation:** per-user limits on profile/application writes; per-IP limits on `allCompanies` and `companies/[slug]`.
- **Verification:** tests return 429 at the limit.

**F-16 · Headers · P2 · PARTIAL** — The page CSP has no script policy.
- **Evidence:** `next.config.ts` page CSP is `frame-ancestors 'none'; base-uri 'self'; object-src 'none'` (no `script-src`/`default-src`). `/api` has a strict CSP. No `dangerouslySetInnerHTML` anywhere (repo-wide search).
- **Problem:** there's no defence in depth if an XSS sink is ever introduced.
- **Impact:** less mitigation against future XSS.
- **Recommendation:** a nonce-based `script-src` (Next middleware or `headers()`); start in Report-Only.
- **Verification:** no CSP violations in Report-Only mode on staging, then enforce.

**F-17 · Tests · P2 · FAIL** — Several destructive and race paths have no test.
- **Evidence:** no test calls `DELETE` on `job-offers/[jobId]` or `upload` (`grep "\.DELETE(" tests/` returns nothing). There's no duplicate-application (P2002) test, no concurrency test against a real DB, no Postgres-backed test (all integration tests use `tests/integration/fake-prisma.ts`), and no browser or E2E tests.
- **Problem:** soft delete, ownership on delete, idempotent duplicate apply, unique constraints and transaction isolation are unverified.
- **Impact:** regressions in data-changing paths would go unnoticed.
- **Recommendation:** add DELETE and duplicate-apply tests; a CI job against an ephemeral Postgres (service container) for constraint and transaction tests; minimal Playwright smoke tests for the three journeys.
- **Verification:** the new tests run in CI.

**F-18 · Business logic · P2 · PARTIAL** — Expiry is not scheduled.
- **Evidence:** `POST /api/job-offers/expire` is admin-only and manual; there's no Vercel cron (no `vercel.json`). Readers check `expiresAt` (`app/api/application/route.ts:29`, the catalogue).
- **Problem:** expired jobs keep `status = PUBLISHED`; any reader that checks only `status` (counts, analytics) overstates active jobs.
- **Impact:** inaccurate dashboards; correctness depends on every query remembering `expiresAt`.
- **Recommendation:** a Vercel cron calling an expire endpoint authenticated by `CRON_SECRET`.
- **Verification:** the cron run closes the seeded expired jobs on staging.

**F-19 · API · P2 · PARTIAL** — `PUT /api/dashboard/company` is unused and weaker than the supported path.
- **Evidence:** `app/api/dashboard/company/route.ts:268+`: no client caller; it replaces **all** benefits (cascading `JobOfferBenefit`), `linkedinUrl` is unvalidated, non-JSON returns 500, and authorization uses the JWT role. URL schemes were fixed in 4A.
- **Problem:** a second, divergent write path for company profiles.
- **Impact:** data loss of job↔benefit links, and an extra attack surface.
- **Recommendation:** remove it (use `POST /api/profile`).
- **Verification:** 405 on PUT, and the tests are updated.

**F-20 · Performance · P2 · NOT VERIFIED** — Per-request Redis read, plus pool and connection headroom.
- **Evidence:** `lib/auth-callbacks.ts` `getPublishedSessionVersion` (300 ms timeout) runs on every authenticated request. `lib/prisma.ts` uses `max: 2` per instance with the Supabase transaction pooler (6543). bcrypt cost 12 for register and reset (`app/api/auth/register/route.ts:100`).
- **Problem:** see §7 below for how this scales.
- **Impact:** latency, Upstash cost, pooler saturation at about 500–1,000 concurrent users.
- **Recommendation:** measure on staging (k6 at 100/500/1,000 virtual users, staging only); a short per-instance cache of the revocation version; check the Supavisor client limit for the plan.
- **Verification:** p95 targets in audit §7.7 met on staging.

**F-21 · Vercel · P2 · FAIL** — The Node version is not pinned.
- **Evidence:** no `engines`, `.nvmrc` or `.node-version`; CI uses Node 22 (`.github/workflows/ci.yml:45`); local Node is 24.14.1.
- **Problem:** the runtime depends on the Vercel project setting.
- **Impact:** behaviour drift (the worker thread, `sharp`).
- **Recommendation:** `"engines": {"node": "22.x"}` plus the Vercel setting.
- **Verification:** the build log shows Node 22.

**F-22 · Pagination · P2 · PARTIAL** — The page number is unbounded.
- **Evidence:** `lib/utils.ts:28-40` (`parsePaginationParams` clamps `limit` ≤ 100 but not `page`).
- **Problem:** `page=10000000` produces a huge `OFFSET`; Postgres scans and discards every matching row.
- **Impact:** a cheap way to force expensive queries on public lists (mitigated by the CDN cache).
- **Recommendation:** clamp `page` (e.g. ≤ 1,000), or switch to cursor pagination.
- **Verification:** unit test.

### P3: post-launch

**F-23 · Validation · P3 · PARTIAL** — Zod strips unknown keys instead of rejecting them.
- **Evidence:** 0 `.strict()` in `lib/validations/*`.
- **Problem:** typos and mass-assignment attempts are silently ignored.
- **Impact:** none for security (fields are mapped explicitly; tested).
- **Recommendation:** `.strict()` on write schemas.
- **Verification:** tests.

**F-24 · Auth · P3 · PARTIAL** — Long JWT lifetime, and logout is client-side only.
- **Evidence:** `lib/auth.ts` session `maxAge: 30 days`; `signOut()` clears the cookie only.
- **Problem:** a stolen cookie stays valid for up to 30 days unless `sessionVersion` is bumped.
- **Impact:** a longer window for session theft.
- **Recommendation:** a shorter `maxAge` or idle timeout; a "sign out everywhere" action that bumps `sessionVersion`.
- **Verification:** tests.

**F-25 · Auth UX · P3 · FAIL** — There's no in-app password change.
- **Evidence:** no change-password route or component (repo-wide search).
- **Problem:** users must use the email reset flow, which depends on F-05.
- **Impact:** account hygiene.
- **Recommendation:** add a change-password flow (current password plus a `sessionVersion` bump).
- **Verification:** tests.

**F-26 · AI · P3 · PARTIAL** — AI output is not schema-validated.
- **Evidence:** `lib/ai-service.ts:209,371,497` uses `JSON.parse` with loose mapping; `extractJobFromUrlText` returns the raw object.
- **Problem:** malformed model output reaches the client as prefill (all writes are re-validated server-side).
- **Impact:** UI errors only.
- **Recommendation:** a zod schema for each AI output.
- **Verification:** unit tests with malformed output.

**F-27 · Privacy · P3 · PARTIAL** — CV text goes to OpenAI, and logs hold some personal data.
- **Evidence:** `lib/ai-service.ts:274` (CV text truncated to 8k characters and sent); `admin/tokens` logs `companyEmail`.
- **Problem:** third-party processing of personal data, and emails in logs.
- **Impact:** a privacy-notice and data-processing obligation.
- **Recommendation:** document it in the privacy policy; drop emails from log fields.
- **Verification:** review.

**F-28 · Health · P3 · PARTIAL** — The OpenAI "check" is configuration only.
- **Evidence:** `app/api/health/route.ts:80` returns healthy when a key is set.
- **Problem:** it reports healthy without contacting the provider.
- **Impact:** misleading status.
- **Recommendation:** label it "configured".
- **Verification:** review.

**F-29 · Frontend performance · P3 · PARTIAL** — A 1.56 MB `@react-pdf/renderer` chunk.
- **Evidence:** `.next/static/chunks/2icbgfceo1tsy.js`, loaded only by `/dashboard/candidate/cv` (client reference manifest); statically imported in `hooks/use-cv-pdf.tsx:4`.
- **Problem:** a large download on the CV page.
- **Impact:** slow CV page on mobile.
- **Recommendation:** `import()` on the download click.
- **Verification:** bundle size check.

**F-30 · Data model · P3 · PARTIAL** — Dead soft-delete columns, and no account deletion.
- **Evidence:** `users.deletedAt` and `companies.deletedAt` are never written. FK cascades (`schema.prisma:133,268,331,332,369`) would erase application history on a hard delete, but no hard delete exists in app code.
- **Problem:** there's no defined lifecycle for deleting a user or company, and no data export.
- **Impact:** an unclear path for data-subject requests; a future hard delete would destroy history.
- **Recommendation:** define deletion and anonymization; change the cascades to `Restrict` or `SetNull` where history matters.
- **Verification:** a design review.

**F-31 · Email consistency · P3 · PARTIAL** — The company-email check is exact-match only.
- **Evidence:** `app/api/profile/route.ts:782`.
- **Problem:** it misses legacy case variants.
- **Impact:** minor.
- **Recommendation:** use `emailIsTaken`.
- **Verification:** test.

**F-32 · UX · P3 · PARTIAL** — Wrong-role users are sent to `/login`.
- **Evidence:** candidate pages, e.g. `app/(dashboard)/dashboard/candidate/page.tsx` (`role !== "CANDIDATE"` → `/login`); the company profile page.
- **Problem:** a signed-in COMPANY that opens a candidate URL lands on the login page.
- **Impact:** confusing.
- **Recommendation:** redirect to `dashboardHomeFor(role)`.
- **Verification:** extend the redirect tests.

**Verified correct (PASS)**, kept here for completeness:
- IP extraction on Vercel uses the platform-set `x-real-ip` and the first `x-forwarded-for` entry, which clients can't spoof behind Vercel (`lib/utils.ts:191-193`). Off Vercel it uses the last hop (NF-17, accepted).
- The Lua scripts are correct and atomic, with TTL repair and a monotonic publish (`lib/rate-limit.ts:69-80`; `session-revocation.ts:30-40`).
- Tokens are 256-bit, SHA-256-hashed, single-use (conditional delete in a transaction) and expiring (reset 1 h, verify 24 h); a reset bumps `sessionVersion` in the same transaction (`lib/security/one-time-token.ts`; `app/api/auth/reset-password/route.ts`).
- Passwords: bcrypt cost 12, minimum length 8, a 256-character cap at login, dummy-hash timing equalization.
- CV access: authorization before signing, a folder-owner check, a 60 s TTL, `no-store`/`no-referrer`; uploads are content-sniffed, under 5 MB, with server-chosen paths; SVG never accepted.
- The PDF parser runs in a worker thread with a 10 s timeout, a 256 MB heap cap and a 30-page/200k-character limit (9 tests).
- SSRF: connect-time DNS guard, 443 only, 3 redirects, 100 KB, timeouts.
- No `dangerouslySetInnerHTML`. Pagination limit clamped to 100. The export streams in 2,000-row chunks. Analytics queries are bounded (`take: 5`). The large client chunk is route-scoped.
- Forms disable submit while saving (signup, login, apply, both profile forms).

---

## C. API route audit (41 routes)

Columns: **Auth** = DB (`getAuthenticatedUser`/`requireAdmin` re-read the user row) · JWT (`auth()` claim; suspension revokes via `sessionVersion`) · public. **RL** = rate-limited. **Tests**: Full = auth, authorization/ownership and validation exercised against the real handler; Partial = gaps noted; Ext = needs external verification as well.

| Route | Methods | Auth | RL | Tests | Findings |
|---|---|---|---|---|---|
| `admin/job-offers` | GET | DB admin | ✓ | Full | — |
| `admin/job-offers/[id]` | PATCH | DB admin | ✗ | Full | Allow-list OK; no audit (F-10) |
| `admin/overview` | GET | DB admin | ✓ | Partial (raw SQL not executed) | — |
| `admin/tokens` | GET, POST | DB admin | ✓ | Full | Logs `companyEmail` (F-27) |
| `admin/tokens/[id]/link` | POST | DB admin | ✓ | Full | — |
| `admin/tokens/[id]/revoke` | POST | DB admin | ✓ | Full | — |
| `admin/users` | GET | DB admin | ✗ | Full | — |
| `admin/users/[id]` | PATCH | DB admin | ✗ | Full (existing suite) | Suspension doesn't hide jobs (F-04); no audit (F-10) |
| `analytics/landing-visitor` | POST | public | ✓ | Full | — |
| `analytics/web-vitals` | POST | public | ✓ (fail-open) | Full | — |
| `application` | GET, POST | JWT | ✓ (POST) | Partial: duplicate P2002 path untested (F-17) | Suspended company still accepts (F-04) |
| `application/[id]` | GET, PUT | JWT | ✗ | Partial: owner happy-path PUT and status transitions untested | F-11, F-15 |
| `application/[id]/cv` | GET | DB | ✓ | Full + **Ext** (bucket) | F-01 |
| `auth/[...nextauth]` | GET, POST | public | login ✓ | Partial: credentials full; Google leg via Auth.js internals only | F-08, Ext Google |
| `auth/forgot-password` | POST | public | ✓ | Full + **Ext** (email) | F-05 |
| `auth/invitation` | POST | public | ✓ | Full | — |
| `auth/register` | POST | public | ✓ | Full + **Ext** (email) | F-05 |
| `auth/reset-password` | POST | public | ✓ | Full | — |
| `auth/verify-email` | POST, PUT | public | ✓ | Full + **Ext** (email) | F-05 |
| `candidate/cv/export` | GET, POST | JWT | ✗ (7-day cooldown) | Full | — |
| `companies/[slug]` | GET | public | ✗ (CDN 60 s) | Full | F-04, F-15 |
| `company/benefits` | GET | JWT | ✗ | Full | — |
| `dashboard/candidate` | GET | JWT | ✗ | Partial (notes-hiding only) | — |
| `dashboard/company` | GET, PUT | JWT | ✗ | Full | F-19 |
| `dashboard/company/analytics` | GET | JWT | ✓ | Partial (auth gates only) | — |
| `health` | GET | public | ✗ (15 s cache) | Partial (leak checks only) + **Ext** | F-28 |
| `job-offers` | GET, POST | JWT / public | ✓ | Full | F-04, F-13, F-22 |
| `job-offers/[jobId]` | GET, PUT, DELETE | JWT | ✓ | **Partial: DELETE untested** (F-17) | — |
| `job-offers/[jobId]/applications` | GET | JWT | ✓ | Full | — |
| `job-offers/[jobId]/applications/export` | GET | JWT | ✓ | Full | — |
| `job-offers/[jobId]/views` | POST | public | ✓ (fail-open) | Full | — |
| `job-offers/by-slug/[slug]` | GET | JWT / public | ✓ | Full | F-04 |
| `job-offers/expire` | POST | JWT admin | ✗ | Full | Manual only (F-18) |
| `job-offers/generate-with-ai` | POST | JWT | ✓ | Full (stubbed AI) + **Ext** | F-06 |
| `job-offers/scrape-from-url` | POST | JWT | ✓ | Full (stubbed AI, local SSRF) + **Ext** | F-06 |
| `onboarding` | POST | JWT + DB re-read | ✗ | Full | — |
| `onboarding/cv-parse` | POST | DB | ✓ | Full (stubbed AI, real parser) + **Ext** | F-06 |
| `profile` | GET, POST | DB | ✗ | Full | F-13, F-15 |
| `profile/allCompanies` | GET | public | ✗ (CDN 60 s) | Full | F-15, F-22 |
| `profile/cv` | GET | DB | ✓ | Full + **Ext** (bucket) | F-01 |
| `upload` | POST, DELETE | DB | ✓ | **Partial: DELETE untested** (F-17) | F-12 |

**Totals:** 32 fully tested (handler-level, fake DB) · 9 partially tested · 0 untested. 10 routes also need external verification. No IDOR or missing authorization check was found on any route. "Fully tested" means tested against the real handler with an in-memory database: no Postgres constraint, transaction-isolation or concurrency semantics (F-17).

---

## D. Critical user journeys

Legend: **C** = verified by code review · **T** = automated test (handler or real server component) · **B** = needs a browser or E2E test (none performed) · **X** = needs an external service.

| Journey | Steps | C | T | B / X needed |
|---|---|---|---|---|
| **Candidate** registration | Enumeration-safe 201, lowercase storage, duplicate → same response | ✓ | ✓ | B; X (verification mail, F-05) |
| Login (credentials / Google) | Limits, suspended refused, case-insensitive; Google never links | ✓ | ✓ (Google via Auth.js internals) | B; X (Google) |
| Onboarding | Server-side completion rules; redirect to `/onboarding/candidate` | ✓ | ✓ | B |
| CV upload / replace | Content sniffing, private path, own-folder references | ✓ | ✓ | B; X (bucket F-01); old file never deleted (F-12) |
| CV autofill | Worker-isolated parse plus AI | ✓ | ✓ (stub AI) | X (OpenAI, Vercel duration F-06) |
| Job search / detail | AND filters, published only, expired → 404 | ✓ | ✓ | B; X (trigram indexes F-02) |
| Apply | Internal, published, unexpired only; duplicate idempotent; logged-out → login → back | ✓ | ✓ except duplicate | B |
| View applications | No recruiter notes | ✓ | ✓ | B |
| Password reset | Fragment token, single use, sessions revoked | ✓ | ✓ | X (email F-05) |
| **Company** registration (invite) | Fragment token, POST validation, atomic consume | ✓ | ✓ | B |
| Company onboarding | Not-onboarded → profile page → save → dashboard (no loop) | ✓ | ✓ (15 tests) | B |
| Company profile | Safe URLs, own benefits, slug uniqueness | ✓ | ✓ | B |
| Create / edit / publish job | Ownership, transitions, EXTERNAL rules, salary rules | ✓ | ✓ | B |
| Delete job | Soft delete, ownership | ✓ | ✗ (F-17) | B |
| Manage applications | Owner scope, notes, status | ✓ | Partial (F-11) | B |
| Review CVs | Owner-only signed redirect | ✓ | ✓ | X (bucket) |
| **Admin** login / guard | DB role, `/dashboard/admin` layout guard | ✓ | ✓ | B |
| User management / suspension | Session revoked immediately (with Redis) | ✓ | ✓ | X (Redis); jobs stay live (F-04) |
| Company / job management | Allow-listed edits | ✓ | ✓ | B; no audit (F-10) |
| Invitations | Create, copy, revoke | ✓ | ✓ | B |

Loading and error states:
- `loading.tsx` exists for candidate, company, jobs and company onboarding. There is none for admin; the root `error.tsx`, `global-error.tsx` and `not-found.tsx` cover everything else.
- Main forms disable submit while saving.
- **Responsive layout, accessibility, empty states and stale-data behaviour were not verified** (no browser test was performed).

---

## E. Infrastructure verification matrix

| Service | Code reviewed | Locally tested | External test performed | Production config verified | Remaining actions |
|---|---|---|---|---|---|
| Supabase Postgres | ✓ | ✓ (fake Prisma; no real Postgres) | ✗ | ✗ | `migrate status`/deploy (F-02); drift diff; duplicates (F-07); pooler limits (F-20) |
| Supabase Storage | ✓ | ✓ (mocked client) | ✗ | ✗ | Bucket and policy SQL; public-URL probe (F-01) |
| Upstash Redis | ✓ | ✓ (local REST fake, Lua not executed by Redis) | ✗ | ✗ | Staging limits, revocation and outage (F-08) |
| Email (Resend) | ✓ | ✓ (injected transport) | ✗ | ✗ (likely unset) | Configure, deliver, DNS (F-05) |
| Google OAuth | ✓ | ✓ (Auth.js internals + PrismaAdapter; no round trip) | ✗ | ✗ | Test client; redirect URIs per environment |
| OpenAI | ✓ | ✓ (real SDK against a local server) | ✗ | ✗ | Latency vs duration (F-06); key scoping |
| PDF processing | ✓ | ✓ (real pdfjs in a worker) | ✗ | ✗ | Worker thread and traced files on Vercel |
| Vercel | ✓ | Build only | ✗ | ✗ | Plan, Fluid, `maxDuration`, Node 22 (F-21), env separation, log retention and drains (F-03) |

---

## F. Prioritized remediation roadmap

**1. P0 — must fix before launch** (all need production read access, then approved changes):
- **F-01:** read-only bucket SQL, then make the bucket private. *Depends on:* credentials and approval. *Verify:* public-URL probe refused.
- **F-02:** read-only `migrate status` and sizes, then `migrate deploy` **before** the code deploy. *Depends on:* F-09 (safe credential handling). *Verify:* column and indexes present.

**2. P1 — should fix before launch:**
- **F-09** (local, first): separate the production credentials. *Verify:* the default env can't reach Supabase.
- **F-03** (local code plus a provider account): error tracking, uptime, alerts. *Verify:* staging error and alert.
- **F-04** (local code): filter suspended companies, or close their jobs on suspension; plus tests. *Verify:* integration test.
- **F-06** (local code plus a Vercel check): `maxDuration`, cv-parse deadline. *Verify:* staging timeout test.
- **F-05** (configuration plus staging): Resend per environment; then a verification policy. *Depends on:* a staging environment. *Verify:* mails delivered.
- **F-08** (staging): Upstash runbook. *Depends on:* a staging environment.
- **F-07** (read-only production plus manual resolution). *Verify:* counts 0.

**3. P2 — important:**
- F-13 (bounds) and F-15 (limits): cheap code changes with tests.
- F-11 (transitions and concurrency) and F-10 (audit log): schema change, so a migration and approval.
- F-17 (DELETE, duplicate and Postgres-backed tests): CI service container.
- F-18 (cron) needs `CRON_SECRET`.
- F-19 (remove the PUT); F-16 (CSP Report-Only first); F-14 (IPv6 /64 plus the lockout policy); F-12 (retention job, after F-01).
- F-20 (staging k6 only); F-21 (Node pin); F-22 (page clamp).
- F-33: de-flake the PDF timing test (local; keeps CI trustworthy).

**4. P3 — post-launch:** F-23 to F-32.

---

## G. Final production checklist

**Code-level readiness** (local):
- [x] TypeScript, ESLint, integration tests (220/220) and the placeholder build pass (§H)
- [ ] Security suite green in the full parallel run: 188/189, flaky timing test F-33
- [x] Server-side authorization and ownership on every route; no IDOR found
- [x] CV access only via authorized, short-lived signed URLs
- [x] Tokens hashed, single-use and expiring; sessions revocable
- [ ] Suspended companies' jobs hidden and closed to applications (F-04)
- [ ] `maxDuration` on the AI/PDF routes; a cv-parse deadline (F-06)
- [ ] Error tracking and alerting wired up (F-03)
- [ ] Input length and array bounds (F-13); write-route rate limits (F-15)
- [ ] DELETE and duplicate-apply tests; a Postgres-backed constraint test (F-17)
- [ ] Production credentials not in the default local env (F-09)

**External infrastructure readiness** (needs access and approval):
- [ ] `cv` bucket private, no permissive policies, public URL refused (F-01)
- [ ] Migrations applied via `migrate deploy`, no drift, trigram indexes used (F-02)
- [ ] Duplicate-email counts 0, or resolved (F-07)
- [ ] Upstash: `EVAL` works, limits and revocation behave, separate DB per environment (F-08)
- [ ] Resend configured and delivering in production; `APP_URL` set (F-05)
- [ ] Google OAuth redirect URIs and test accounts verified per environment
- [ ] Vercel: plan and Fluid durations known, Node 22, Preview/Production secrets separated, log retention or drain (F-06, F-21, F-03)
- [ ] Staging load test (100/500/1,000 virtual users) within the targets; pooler and Upstash budgets OK (F-20)
- [ ] Browser plan executed (audit §6), including the onboarding redirect

**CXJobs is production-ready only when every box above is ticked or the risk is explicitly accepted in writing.**

---

## H. Local verification

All checks ran locally (Windows 10, 8 cores, Node v24.14.1). Nothing contacted an external service except `npm audit`, which queries the public npm registry.

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit --incremental false` | **PASS**: exit 0, 0 errors |
| ESLint | `npm run lint:ci` (`--max-warnings=35`) | **PASS**: exit 0, 0 errors, 35 warnings (unchanged) |
| Integration tests | `npm run test:integration` | **PASS**: 220/220, 0 skipped |
| Security tests | `npm run test:security` | **FAIL (flaky)**: 188/189, three full-suite runs in this phase, each failing the same test (`M6: a hanging parse is stopped at the deadline … main thread stays responsive`, `tests/security/cv-parser.test.ts:64`; "main thread ticked only 7" and then "4 times", against an expected ≥ 10). `npx tsx --test tests/security/cv-parser.test.ts` alone: **9/9 in 3 of 3 runs**. It passed in the full suite in Phase 4A and 4B. See F-33. |
| Production build | `next build` with all 16 local `.env` keys overridden by unroutable placeholders | **PASS**: exit 0, compiled, 63/63 pages, 0 DB-connection errors |
| Dependency audit | `npm audit --omit=dev` | 2 moderate (`exceljs` → `uuid`), 0 high, 0 critical (unchanged) |
| Working tree | `git status --short` and the diff hash compared before and after | Unchanged (only the gitignored `.next/` rebuilt; the two docs written) |

Not run, by design: migrations, seeds, k6, `next dev`/`start` with the real `.env`, any external integration test.

**F-33 · Tests · P2 · FAIL (flaky).** The PDF-timeout test above asserts ≥ 10 ticks of a 10 ms interval inside a 300 ms window. When `node --test` runs the test files in parallel processes (default concurrency is about cores − 1), CPU contention and worker start-up starve the window, so it fails in the full suite and passes in isolation.
- **Impact:** intermittent red CI (`ci.yml` runs this suite). It also weakens the signal of a security-relevant test.
- **Recommendation:** measure event-loop lag (`perf_hooks.monitorEventLoopDelay`) with a tolerance, widen the window, or run this file with `--test-concurrency=1`.
- **Verification:** 20 consecutive full-suite runs pass.
- This is **not evidence of a product regression**: the isolated runs prove the deadline and termination behaviour. Main-thread responsiveness under contention is simply not measurable this way.

---

## Appendix: scalability assessment (architectural, not measured)

| Load | Likely bottleneck | Evidence |
|---|---|---|
| **100 concurrent users** | No structural problem expected **once trigram indexes exist**. Without them, catalogue `ILIKE '%…%'` with `count()` sequential-scans `job_offers` on every uncached filter combination | `lib/job-offers-utils.ts`; F-02 |
| **500 concurrent users** | (1) Upstash command volume and latency: ≥ 1 revocation GET per authenticated request plus 1–2 rate-limit EVALs per write. (2) bcrypt cost 12 (about 200–300 ms CPU each) on bursts of registrations or resets. (3) Many function instances × `max: 2` pool connections against the Supavisor client limit | `lib/auth-callbacks.ts`; `lib/prisma.ts` |
| **1,000 concurrent users** | Pooler or Postgres connection exhaustion (plan-dependent); Upstash plan limits; hot-row updates on `job_offers.views` for popular jobs; deep-`OFFSET` pagination (F-22); per-instance in-memory caches (`lib/local-cache`, health) don't share state | `lib/prisma.ts`; `app/api/job-offers/[jobId]/views/route.ts` |

Mitigations already in place: CDN `s-maxage` on public lists and details, `unstable_cache` with tag revalidation, opt-in counts, pagination ≤ 100, a streaming export, an isolated PDF worker, bounded AI calls, a route-scoped PDF chunk. **None of this was load-tested** (no k6 was run).

# CXJobs — Production Readiness Audit (verification only)

- **Date:** 2026-11-09
- **Subject:** the current **working tree** on `hardening/production-readiness`, HEAD `6e77684` plus uncommitted changes.
- **Method:** static source review with file:line evidence, plus locally re-run quality gates.
- **No service contacted:** no production database, Supabase Storage, Upstash Redis, email, OAuth or Vercel service. No application file was modified; this report is the only file created.

> **Scope warning.** Everything verified here exists only in the uncommitted working tree:
> - 58 modified and 6 deleted tracked files;
> - 26 untracked paths, including `lib/security/`, `lib/auth-callbacks.ts`, `lib/server/session-revocation.ts`, the CV routes, the token-flow pages, `.github/workflows/ci.yml` and the `sessionVersion` migration.
>
> `HEAD` (`6e77684`) still contains the pre-remediation code. A Git-based deployment today would ship **none** of the verified fixes.

---

## 0000. Phase 6A update: F-04 company suspension enforcement (2026-11-10)

Details: `docs/PHASE-6A-F04-CHANGES.md`.

| | Status |
|---|---|
| **F-04** suspended companies' jobs public / still accept applications | ✅ **Fixed in code, verified by local tests.** One central rule (`lib/security/company-activity.ts`): a company is active only when `companies.deletedAt IS NULL` and its owner `users.isActive = true` (the existing suspension model; no schema change). It is enforced as a DB filter on every public job and company read (catalogue, job API, by-slug, job page, views, recommendations, company API and page, company list, home page). It is checked from the DB at application submit (pre-check and inside the insert transaction) and on every company-side write (create/edit/publish job, process applications, profile). Admin suspension or reactivation invalidates the job and company caches. Existing applications are preserved and readable by their candidates (read-only history). Reactivation restores only still-eligible jobs. 26 new tests, 5 negative controls |
| Not verified externally | CDN copies of anonymous API responses may persist ≤ about 6 minutes (catalogue) or ≤ about 90 s (others) after suspension, because tag revalidation isn't expected to purge them. Not verified on Vercel. Applications are unaffected (uncached, DB-checked) |
| Residual | A millisecond race between the in-transaction re-check and the insert (no row lock); no "account suspended" UI; admin overview metrics still count suspended companies' jobs |
| Requires production verification | Browser check of the 404 pages and the read-only history view; Vercel CDN behaviour; query plan of the relation filter on real Postgres |

Local checks after Phase 6A: tsc 0 errors; lint 0 errors / 34 warnings; integration **246/246**; security 188/189 (only the known flaky F-33 timing test); placeholder build passes (63 pages).

**Overall verdict unchanged: NOT PRODUCTION-READY.** P0 F-01/F-02 and the other P1 findings (section 000) remain open.

---

## 000. CURRENT STATUS: Phase 5 deep audit (2026-11-10)

Full report: `docs/PHASE-5-PRODUCTION-READINESS-AUDIT.md`: 33 findings with evidence, a 41-route table, user journeys, an infrastructure matrix, a roadmap and a checklist. Audit only; nothing changed. Seed data, test accounts and commit readiness were out of scope by instruction (still tracked in section 00 / Phase 4B).

**Verdict: NOT PRODUCTION-READY.** Application security code: **PASS**. Business logic: **PARTIAL**. Observability: **FAIL**. External infrastructure: **NOT VERIFIED**.

- **P0 (infrastructure, NOT VERIFIED):**
  - F-01: CV bucket privacy.
  - F-02: migrations not applied, drift unknown (without `sessionVersion`, auth fails).
- **P1:**
  - F-03: no error tracking or alerting (FAIL).
  - ~~F-04: suspended companies' jobs stay public and keep receiving applications (FAIL).~~ *Phase 6A: fixed in code and verified by local tests (section 0000).*
  - F-05: email likely unconfigured, so reset and verification don't work and email ownership is never proven.
  - F-06: no `maxDuration`; AI/PDF budgets 22/45/≈50 s.
  - F-07: existing duplicate emails lock users out.
  - F-08: Upstash unverified; login fail-closed on an outage.
  - F-09: the local Prisma CLI targets the Supabase DB (FAIL).
- **P2:**
  - F-10: no admin audit trail.
  - F-11: application status has no transition rules or concurrency control.
  - F-12: orphaned files never deleted.
  - F-13: unbounded text and arrays; profile sync makes one UPDATE per row.
  - F-14: account-lockout DoS; IPv6 not keyed by /64.
  - F-15: unthrottled heavy writes and public reads.
  - F-16: no `script-src` CSP.
  - F-17: no DELETE, duplicate-apply, Postgres or browser tests.
  - F-18: no scheduled expiry.
  - F-19: unused `PUT /api/dashboard/company`.
  - F-20: Redis-per-request, pooler headroom.
  - F-21: Node not pinned.
  - F-22: unbounded `page` offset.
  - F-33: flaky PDF timing test.
- **P3:** F-23 to F-32.

**Local checks (Phase 5):**
- tsc: 0 errors.
- lint:ci: 0 errors / 35 warnings.
- Integration tests: 220/220.
- **Security tests: 188/189.** The one failure is the load-sensitive PDF timing test (passes 9/9 in isolation, 3 of 3 runs; F-33).
- Placeholder build: pass, 63 pages.
- `npm audit --omit=dev`: 2 moderate, 0 high, 0 critical.

**External verification gaps:** Supabase DB and Storage, Upstash, Resend, Google OAuth, OpenAI, Vercel (durations, Node version, env separation, logs); browser journeys; load (no k6 run).

**Next steps:**
1. Local P1 fixes: F-09, F-03, F-04, F-06, then F-33.
2. Read-only production checks for F-01, F-02, F-07 (SQL in `PHASE-4B-AUDIT.md` §8).
3. A staging environment for F-05, F-08 and the load/browser plans.
4. Approved production changes: bucket private, `migrate deploy`.
5. Then the release plan in section 00.

---

## 00. Phase 4B final audit (2026-11-10)

Details, evidence and the full release plan: `docs/PHASE-4B-AUDIT.md`. Audit only: no code, configuration, data or infrastructure was changed, and nothing was committed or deployed.

### Current overall readiness verdict: **NO-GO today; CONDITIONAL GO after the Phase 4B release plan**
- The code is ready from a security standpoint: every Phase 1–4A fix is present, and all local gates pass.
- Production is **not** ready:
  - **B1:** nothing is committed.
  - **B2–B5:** none of the infrastructure or data blockers has been verified.
  - **N1:** a likely **P0** data risk was found (shared hard-coded password for 105 seeded test accounts that may exist in production).

### Blockers
| ID | Status | Next step |
|---|---|---|
| B1 Uncommitted changes | **OPEN.** Working tree complete and self-consistent (VERIFIED LOCALLY); `public/`, `instrumentation.ts`, migrations, `lib/security/` etc. are **untracked**; no required fix is gitignored | Commit everything, PR, CI green (approval) |
| B2 Migrations | **OPEN.** FIXED IN CODE (2 additive migrations, schema matches, no earlier migration edited); NOT VERIFIED on any DB; production drift possible (history mentions `db push`) | Read-only `migrate status` + size check, then `migrate deploy` only (approval) |
| B3 CV bucket privacy | **OPEN.** Code works with a private bucket (signed 60 s URLs after authorization; no public path). Bucket state NOT VERIFIED; **treat as public** | Read-only SQL; make private (approval) |
| B4 Duplicate emails | **OPEN.** No new duplicates possible in code; existing duplicates lock users out or orphan accounts; NOT VERIFIED | Read-only counts; manual resolution; later a `lower(email)` migration |
| B5 External integrations | **OPEN.** All NOT VERIFIED externally; **no safe test environment exists**; email is likely unconfigured in production (no `EMAIL_PROVIDER`/`APP_URL` locally) | Create an isolated Preview stack (approval), run audit §7 |

### Issue list (current)
- **P0 (if present):** **N1**. Seeded test accounts (100 CANDIDATE `user*@gmail.com`, 5 COMPANY) with one shared password hard-coded in `prisma/seed.ts` and the k6 generators, plus 12 published test jobs. The seed also overwrites the role and password of real users at those addresses.
- **P1:**
  - B1–B5.
  - **N2:** the local `.env` makes the Prisma CLI target the Supabase (production) DB, so `db:migrate`, `db:push`, seed and reset would hit production.
  - **N3:** `public/` (CV watermark) and `instrumentation.ts` are untracked.
- **P2:**
  - N4: pre-Phase-3 invitation tokens may sit in logs and are still valid if PENDING.
  - N5: no `maxDuration`; route budgets 22/45/≈51 s.
  - N6: no Node version pin.
  - N7: local k6 cookies and `results.json`.
  - N8: a doc claims a "cxjobs-test" verification.
  - Unused `PUT /api/dashboard/company` (replaces all benefits).
  - Unbounded text lengths.
  - The case-insensitive email fallback scan.
  - Per-request revocation Redis GET.
  - 4 partially tested routes.
  - Trigram build write lock.
- **P3:**
  - Zod strip vs strict.
  - JWT-role-only routes.
  - N9: `emailCompany` exact-match check.
  - N10: duplicate shift-type migrations.
  - Tracked `tmp-*` files.
  - `next-auth` beta.
  - 35 lint warnings.

### Local test results (Phase 4B re-run)
- TypeScript (`tsc --noEmit --incremental false`): 0 errors.
- `npm run lint:ci`: 0 errors / 35 warnings.
- Tests: **409/409** (security 189, integration 220; 0 skipped).
- Isolated `next build`: pass, 63 pages, no DB access.
- `npm audit --omit=dev`: 2 moderate, 0 high, 0 critical.
- `git status` and the diff hash were unchanged by the checks.

### External verification gaps
- **Production DB:** migration state and drift, duplicate emails, test accounts, legacy invitations, table sizes.
- **Supabase Storage:** policies.
- **Upstash:** Lua, limits, revocation, outage behaviour.
- **Resend:** configuration and delivery.
- **Google:** OAuth round trip and redirect URIs.
- **Vercel:** duration limits, Node version, env separation, worker thread and `sharp`.
- **Browser:** flows, including the company onboarding redirect.

### Exact next steps before deployment
1. **Read-only production checks** (approval): test accounts (N1), bucket (B3), duplicates (B4), `migrate status` and sizes (B2), legacy invitations (N4), and the Vercel env/plan settings. SQL: `PHASE-4B-AUDIT.md` §8, marked NOT EXECUTED.
2. **Local:**
   - Remove the hard-coded password and guard the seed (N1).
   - Separate the production credentials from the default `.env` (N2).
   - Optionally: `maxDuration`, Node pin, remove the unused PUT.
   - Commit everything, PR, CI green (B1, N3).
3. **Safe test environment** (approval to create): run audit §7 (B2, B5, browser plan).
4. **Production changes** (approval each): deactivate the test accounts, make the bucket private, resolve duplicates, `prisma migrate deploy`, set the email/`APP_URL` env vars.
5. **Deploy, then:** revoke and re-issue legacy invitations, run the smoke tests (audit §7.8), watch logs for 30 minutes.

---

## 0a. Phase 4A status update (2026-11-10)

Phase 4A (details: `docs/PHASE-4A-CHANGES.md`; first part in `docs/PHASE-4A-TASK-1-API-COVERAGE.md`). Still uncommitted. No migration, no database access, no external service contacted.

**Re-verified after Phase 4A** (local only):
- TypeScript 0 errors; ESLint 0 errors / 35 warnings (ratchet passes).
- **Tests 409/409** (security 189, integration 220; was 321 after Phase 3).
- Isolated `next build` passes (63 pages, placeholder env, no DB access).
- `npm audit --omit=dev` unchanged: 2 moderate, 0 high, 0 critical.

| Finding | Phase 4A status | Evidence |
|---|---|---|
| H5 untested routes | ✅ **Resolved in code.** 41/41 routes loaded by tests (37 tested, 4 partial, 0 untested; was 22/41) | `tests/integration/{admin-tokens,profile-onboarding,remaining-routes,oauth-email-integrity,dashboard-redirects}*.test.ts` |
| H8 Google vs legacy mixed-case emails | ◐ **Code side fixed; data side OPEN.** Root cause proven by test (the stock PrismaAdapter's exact-match lookup let Google create a duplicate of a legacy mixed-case account). The adapter wrapper now sees every case variant (`OAuthAccountNotLinked`, never a link), creates users lowercase as unverified CANDIDATEs, and trusts `emailVerified` only for the same address | `lib/server/auth-adapter.ts`, `lib/auth.ts`; 14 tests. **Still needed:** B4 check (also finds duplicates the old behaviour may already have created), manual dedupe, `lower(email)` migration |
| Company onboarding redirect loop (new) | ✅ **Fixed in code.** Browser/staging check NOT done | DB-derived policy `lib/security/dashboard-access.ts`, route group `dashboard/company/(onboarded)`; 15 tests following real layout redirect chains |
| New: `PUT /api/dashboard/company` accepted `javascript:`/`data:` URLs | ✅ Fixed (safe-URL schema) | `remaining-routes.test.ts` |
| Medium/low: `profile/allCompanies` counts drafts | ✅ Fixed (live jobs only) | `remaining-routes.test.ts` |
| Medium/low: `web-vitals` unauthenticated and unthrottled | ✅ Fixed (per-IP limit, strict schema; still unauthenticated by design) | `remaining-routes.test.ts` |
| B1–B5 | ⏳ **Open**, unchanged | Nothing committed; no migration applied; bucket privacy, duplicate-email data and external integrations not verified |

**Recommendation after Phase 4A: unchanged, CONDITIONAL GO** (section 8).

---

## 0. Phase 3 status update (2026-11-09)

Phase 3 remediated H1–H4, H6 and H7 in code (details: `docs/PHASE-3-CHANGES.md`). Still uncommitted.

**Re-verified after Phase 3:**
- TypeScript 0 errors; ESLint 0 errors / 35 warnings (ratchet passes).
- **Tests 321/321** (security 189, integration 132; was 275).
- `next build` passes, isolated, with no DB access (63 pages).
- `next start` with the perf-ci placeholder env boots and serves the audited pages. A missing required variable stops startup with a named, value-free error.
- Production audit unchanged: 2 moderate, 0 high, 0 critical.

| Finding | Phase 3 status | Evidence |
|---|---|---|
| H1 trigram indexes | ✅ **Fixed in code.** NOT applied to any DB | Schema declares 5 GIN trigram indexes; forward-only migration `20261109130000_restore_trigram_search_indexes`; replay test proves they exist at the end of history |
| H2 k6 production defaults | ✅ **Fixed** | `tests/k6/lib/target-guard.mjs` (explicit target, production always refused, no override) used by all scripts, the generators and the workflow; README is staging-only |
| H3 invitation token in query string | ✅ **Fixed** | Fragment links (`lib/security/invitation-link.ts`); POST-body validation `app/api/auth/invitation/route.ts`; server page never sees the token; 12 tests including "token never logged" |
| H4 unbounded AI calls | ✅ **Fixed.** Real-provider behaviour NOT VERIFIED | 20 s per attempt, 1 retry, caller AbortSignal, generic `AIServiceError`, 504 on timeout; 9 tests through the real SDK |
| H5 untested routes | ◐ **Partially.** 22/41 routes tested (was 19/40) | Admin token create/link and `auth/invitation` now covered; `/api/profile`, `/api/onboarding` still untested |
| H6 `perf-ci.yml` secrets / broken start | ✅ **Fixed.** Lighthouse run NOT VERIFIED | Placeholder env only, single server via `lhci`, localhost-only pages, filesystem upload; 6 CI-safety tests |
| H7 env validation never run | ✅ **Fixed** | `instrumentation.ts` → `lib/env.ts` (names only, skipped at build, fatal only for runtime requirements); 9 tests plus a runtime check |
| H8 Google vs legacy mixed-case emails | ⏳ Open | Requires the B4 data check and a data migration |
| B1–B5 | ⏳ **Open** (process / infrastructure / data) | Unchanged: commit; apply **both** new migrations (staging first); bucket privacy; duplicate-email check; staging integration run |

**Recommendation after Phase 3: unchanged, CONDITIONAL GO** (section 8). The code-level high-priority items are closed. The release gates B1–B5 are external and still open.

---

## 1. Executive summary

| | |
|---|---|
| **Overall assessment** | The application **code** is in good security shape. Every P0/P1 issue from `docs/RE-AUDIT.md` that Phase 2 claimed to fix is present in the code (27/27 claims spot-checked). No Critical or High *security* defect was found in the code paths reviewed. |
| **Readiness level** | **Staging-ready, not production-ready.** The remaining gaps are release process, infrastructure verification, one significant performance defect (missing search indexes) and test coverage of untested routes. |
| **Safe to deploy to production now?** | **No.** The fixes are not committed. The mandatory DB migration isn't applied. CV bucket privacy, Upstash Lua execution, email delivery and the Vercel runtime (PDF worker thread) are **unverified**, and none of them can be verified from code. |
| **Critical blockers** | B1 commit/release state; B2 migration ordering; B3 CV bucket privacy; B4 case-variant duplicate emails (data check); B5 a staging run of the external integrations (section 3). |
| **Recommendation** | **CONDITIONAL GO** (section 8). |

### Quality gates, re-run independently for this audit

| Gate | Result | How it was run |
|---|---|---|
| TypeScript | ✅ 0 errors | `tsc --noEmit --incremental false` (writes nothing) |
| ESLint | ✅ 0 errors, 35 warnings; `--max-warnings=35` passes | Warnings: 17 `set-state-in-effect`, 2 `refs`, 12 `no-unused-vars`, 2 `<img>`, 2 unused disable directives |
| Security tests | ✅ 154/154 | Placeholder env; no network |
| Integration tests | ✅ 121/121 | Prisma, Supabase and AI mocked; local fake of the Upstash REST API |
| Line coverage (Node built-in) | 88.1% **of loaded files only** | **21 of 40 API routes are never loaded by any test** (section 4, H5) |
| `next build` | ✅ exit 0, **no database access** | Every `.env` key overridden with unroutable placeholders. `next-env.d.ts` hash and `git status` were identical before and after. A build from an env-free copy was attempted first but abandoned, because Turbopack can't resolve a junctioned `node_modules`. |
| `npm audit --omit=dev` | 2 moderate, 0 high, 0 critical | `exceljs` → `uuid`; not reachable (see Dependencies) |
| `npm audit` (all) | 25 (2 low, 10 moderate, 13 high) | Direct packages flagged: `@lhci/cli` (high), `eslint-config-next` and `exceljs` (moderate). Everything except exceljs is dev/CI tooling. |

---

## 2. Verification results

| Area | Status | Evidence | Remaining risks |
|---|---|---|---|
| Authentication | **PASS** | `lib/auth.ts:138-155`: client `update()` data is never passed to the JWT callback. `lib/auth-callbacks.ts:116`: an update only forces a DB re-read, and `applyRecord` overwrites `id/role/isOnboarded/sv` from the DB row. Credentials: dummy-hash timing equalization, and the verification check runs only after a correct password (`auth-callbacks.ts:162-187`). Google: `email_verified !== true` rejected (`lib/auth.ts:172`). Login redirect: `safeCallbackPath` (`lib/security/safe-redirect.ts:18`, used at `components/auth/login-form.tsx:14`), unit-tested against `//`, `\\`, scheme and control-character payloads. Enumeration: register, forgot and resend return byte-identical responses and do account work after the response (tests `M7`, `reset: existing and unknown…`). Cookies are Auth.js defaults (no `cookies` override; httpOnly, SameSite=Lax). | Google OAuth end-to-end **not verified** (needs a real OAuth client). If production holds legacy **mixed-case** emails, a Google sign-in with the lowercase address creates a *second* account, because PrismaAdapter `getUserByEmail` is an exact match (H8). |
| Authorization | **PASS** | No `middleware.ts`/`proxy.ts`; every route guards itself. Admin: all 7 admin routes call `requireAdmin()` (`lib/auth-helpers.ts:74-89`, DB-checked role and `isActive`); page guard in `app/(dashboard)/dashboard/admin/layout.tsx:17-24`. Job list scope: `lib/security/job-offer-scope.ts:41` (owner scope only for its own `companyId`). Job PUT/DELETE: ownership checked in the transaction. Applications: candidate branch uses an explicit allow-list without `notes` (`app/api/application/[id]/route.ts:41-71`); company access is verified against `jobOffer.companyId`. Application list (`job-offers/[jobId]/applications/route.ts:93-114`) and export (`…/export/route.ts:177-201`) are owner-checked. CV routes use `canAccessApplicationCv` plus a folder-owner check. Upload: non-admins can't target other users; deletes are owner-prefix checked. **IDOR sweep of all 40 routes found no unguarded object access.** | 21 routes are verified **statically only** (no tests), including `/api/profile`, `/api/onboarding` and the admin token routes (H5). |
| API security | **PARTIAL** | SSRF: connect-time guarded DNS lookup, reject-if-any-address-blocked (`lib/job-scraper.ts:134-150`); per-hop re-validation (`:227`); max 3 redirects (`:10`); port 443 only; 100 KB cap; timeout. URL schemes: `lib/security/safe-url.ts` on all stored URL fields, plus `toSafeHref` at render. Mass assignment: zod-parsed objects; protected job fields stripped; no privileged keys in profile schemas (`lib/validations/profile.ts:106-127,409-429`). Errors: generic messages, details only in logs. Rate limits on auth, AI, scrape, cv-parse, upload, application, job writes and views. Headers: page CSP and frame protection (`next.config.ts:99-117`), stricter `/api` CSP kept, valid `Referrer-Policy` (`:87`). No CORS headers, so browsers enforce same-origin; state-changing JSON routes rely on SameSite=Lax cookies. | (a) **Invitation tokens are delivered in the query string** (`app/api/admin/tokens/route.ts:179`, `[id]/link/route.ts:112`), so they're logged by Vercel and stored in browser history while still valid (H3). (b) Zod **strips** rather than **rejects** unknown fields. That's safe for mass assignment but doesn't meet "reject unexpected fields". (c) `POST /api/analytics/web-vitals` is unauthenticated and unthrottled, and logs attacker-supplied strings (`web-vitals/route.ts:17`). (d) OpenAI client has no timeout (`lib/ai-service.ts:10`; SDK default 10 min, 2 retries) (H4). (e) Many free-text fields have no max length (e.g. `phone`, `headline`, job `description`). |
| File security | **PASS** (code) | Private-bucket guard: `getPublicUrl` throws for `cv` (`lib/supabase.ts:204`). CV access goes only through authorized routes and **60 s** signed URLs (`lib/security/cv-access.ts:12`, `lib/server/cv-download.ts:17-35`, `no-store`, `no-referrer`); upload preview 120 s (`app/api/upload/route.ts:320`). Content-based validation by magic bytes and structure, declared MIME must match, SVG never accepted (`lib/supabase.ts:145-192`, `lib/security/file-type.ts`). Server-generated paths `<userId>/<ts>-<uuid>.<ext>` (`lib/supabase.ts:127`). Size: 5 MB plus a content-length pre-check. PDF parsing: worker thread, 10 s timeout (`lib/server/pdf-text-worker.ts:31`), 256 MB heap cap (`:115`), 30 pages and 200k characters (`lib/cv-parser.ts:39-40`). Watermark: static `/brand/cxjobs-watermark.png` (`lib/cv/watermark.ts:12`), not the CV bucket. No public CV URL construction left anywhere (repo-wide search). | The bucket's actual `public` flag and RLS state are **not verifiable from code** (Supabase row). DOC/DOCX are stored unsanitized (served only as signed downloads). Application CVs fall back to the candidate's *current* resume (NF-14, open product decision). |
| Sessions | **PASS** | Reset and verification tokens: 256-bit, SHA-256 stored, consumed by a conditional delete inside a transaction (`lib/security/one-time-token.ts:54-74`, single use at `:68`), expiry enforced at `:65`, delivered in the URL fragment (`lib/email/index.ts:154`), never logged. Revocation: `sessionVersion` bumped **inside** the same transaction as a password reset (`app/api/auth/reset-password/route.ts:61`) and a suspension or email change (`app/api/admin/users/[id]/route.ts:234`); outstanding tokens deleted on an address change (`:245`). Redis publish is monotonic (Lua at `lib/server/session-revocation.ts:30`), with a 300 ms lookup timeout (`:21`). DB fallback: mismatch rejected on the 15-minute re-read even without Redis (`lib/auth-callbacks.ts:123`; test "revocation: without Redis…"). | The worst-case revocation delay when Redis is down is 15 minutes, by design. Real Upstash Lua execution is not verified. |
| Database | **PARTIAL** | Prisma 7 + `@prisma/adapter-pg` 7.10.1, consistent with the CLI and the generated client. Pool `max: 2` with `attachDatabasePool` (`lib/prisma.ts:19-30`). The CLI uses `DIRECT_DATABASE_URL`, falling back to `DIRECT_URL` (`prisma.config.ts:12`). Local `.env` classified without printing: runtime URL is the Supabase transaction pooler (6543, `pgbouncer=true`); migrate URL is direct (5432). Transactions are short and interactive. Migration ordering is consistent (created/dropped/re-created objects checked). The `sessionVersion` migration is additive with `DEFAULT 0` (compatible with existing rows and tokens). Builds perform **zero** DB access (`app/(public)/jobs/[slug]/page.tsx:178`; verified build log). | **H1: trigram search indexes do not exist after `migrate deploy`.** `idx_job_offers_title_trgm`/`_description_trgm` are created in `20260602135300…`, then dropped by `20260915154208_gender_fix`; `description` is re-created and re-dropped twice more, finally by `20261001163809_fix_error_gender`. Catalogue and dashboard `ILIKE '%…%'` queries sequential-scan `job_offers`. Each future `prisma migrate dev` will drop them again, because `schema.prisma` can't declare them. **Schema/migration drift was not verified** (needs a shadow DB). **The `sessionVersion` migration is mandatory before deploying the code**: `lib/auth-user-record.ts` selects the column on every authenticated request. Legacy case-variant duplicate emails make credentials login return no user for those addresses (`lib/server/user-email.ts:50`), which needs the B4 data check. |
| Supabase | **NOT VERIFIED** | Code: service-role key is server-only (no `NEXT_PUBLIC_` exposure; no client component imports `lib/supabase`; the only client→server imports are type-only). Fail-fast in production when unset (`lib/supabase.ts:25-33`). Signed-URL errors are logged by name and return 404/503. | Bucket `cv` `public=false`, RLS, and the absence of permissive `storage.objects` policies all need the read-only SQL in `docs/security/PRODUCTION_READINESS.md` §2. Legacy public-URL rows: same. |
| Redis | **NOT VERIFIED** | Code: atomic single-`EVAL` fixed window with TTL repair (`lib/rate-limit.ts:69-80`); fail-closed by default with an explicit `failOpen` only for public reads and views (`:150-158`); 1.5 s timeout; the production client throws at startup if unset (`lib/redis.ts:18-23`). Real Upstash client tested against a local REST fake (`tests/integration/redis-upstash.test.ts`). | The Lua scripts have **never run inside real Redis/Upstash**. Production outage behaviour (fail-closed login/auth, fail-open catalogue) needs a staging test. |
| Email | **NOT VERIFIED** | Code: Resend over HTTPS with an 8 s timeout; senders never throw; links built only from `APP_URL`/`NEXT_PUBLIC_APP_URL` (https required in production; `lib/email/index.ts:132-144`); HTML-escaped templates; token in the fragment; provider errors logged by status only. Default `EMAIL_PROVIDER=disabled`. | No email has been delivered. **Local `.env` sets neither `EMAIL_PROVIDER` nor `APP_URL`**, so with the same production config nothing is sent and users get a generic success message regardless. `REQUIRE_EMAIL_VERIFICATION` must stay off until delivery works, or existing unverified credential users are locked out. Central env validation (`lib/env.ts` `assertEnv`) exists but is **never imported**. |
| Vercel | **NOT VERIFIED** | No `vercel.json`; no `maxDuration`/`runtime` exports, so platform defaults apply (Node runtime). `outputFileTracingIncludes` ships the pdfjs worker for `/api/onboarding/cv-parse` (`next.config.ts`). Builds need no DB, and the required build-time env is documented in `ci.yml`. | Function duration limits depend on plan and Fluid setting (unknown). The PDF worker thread (`new Worker(..., resourceLimits)`) and `sharp` must be exercised on a Vercel preview. Preview vs production env separation and secret scoping need a dashboard check. Rollback: the old code ignores `sessionVersion`, so code rollback is safe, but **never drop the column** while new code is live (readiness doc §1). |
| Frontend | **NOT VERIFIED** | Static only: all 27 literal internal link and redirect targets resolve to existing routes. `not-found.tsx`, `error.tsx` (digest only) and `global-error.tsx` exist. Dashboard stats are DB-derived. Dead components with dead links or brand names deleted. The login page wraps `useSearchParams` in Suspense. | The app was **not started**: the only local env file points at production. Loading/empty states, role visibility and the new Hybrid filter / salary formatting / abort logic have never been seen in a browser. 19 hook-lint warnings sit in stateful forms. |
| Performance | **PARTIAL** | Pagination enforced (`parsePaginationParams`); counts opt-in on the candidate list; per-instance pool of 2; public list/detail cached (`unstable_cache` plus `s-maxage`); revalidation covers jobs and companies; view dedupe; health checks cached 15 s; PDF work isolated in a worker; CV export claim is atomic. | H1 missing trigram indexes. H2 **k6 scripts default to the production URL** (`tests/k6/production-authenticated-candidate.js:5`, `production-multi-user-candidates.js:5`) and the README instructs testing production. H4 AI calls are unbounded. Case-insensitive email fallback scans `users` with ILIKE on every unknown-email login or registration (no `lower(email)` index). `jwtCallback` performs a Redis GET on every authenticated request (≤300 ms each). |
| CI/CD | **PARTIAL** | `ci.yml` runs typecheck, lint ratchet, both test suites, build and a critical audit, with **no secrets** and placeholder env; its build step was reproduced locally. The k6 workflow parses, runs only when triggered manually, and refuses non-staging targets. | `ci.yml` is **untracked**, so it has never run on GitHub. **`perf-ci.yml` still injects `secrets.DATABASE_URL` and other production-shaped secrets into the build (`perf-ci.yml:31`)**, and its `npm run start` step (`:42`) has no env, so the server can't boot; the job is broken and over-privileged (H6). No deployment pipeline is defined in the repo (Vercel Git integration assumed). |
| Dependencies | **PASS** | Production tree: 0 critical, 0 high. The 2 moderate advisories are `exceljs` → `uuid` (GHSA-w5hq-g745-h8pq: v3/v5/v6 with a caller-supplied `buf`). exceljs only calls `uuidv4()` without a buffer (`node_modules/exceljs/lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js:43,77`), so the vulnerable path is unreachable. Prisma trio in lockstep at 7.10.1. | Dev/CI tooling: 13 high, mostly `@lhci/cli` (major bump), used only by `perf-ci.yml`. `next-auth` is a beta (`5.0.0-beta.32`). Not a production blocker. |

**Phase 3 notes per area.** Statuses are unchanged: each area still has an external-verification or residual item.

- **API security (PARTIAL):** H3 invitation tokens are now fragment-only with POST validation; H4 AI calls are bounded with generic errors. Remaining: `web-vitals` unthrottled, zod strips rather than rejects, unbounded text lengths.
- **Database (PARTIAL):** H1 trigram indexes are declared in the schema, with a forward-only restore migration. Remaining: migration not applied; schema/migration drift not verified against a shadow DB; B4 data check.
- **Performance (PARTIAL):** H1, H2 and H4 fixed in code. Remaining: not measured under load (staging k6 not run), case-insensitive email fallback scan, per-request revocation GET.
- **CI/CD (PARTIAL):** H6 fixed. `perf-ci` and `k6` hold no service secrets; CI-safety tests pin this. Remaining: no workflow has run on GitHub (uncommitted), Lighthouse thresholds unverified.
- **Email / Vercel (NOT VERIFIED):** H7 startup validation now warns, by name, when email or the app URL is misconfigured, and fails fast on missing runtime requirements. Real delivery and platform limits are still unverified.

---

## 3. Critical blockers (must be resolved before production)

These are release and verification blockers. **No code-level critical vulnerability was found.**

| ID | Blocker | Why it blocks | Resolution |
|---|---|---|---|
| B1 | **Fixes are uncommitted.** HEAD `6e77684` contains the vulnerable code (e.g. client-controlled `isOnboarded` in `HEAD:lib/auth.ts:115-117`, public CV URLs in `HEAD:app/api/upload/route.ts:322`). | Anything deployed from Git ships none of the verified fixes. | Commit the working tree (including all 26 untracked paths and the 6 deletions), open a PR, and let `ci.yml` run green on GitHub. |
| B2 | **Migration ordering.** `prisma/migrations/20261109120000_add_user_session_version` must exist in the target DB **before** the new code runs. *Phase 3:* also apply `20261109130000_restore_trigram_search_indexes` (additive; short write lock while each index builds). | `lib/auth-user-record.ts` selects `sessionVersion` on every authenticated request; without the column, every session fails (full auth outage). | Staging first, then production: `prisma migrate deploy`, verify the column, then deploy the code (section 7.1). |
| B3 | **CV bucket privacy unverified.** | If `cv` is public, the stored object paths (returned to companies) are equivalent to public CV links. The code guard can't protect a public bucket. | Run `PRODUCTION_READINESS.md` §2 SQL (read-only) in Supabase; expect `public=false`, RLS enabled, no anon/authenticated policies on `cv`. |
| B4 | **Legacy case-variant duplicate emails.** | `findUserByEmail` deliberately returns `null` when several case variants exist (`lib/server/user-email.ts:50`), so those users can't log in or reset by email after deploy. | Read-only check before deploy: `select lower(email), count(*) from users group by 1 having count(*) > 1;`. Resolve any rows manually first. Also count `where email <> lower(email)` to size H8. |
| B5 | **External integrations never exercised.** | Upstash Lua, Resend delivery, the PDF worker on Vercel and Google OAuth can't be proven locally. | Execute the staging plan (section 7) on an isolated Preview environment. |

---

## 4. High-priority improvements (before or immediately after launch)

| ID | Issue | Evidence | Recommendation |
|---|---|---|---|
| H1 | ✅ *Fixed in Phase 3 (code; apply via migrate)*: trigram search indexes are absent after migrations | Drop/re-create history listed under Database | Add a final idempotent migration (`CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE INDEX IF NOT EXISTS … gin_trgm_ops` on `job_offers.title`, `job_offers.description`, `companies.name`) and stop running `migrate dev` against shared DBs. Check production with `\di *trgm*` first. |
| H2 | ✅ *Fixed in Phase 3*: k6 scripts default to the production URL | `tests/k6/production-*.js:5`, `tests/k6/README.md` | Make `K6_BASE_URL` mandatory (fail if unset) and add the same production guard the session generators have. |
| H3 | ✅ *Fixed in Phase 3*: invitation token in the query string | `app/api/admin/tokens/route.ts:179`, `[id]/link/route.ts:112`, `app/onboarding/company/page.tsx:48` | Move it to the fragment (as with reset links) and POST it to the server, or shorten the TTL; ensure `no-store`. |
| H4 | ✅ *Fixed in Phase 3*: AI calls are unbounded | `lib/ai-service.ts:10` | `new OpenAI({ timeout: 20_000, maxRetries: 1 })`; pass the route's `AbortSignal`; set `maxDuration` on the AI routes. |
| H5 | ✅ *Resolved in Phase 4A (41/41 routes loaded by tests; 4 only partially)*. Previously ◐ *partially addressed in Phase 3 (19 of 41 untested; profile and onboarding remain)*: 21/40 API routes have no tests | `admin/*` (7), `analytics/*` (2), `candidate/cv/export`, `companies/[slug]`, `company/benefits`, `dashboard/company{,/analytics}`, `health`, `job-offers/[jobId]/applications`, `job-offers/by-slug/[slug]`, `job-offers/expire`, `onboarding`, `profile/allCompanies`, **`profile`** | At minimum, add authorization and mass-assignment tests for `/api/profile`, `/api/onboarding` and `/api/admin/tokens*`. |
| H6 | ✅ *Fixed in Phase 3*: `perf-ci.yml` is over-privileged and broken | `perf-ci.yml:31` (production secrets in the build), `:42` (no env at start) | Point it at a Preview URL (Lighthouse against a deployed preview) or a disposable DB; remove production secrets from CI. |
| H7 | ✅ *Fixed in Phase 3*: no central env validation | `lib/env.ts` `assertEnv` is never imported | Call it from `instrumentation.ts`, and include `APP_URL`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` and `INVITATION_TOKEN_ENCRYPTION_KEY`. |
| H8 | ◐ *Code side fixed in Phase 4A; data side open*: Google OAuth can create case-variant duplicates of legacy accounts | PrismaAdapter exact-match `getUserByEmail` (now wrapped: `lib/server/auth-adapter.ts`) | One-time data migration lowercasing emails (after B4 dedupe), then a unique index on `lower(email)`. |

**Medium / low:**
- ~~`web-vitals` is unauthenticated and unthrottled.~~ *Phase 4A: throttled and strictly validated.*
- ~~`profile/allCompanies` `_count.jobs` includes drafts (`route.ts:63`).~~ *Phase 4A: live jobs only.*
- Zod strips rather than rejects unknown keys.
- Unbounded text lengths.
- No `server-only` guards on server modules.
- CV export cooldown is advisory, because the PDF renders client-side.
- 19 hook-lint warnings.
- Open Phase 2 items: NF-11 (lockout DoS), NF-14 (CV fallback), NF-16 (tracked scratch files, local k6 cookie files), NF-17 (proxy trust off-Vercel).

---

## 5. Infrastructure actions

Legend: **[V]** = verified in code/config in this repo; **[A]** = assumption about your infrastructure that must be confirmed.

### Supabase
1. **[V]** The code requires a private bucket named `cv`. → **[A]** Confirm `public=false`, RLS on `storage.objects`, and no `anon`/`authenticated` policy granting `cv` access (B3).
2. **[V]** Public buckets used for images: `avatars`, `logos`, `blog-images`, `covers`, `culture-images` (`lib/supabase.ts:52-59`). → **[A]** These exist and are public-read.
3. **[V]** The runtime needs a pooled `DATABASE_URL`, and migrations need a direct `DIRECT_DATABASE_URL`. → **[A]** Vercel production uses port 6543 / pooler for `DATABASE_URL` (the local `.env` does).
4. Run the B4 duplicate-email query and the H1 index check (read-only).
5. Apply migration `20261109120000_add_user_session_version` (B2): staging first, production before the code deploy.

### Upstash
1. **[V]** `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are required in production (startup throws otherwise).
2. **[A]** Use **separate** Upstash databases for Preview/staging and Production. The keys `ratelimit:*` and `session-version:*` must not be shared across environments.
3. **[A]** `EVAL` is permitted on the plan (both Lua scripts depend on it).

### Resend
1. **[V]** Needs `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `EMAIL_FROM` on a verified domain.
2. **[A]** Domain SPF/DKIM verified in Resend for the `EMAIL_FROM` domain.
3. Keep `REQUIRE_EMAIL_VERIFICATION=false` until delivery is proven **and** existing unverified users have a plan (grandfather by back-filling `emailVerified`, or bulk-send verification).

### Vercel
1. **[V]** Production env must define: `DATABASE_URL`, `DIRECT_DATABASE_URL` (migrations only), `AUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `APP_URL` (https), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `INVITATION_TOKEN_ENCRYPTION_KEY` (base64, 32 bytes), `OPENAI_API_KEY`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, `REQUIRE_EMAIL_VERIFICATION`.
2. **[A]** Preview deployments use **non-production** DB, Redis, Supabase and Google credentials (scope every secret to its environment).
3. **[A]** Google OAuth redirect URIs include the preview/staging callback (`/api/auth/callback/google`).
4. **[A]** Plan or Fluid duration limits accommodate AI and scrape routes (the scrape route self-limits to 22 s; AI calls do not, H4).
5. Deploy order: migrate → deploy → smoke test. Rollback: Instant Rollback of code only; never drop `sessionVersion`.

---

## 6. Browser test plan

Run on an **isolated staging/preview** environment only.

### Candidate

| # | Action | Expected result |
|---|---|---|
| C1 | Register with `Mixed.Case@Example.com` | Generic success; account stored lowercase; verification email arrives (if the provider is enabled). |
| C2 | Register again with `mixed.case@example.com` | Identical response; no new account; an "account exists" email is sent. |
| C3 | Log in using a different case of the address | Succeeds. A wrong password shows the generic error. Repeated failures produce the rate-limit message. |
| C4 | Google login | New user becomes CANDIDATE; an unverified Google email is refused. |
| C5 | Onboarding (CV path and manual path) | Required fields enforced; redirect to the dashboard after completion. |
| C6 | CV upload | PDF and DOCX accepted. Renamed `.exe→.pdf`, SVG and >5 MB files rejected. "View CV" opens through `/api/profile/cv`, and the signed URL expires after about 60 s. |
| C7 | Job search: keyword plus city | Results match **both** conditions. |
| C8 | Activity filter, Remote, Hybrid | Each filter applies. The URL updates, and a reload keeps the selection. Rapid filter changes show no stale results. Reset clears everything. |
| C9 | Job detail | Salary range displayed correctly. An EXTERNAL job opens the external URL with no internal apply. An expired or deleted job URL shows the 404 page. |
| C10 | Apply to an internal job | Success. Duplicate apply rejected. Logged-out apply goes to `/login?callbackUrl=…`, then **returns to the apply page** after login. |
| C11 | Application history | The candidate never sees recruiter notes (check the network tab for `notes`). |
| C12 | Profile edit | Saves. LinkedIn URLs restricted to linkedin.com. `javascript:` URLs rejected. |
| C13 | Password reset | Email link uses `#token=`. The new password works; the old one fails. A second use of the link fails. Other open sessions are signed out. |

### Company

| # | Action | Expected result |
|---|---|---|
| K1 | Admin creates an invitation; open the link | The registration form is shown. A used or expired link is refused. |
| K2 | Log in | Lands on `/dashboard/company`. `/jobs` shows **all** companies' published jobs. |
| K3 | Company profile edit | Benefits kept; job benefit links preserved. Logo/cover upload re-encoded. |
| K4 | Create a job | Salary min > max rejected. EXTERNAL without a URL rejected. A foreign benefit id is rejected. |
| K5 | Publish, close, archive an EXTERNAL job | It **stays EXTERNAL** with its URL. |
| K6 | Edit a published job | The change shows on the job page and the company page within about one request. |
| K7 | Expired job | Disappears from the listing and the company page; apply is refused. |
| K8 | Applications management | Status changes and recruiter notes save. Notes are invisible to the candidate. CV download works only for this company's applicants. Excel export works. |
| K9 | Cross-tenant attempts | Another company's `jobId` in URLs gives 403/404 on applications, export and the CV route. |

### Admin

| # | Action | Expected result |
|---|---|---|
| A1 | Admin login | Lands on `/dashboard/admin`. Every sidebar link resolves. Non-admins are redirected away from `/dashboard/admin/*`. |
| A2 | Dashboard and stats | Numbers match the DB counts. |
| A3 | User management: suspend a logged-in user | That user's next request fails; they are signed out. |
| A4 | Change a user's email | The old reset link stops working; the user must re-verify (if enforced). |
| A5 | Company management | Edit company fields, upload a logo on the company's behalf, manage company jobs. |
| A6 | Tokens | Create, copy link, revoke; a revoked link is refused. |

### Cross-cutting

| # | Action | Expected result |
|---|---|---|
| X1 | Frame any page from another origin | Blocked (frame-ancestors / XFO). |
| X2 | Unknown URL | Branded 404. |
| X3 | Forced server error in staging | Branded error page showing only a digest. |
| X4 | Mobile layout of filters and dashboards | Usable on small screens. |
| X5 | Empty states | Dashboards with no jobs or applications render correctly. |

---

## 7. Staging test plan

**Preconditions:**
- A staging Supabase project or branch, a staging Upstash DB, a Resend test domain or sandbox, and a Vercel Preview with environment-scoped secrets.
- No production credentials anywhere in the Preview environment.

### 7.1 Database migration
1. Restore an anonymized production snapshot into staging, or run against an empty DB.
2. Run the B4 duplicate-email query on the snapshot.
3. Run `npx prisma migrate status`, then `npx prisma migrate deploy` with staging `DIRECT_DATABASE_URL`.
4. Verify the column: `select column_name, column_default from information_schema.columns where table_name='users' and column_name='sessionVersion';` should return `0`.
5. Run `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --shadow-database-url <staging-shadow>`. Expect no drift other than the trigram indexes (H1).
6. *(Phase 3)* `migrate deploy` now also applies `20261109130000_restore_trigram_search_indexes`. Check that `\di *trgm*` lists the 5 indexes (`idx_job_offers_{title,description,custom_location}_trgm`, `idx_companies_{name,location}_trgm`), and that `EXPLAIN` on a catalogue search uses a `Bitmap Index Scan` on them.

### 7.2 Storage privacy
1. Run the readiness doc §2 SQL.
2. Upload a CV, take its object path, and request `https://<staging>.supabase.co/storage/v1/object/public/cv/<path>`. Expect 400/404, **never the file**.
3. Fetch `/api/application/<id>/cv` as the candidate, the owning company, another company and anonymous. Expect 302 (signed URL), 302, 404, 401.
4. Re-use a signed URL after 70 s; it must be expired.

### 7.3 Redis
1. Exceed login limits (10 per account, 30 per IP per 15 min). Expect 429-style `rate_limited`.
2. Suspend a user while their session is open. The next request must fail immediately, which proves the Lua publish and GET work.
3. Set an invalid Upstash token on a throwaway Preview. Login, AI and scrape must fail closed; `/jobs` must keep working (fail-open). Restore the token.

### 7.4 Email
1. Set `EMAIL_PROVIDER=resend` with a sandbox domain. Run register, resend-verification, forgot-password and the "account exists" flows.
2. Confirm links point to staging `APP_URL` and use `#token=`. No token appears in Vercel logs.
3. Revoke the API key; requests must still return the generic success, with the error logged by status only.

### 7.5 Authentication
- Run C1–C4, C13 and A3–A4 from section 6.
- Google OAuth with a staging client (verified and unverified test accounts).
- Mixed-case legacy row (insert one in staging), then log in with lowercase.

### 7.6 CV uploads and parsing
1. Run C6 on Vercel.
2. Upload a 30+ page PDF, a malformed PDF and a "zip-bomb"-style PDF to `/api/onboarding/cv-parse`. Expect bounded latency (≤ about 10 s), a generic error, and no function crash.

### 7.7 k6 performance (staging only)
1. Fix H2 first, or always pass `-e K6_BASE_URL=https://<preview>`; the workflow guard refuses non-staging targets.
2. Generate sessions with `tests/k6/generate-*-sessions.js`, which refuse production URLs, against staging test accounts only.
3. Ramp 10 → 25 → 50 VUs (5 minutes each) on the public catalogue and the authenticated candidate flows. Thresholds: p95 < 800 ms on `/api/job-offers`, error rate < 1%, no Supabase "too many connections", Upstash command budget within plan.
4. Watch Supabase connections and Vercel function concurrency. Repeat the search scenario with and without the H1 indexes.
5. Never use production cookies, URLs or accounts.

### 7.8 Production-like smoke test (after the production deploy)
1. `GET /api/health` returns `healthy`.
2. Anonymous `/jobs` and a job page load.
3. Log in as a test candidate and a test company; perform one apply and a status change.
4. Admin dashboard loads.
5. `curl -I` any page shows `X-Frame-Options: DENY`, the CSP and the HSTS header.
6. A public CV URL check fails (7.2 step 2).
7. Watch the logs for 30 minutes (auth errors, Prisma `sessionVersion` errors, rate-limiter "backend error").

---

## 8. Final recommendation: **CONDITIONAL GO**

> *Superseded on 2026-11-10 by Phase 4B (section 00): **NO-GO today; CONDITIONAL GO after the Phase 4B release plan**, mainly because of the new finding N1 (seeded test accounts with a shared password that may exist in production) and the still-open B1–B5. The original 2026-11-09 text is kept below for history.*

The code reviewed in the working tree is ready from a security standpoint:
- Every audited control is implemented and traceable to file:line.
- The IDOR sweep found no unguarded resource access.
- Tokens, sessions and file handling are sound.
- Production dependencies have no high or critical advisories.
- TypeScript, lint, 275 tests and a DB-free build all pass when re-run independently.

It is **not a GO**, because production safety depends on things the code can't guarantee: B1 (the code isn't committed), B2 (migration ordering), B3 (bucket privacy), B4 (data compatibility of email normalization) and B5 (real Redis, email, OAuth and Vercel runtime behaviour).

It is **not a NO-GO**, because none of these is a code defect. Each has a concrete, bounded verification step in section 7, and no critical vulnerability remains in the code.

**Proceed to production only when all of the following hold:**
- B1–B5 are complete and staging (section 7) passes.
- H1 (search indexes) is addressed or consciously accepted, after checking production's actual index state.
- H6 (production secrets in `perf-ci.yml`) is removed before the CI workflows go live on GitHub.

---

## 9. Final verification counts (section 2 table, 14 areas)

| Status | Count | Areas |
|---|---:|---|
| PASS | **5** | Authentication, Authorization, File security, Sessions, Dependencies |
| FAIL | **0** | — |
| PARTIAL | **4** | API security, Database, Performance, CI/CD |
| NOT VERIFIED | **5** | Supabase, Redis, Email, Vercel, Frontend |

*Phase 4B:* area statuses unchanged (PASS 5 / FAIL 0 / PARTIAL 4 / NOT VERIFIED 5). B1–B5 still open; new findings N1 (P0 if present), N2–N3 (P1), N4–N8 (P2), N9–N10 (P3). Tests: 409/409. Verdict: NO-GO today, CONDITIONAL GO after the release plan.

*Phase 4A:* area statuses unchanged (PASS 5 / FAIL 0 / PARTIAL 4 / NOT VERIFIED 5); the remaining PARTIAL / NOT VERIFIED items are external or data verification. High-priority items: 7 fixed (H1–H7), 1 partial (H8: data side). Critical blockers B1–B5: all still open. Tests: 409/409.

*Phase 3:* area statuses unchanged (PASS 5 / FAIL 0 / PARTIAL 4 / NOT VERIFIED 5). High-priority items: 6 fixed (H1–H4, H6, H7), 1 partial (H5), 1 open (H8). Critical blockers B1–B5: all still open (external). Tests: 321/321.

Additional tallies:
- Critical blockers: 5 (all process, infrastructure or data; 0 code).
- High-priority improvements: 8.
- Phase 2 change-log claims verified against code: 27/27.

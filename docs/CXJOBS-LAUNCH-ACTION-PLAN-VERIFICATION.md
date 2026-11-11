# CXJobs: launch action plan verification audit

- **Date:** 12 Nov 2026
- **Baseline:** *CXJobs Launch Action Plan (updated 8 Nov)* (PDF). It has **42** IDs, not the 44 that earlier docs cite.
- **Repository state audited:**
  - branch `hardening/production-readiness`, HEAD `6e77684` (same as `origin`);
  - **plus a large uncommitted working tree**: 204 status entries (modified, deleted and untracked), and 3 staged deletions under `playwright-report/`.
- **Method:**
  - Read-only code review of every item.
  - Local checks with every service variable overridden by unroutable placeholders (the CI `env` block).
  - The same suites re-run on a copy of the non-ignored file set: what CI would see if the working tree were committed.
  - Negative controls run on that scratch copy only.
- **Not done (by restriction):**
  - no source change, commit, push or deploy;
  - no Prisma migrate, push or seed;
  - no connection to production, Vercel, Supabase, Upstash, Google or Resend;
  - no secret printed.

> **How to read the statuses.** Each status describes the **current working tree**, which holds every fix below. **HEAD and `origin` do not contain them.** The deployable branch still has the original S2, S3, A8 and A10 defects (§8.1). A PASS here means "fixed in the working tree, with tests that fail when the fix is broken". It does **not** mean "fixed in production".

---

## Section 1: Executive summary

**Verdict: NO-GO** (§10).

The code in the working tree is in good shape:
- Every Critical/High security item in the plan has a correct implementation.
- The regression tests catch deliberate breakage.

CXJobs is still not ready for production, for three reasons:
1. **None of it is committed.** The pushed code that can be deployed today still leaks recruiter notes to candidates (S3). It also lets a company user read other companies' draft jobs (S2).
2. **The deploy depends on three unapplied migrations.** The session-revocation column (A8) and the A6/A7 tables are missing from every database.
3. **The credential-exposure incident has not been closed operationally.** No production secret has been rotated. Nothing in this repository proves the production session-signing secret has changed.

| Status | Count | IDs |
|---|---:|---|
| **PASS** | 21 | S1, S2, S3, S4, S5, S8, S9, S10, A4, A8, F3, F5, F7, A1, A7, P1, P3, P4, P6, A10, Q3 |
| **PARTIAL** | 10 | A3, A5, A11, F6, Q1, Q2, U1, U2, U3, A12 |
| **OPEN** | 0 | — |
| **FAIL** | 0 | — (but see §8.1: S2/S3/A8/A10 are still defective in HEAD) |
| **BLOCKED** | 6 | S6, A9, F1, F2, A2, Q4 |
| **UNVERIFIED** | 5 | S7, F4, A6, P2, P5 |
| **Total** | **42** | |

**New findings from this audit** (none is a release blocker on its own):

| # | Severity | Finding |
|---|---|---|
| N-1 | Medium (process) | All tests, `ci.yml`, migrations and fixes are untracked/uncommitted. HEAD tracks **no** security or integration test. |
| N-2 | Medium | JobPosting JSON-LD for remote jobs has `jobLocationType: TELECOMMUTE` but no `applicantLocationRequirements`. Fully remote jobs also have no `jobLocation`. Google requires one of these, so such pages are likely to fail the Rich Results Test (U3). |
| N-3 | Low | Text contrast still fails AA on the public job page: `#9aa5b6` labels on white, 2.49:1 (U1). |
| N-4 | Low | Unlabelled icon buttons: the shared `Dialog` close button, the recruiter review-modal close button, and the `‹`/`›` pagers (U2). |
| N-5 | Low | The page CSP is Report-Only **without `report-uri`/`report-to`**, so violations cannot be collected from staging. Its `script-src` allows `'unsafe-inline'` (A3). |
| N-6 | Low | The owner/admin scope of `GET /api/job-offers` always filters out expired jobs (owners can't list their own expired jobs through the API; the dashboard doesn't use it). |
| N-7 | Info | `POST /api/application` returns the full created row, including a `notes: null` key. No recruiter content can be present at creation, but this departs from the explicit-select rule (S3). |
| N-8 | Info | Dead code: `FeaturedBPOCard` (hard-coded "Velocity Retail is hiring 200+ agents… Signing Bonus up to $500") is exported but never rendered (P3/Q3). `seed:perf` points at a gitignored file. |

---

## Section 2: Full requirement matrix

Risk = residual risk if launched as is (from the working tree).

| ID | Requirement (short) | Status | Risk | Primary evidence |
|---|---|---|---|---|
| S1 | Session update callback ignores client data | PASS | Low | `lib/auth-callbacks.ts:92-131` |
| S2 | Company job list restricted to own jobs | PASS | Low | `lib/security/job-offer-scope.ts:29-48` |
| S3 | No recruiter notes in candidate responses | PASS | Low | `lib/security/application-fields.ts:9-36` |
| S4 | SSRF protection in scraper | PASS | Low | `lib/job-scraper.ts:33-151, 207-292` |
| S5 | Shared http(s) URL validator; own-storage images | PASS | Low | `lib/security/safe-url.ts:116-138` |
| S6 | Private CVs, authorized short-lived links | BLOCKED | **High** | `lib/security/cv-access.ts`, `lib/server/cv-download.ts` |
| S7 | Rate limits + daily AI quota | UNVERIFIED | Medium | `lib/rate-limit.ts`, `lib/security/ai-quota.ts` |
| S8 | No reset URL/token in logs | PASS | Low | `app/api/auth/forgot-password/route.ts` |
| S9 | Benefit ownership on create and update | PASS | Low | `lib/security/benefits.ts:25-40` |
| S10 | Generic API errors | PASS | Low | repo-wide `error.message` search |
| A3 | Security headers on every page | PARTIAL | Medium | `next.config.ts:33-50, 69-150` |
| A4 | Rate-limit public endpoints; count only live views | PASS | Low | `app/api/job-offers/[jobId]/views/route.ts:12-71` |
| A5 | Case-insensitive emails | PARTIAL | Medium | `lib/server/user-email.ts` |
| A8 | Hashed tokens; reset signs out everywhere | PASS | Medium (needs migration) | `app/api/auth/reset-password/route.ts:40-66` |
| A11 | Dependency security | PARTIAL | Low | `npm audit` output |
| F6 | .env.example, deps, README, CLAUDE.md | PARTIAL | Low | `README.md`, `CLAUDE.md`, `.env.example` |
| Q1 | CI on pull requests | PARTIAL | **High** (process) | `.github/workflows/ci.yml` (untracked) |
| A9 | Backups, restore test, uptime, error tracking | BLOCKED | **Critical** | `scripts/ops/*`, `docs/OPERATIONS.md` |
| F1 | Role choice at sign-up | BLOCKED (decision) | Medium | `app/api/auth/register/route.ts` |
| F2 | Email provider + recovery pages | BLOCKED | **High** | `lib/email/index.ts` |
| F3 | Benefits saved by id; untouched when omitted | PASS | Low | `app/api/profile/route.ts:765-887` |
| F4 | Login callbackUrl; apply-page states | UNVERIFIED | Low | `lib/security/safe-redirect.ts:18-40` |
| F5 | Admin area, no dead links | PASS | Low | build route table; link scan |
| F7 | Real dashboard numbers | PASS | Low | dashboard pages read Prisma counts |
| A1 | Block expired/external apply; complete profile | PASS | Low | `app/api/application/route.ts:26-49, 316-380` |
| A2 | Nightly auto-expiry | BLOCKED | Medium | `vercel.json`, `app/api/job-offers/expire/route.ts` |
| A6 | Partial company save, cache refresh, slug redirects | UNVERIFIED | Medium (needs migration) | `app/api/profile/route.ts:765-887`, `lib/server/company-slug.ts` |
| A7 | Status rules, history, notifications, analytics | PASS | Medium (needs migration) | `lib/application-status.ts`, `app/api/application/[id]/route.ts:255-340` |
| Q2 | End-to-end sign-up → apply test | PARTIAL | Medium | `tests/integration/journey-candidate-apply.test.ts` |
| P1 | Filters in API with AND semantics, URL state | PASS | Low | `lib/job-offers-utils.ts:35-129` |
| P2 | Homepage search → /jobs | UNVERIFIED | Low | `components/landing/cx-hero-search.tsx:80` |
| P3 | No fake jobs/stats/brands | PASS | Low | repo search |
| P4 | Terms, Privacy, no dead links | PASS | Low (legal text unreviewed) | `/terms`, `/privacy`; link scan |
| P5 | Expired/deleted jobs hidden; immediate refresh | UNVERIFIED | Medium | `lib/security/company-activity.ts:31-38`, `lib/cache.ts:72-86` |
| P6 | not-found / error / loading pages | PASS | Low | `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`, loading files |
| U1 | Brand tokens; WCAG AA text contrast | PARTIAL | Low | `app/globals.css:138-149`; `job-detail-client.tsx:432` |
| U2 | aria-labels; real filter controls | PARTIAL | Low | `components/ui/dialog.tsx:114` |
| U3 | JobPosting, sitemap, robots, OG | PARTIAL | Medium (SEO) | `lib/seo/job-posting.ts:39-67` |
| A10 | Public pages cached (static/ISR) | PASS | Low | build output |
| A12 | AI timeouts, retry limit, format check | PARTIAL | Low | `lib/ai-service.ts:35-36, 209, 371, 497` |
| Q3 | ESLint 0 errors; dead code removed | PASS | Low | `npm run lint:ci` |
| Q4 | Manual QA, mobile + desktop | BLOCKED | **High** | — |

### 2.1 Item details

Every test listed under "Tests found" ran inside the suites in §6. Unless the item says otherwise, the result is **pass**.

#### Security

**S1: session update callback.**
- *Implementation:* `jwtCallback` (`lib/auth-callbacks.ts:92-131`) never reads `session` from `update()`. An update only forces a DB re-read. `id`, `role` and `isOnboarded` come from the user row (`applyRecord`, `:80-90`). Inactive or missing users return `null`. The `sessionVersion` mismatch revokes the token (`:109-123`). `lib/auth.ts:148-166` passes no client data.
- *Tests:* `tests/security/auth-callbacks.test.ts`; `tests/integration/auth-flows.routes.test.ts` ("client update() cannot escalate role", real Auth.js handlers).
- *Remaining:* none in code.
- *Caveat:* `session.user.role` is up to 15 min stale for a demoted user unless `sessionVersion` is bumped.

**S2: company job isolation.**
- *Implementation:* `resolveJobOfferListScope` (`lib/security/job-offer-scope.ts:29-48`) gives the owner scope only when `?companyId=` equals the company id resolved from the DB for the session user.
- *Case by case:*
  - A foreign `companyId` drops to that company's PUBLISHED listing.
  - A COMPANY user without a profile gets the public catalogue.
  - A candidate or anonymous visitor gets the public catalogue, which is PUBLISHED only, with an active company and an expiry check (`app/api/job-offers/route.ts:36-50, 216-250`).
  - An admin sees every non-deleted job.
- *Deviation from the PDF:* the PDF says "404 if no company profile". The code returns the public catalogue instead, which can never leak private rows. This is acceptable.
- *Tests:* `job-offers.routes.test.ts` (S2/NF-03).
- *Negative control (this audit):* allowing any owned company to widen scope made **1 test fail** (27 pass / 1 fail).
- *Low note (N-6):* the owner scope also gets `expiresAt > now` (`lib/job-offers-utils.ts:124-128`), so owners can't list their own expired jobs through this endpoint.

**S3: recruiter notes.**
- *Implementation:*
  - Candidate `GET /api/application/[id]` uses an explicit `select` built on `CANDIDATE_APPLICATION_SCALARS`, then `stripRecruiterOnlyFields` (`app/api/application/[id]/route.ts:53-95`).
  - Candidate list `GET /api/application` uses an explicit select (`app/api/application/route.ts:131-160`).
  - The candidate dashboard API, both candidate server pages and the A7 notifications carry no notes.
- *Tests:* "GET application: candidate reads own application WITHOUT recruiter notes", "GET applications … never recruiter notes", "candidate dashboard … never include notes", the A7 "no notes leaked" test, and journey step 7.
- *Negative control:* adding `notes` to the allow-list made **1 test fail**.
- *Info (N-7):* the `POST /api/application` 201 body is built with `include` (`route.ts:379-422`), so it carries `notes: null`. No recruiter text can exist at creation time, but the "Done when" wording (no notes field) is not literally met.

**S4: SSRF.**

| Check | Location | Result |
|---|---|---|
| https only, port 443 only, no credentials, no single-label or internal hostnames | `isSafeUrl`, `lib/job-scraper.ts:93-110` | Yes |
| IPv4 private, loopback, link-local (169.254/16), CGNAT, test-net, multicast ranges | `:33-49` | Yes |
| IPv6 loopback, ULA, link-local, NAT64, 6to4, Teredo ranges | `:51-66` | Yes |
| IPv4-mapped IPv6 | `::ffff:0:0/96`, plus mapped-form check of v4 rules (`:77-86`) | Yes |
| **All** resolved addresses must be public | `createGuardedLookup`, `:134-151` | Yes (`some(isBlockedIp)` refuses) |
| DNS rebinding / connection pinning | The guarded `lookup` is given to `https.request`, so the socket connects to the validated address | Yes |
| Redirects | Manual, re-validated every hop, max 3 (`:226-249`) | Yes |
| Timeout, byte cap, content type | `:218-271` | Yes |

- *Tests:* `tests/security/ssrf.test.ts`. No external request was made.
- *Remaining:* none.

**S5: URL validation.**
- *Implementation:*
  - `safeUrlSchema` / `optionalSafeUrlSchema` (http/https only) are used for the website, LinkedIn/Twitter/Facebook links (profile and admin) and `externalApplyUrl`.
  - The scraper URL is https-only (`lib/validations/job.ts:58, 123, 214`; `lib/validations/profile.ts:424-434`; `lib/validations/auth.ts:65-76`).
  - Images (avatar, logo, cover, culture) go through `optionalStorageImageUrlSchema`: this Supabase host, public image buckets, no traversal (`lib/security/safe-url.ts:116-138`).
  - The candidate `linkedinUrl` has a dedicated normalizer; `resumeUrl` must be the user's own CV object path (`app/api/profile/route.ts:616-624`).
  - Every URL column in `schema.prisma` is covered.
- *Architecture mismatch:* the PDF note says to restrict images to "our own server (PR #9)". The code uses Supabase Storage. No PR #9 or VPS exists in this repository.
- *Tests:* `safe-url.test.ts`, `launch-plan.test.ts` S5, `launch-plan.routes.test.ts` S5.
- *Remaining:* rows written before the fix may hold `javascript:` or third-party URLs. Not checkable without a read-only production query.

**S6: private CVs.**
- *Implementation (code: correct):*
  - Upload stores only the object path for `cv` (`app/api/upload/route.ts:315-330`).
  - `GET /api/application/[id]/cv` and `GET /api/profile/cv` authenticate, check owner / applied-to company / admin, check that the path sits in the applicant's folder, and redirect to a **60 s** signed URL with `no-store` (`app/api/application/[id]/cv/route.ts:21-70`, `lib/server/cv-download.ts:10-35`). A denied request returns 404.
- *Tests:* `files-and-cv.test.ts`, `applications-cv-upload.routes.test.ts`.
- *BLOCKED because:*
  - The production `cv` bucket's `public` flag and storage policies have never been checked. If the bucket is public, every legacy `/object/public/cv/…` URL works for anyone.
  - Nothing in the repo sets bucket privacy. `docs/security/PRODUCTION_READINESS.md` says only that the **test** project is private.
- *Remaining:* run the read-only SQL in §7, and do the logged-out link check.

**S7: rate limits and AI quota.**
- *Implementation:*

| Route | Limit |
|---|---|
| Login | per IP + per account, inside `authorize` (`lib/auth.ts:113-120`) |
| Register | per IP + per email |
| Forgot password | per IP + per email |
| Reset password | per IP |
| Verify email | per IP |
| 3 AI routes | per-user/IP limits **and** `consumeAIQuota` with refund (`generate-with-ai/route.ts:99`, `scrape-from-url/route.ts:116`, `onboarding/cv-parse/route.ts:122`) |

  - Fail-closed by default.
  - The in-memory store is never used in production (`lib/rate-limit.ts:147-161`).
- *Tests:* `rate-limit.test.ts`, `redis-upstash.test.ts`, the AI-quota route tests. They use the real `@upstash/redis` client against a **fake** REST server.
- *Why UNVERIFIED:* that fake **emulates** the Lua scripts (`FIXED_WINDOW_LUA`, `REFUND_LUA`, `PUBLISH_MAX_LUA`). The test file says so itself. The Lua source has never run in a real Redis, and login depends on it (fail-closed).
- *Remaining:* one run against a disposable Upstash database.

**S8: reset token logging.**
- No `console.log` of URLs or tokens.
- The forgot-password route logs only the error name.
- `lib/logger.ts` redacts.
- `instrumentation.ts` logs paths without the query string.
- *Tests:* `one-time-token.test.ts`, the "logger redacts tokens" test.

**S9: benefit ownership.**
- POST checks ownership before the create (`app/api/job-offers/route.ts:374-382`).
- PUT checks inside the transaction against the **job's** company (`app/api/job-offers/[jobId]/route.ts:353-358`).
- The admin job editor strips `benefitIds` (`app/api/admin/job-offers/[id]/route.ts:76-80`).
- *Tests:* "POST: another company's benefit … → 400", "PUT: cross-tenant benefit attachment rejected", "PUT: admin … only with THAT company's benefits".
- *Negative control:* removing the `companyId` condition made **3 tests fail**.

**S10: generic errors.**
- The only `error.message` values returned to clients are fixed messages of domain error classes (`app/api/profile/route.ts:556, 567`).
- Other `.message` uses are equality checks or server-side logs (`export/route.ts:284, 340` logs a stack to the logger only).
- `deleteFile` returns a fixed string (`lib/supabase.ts:248-251`).
- *Tests:* `assertNotLeaked` checks across the integration suites; the health test.
- *Info:* `/api/health` reports which services are "not configured". That is low-value information disclosure behind a 30/min limit.

**A3: security headers.**
- *Implementation:*
  - `/(.*)` gets HSTS (preload), `Referrer-Policy: strict-origin-when-cross-origin` (valid) and `Permissions-Policy`.
  - Pages (`/((?!api/).*)`) get `X-Frame-Options: DENY`, `nosniff` and an **enforced** CSP `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`, plus a full **Report-Only** CSP.
  - `/api/*` gets XFO, nosniff and its own CSP (`next.config.ts:69-150`).
- *Tests:* `next-config.test.ts`, `launch-plan.test.ts` A3.
- *Why PARTIAL:*
  1. The policy that restricts scripts is Report-Only. It has **no reporting endpoint**, so a "staging shows no violations" check can only be done by hand in browser consoles.
  2. Even once enforced, `script-src 'unsafe-inline'` gives little XSS protection.
  3. The securityheaders.com grade has not been measured (needs a deployed URL).
- The anti-framing acceptance criterion **is** met in config.

**A4: public endpoints.**
- Views: per-IP 60/min and a 1/hour/IP/job dedupe. Only PUBLISHED, not deleted, not expired jobs of an active company are counted (`views/route.ts:12-71`).
- Web-vitals: 60/min. Health: 30/min. All three fail open, which suits cheap public reads.
- *Tests:* NF-07 view tests, web-vitals and health 429 tests.
- *Note:* behind Vercel, `getClientIp` trusts `x-real-ip`; elsewhere, the last XFF hop (`lib/utils.ts:187-207`). Correct for Vercel.

**A5: lower-case emails.**
- *Implementation:*
  - `normalizeEmail` is used at register, login, reset and in the OAuth adapter.
  - `findUserByEmail` falls back to a case-insensitive lookup and refuses ambiguous legacy duplicates.
  - `emailIsTaken` checks every case variant (`app/api/auth/register/route.ts:105`).
- *Tests:* `user-email.test.ts` (16), NF-06 route tests.
- *Why PARTIAL:*
  - The PDF says "check the database for existing duplicates first". That has not been done (needs production read access).
  - Uniqueness is still the exact-match `@unique` on `email`. There is no `lower(email)` index.
  - Legacy duplicate case variants would make login return `null` for both accounts.
- *Behaviour note:* registering a taken address returns the generic "check your email" response (enumeration-safe), not an explicit refusal. No account is created.

**A8: hashed tokens and session revocation.**
- Tokens are SHA-256 hashed (`lib/security/one-time-token.ts:12-18`), single-use and expiring.
- Consumed in one transaction with the password update. Other reset tokens are deleted, and `sessionVersion` is bumped (`reset-password/route.ts:40-66`, `lib/server/session-revocation.ts:78`), then published to Redis for immediate effect.
- Without Redis, revocation takes effect at the next DB re-read (≤ 15 min).
- *Tests:* `one-time-token.test.ts`, `session-revocation.test.ts`, "reset: full flow … old sessions revoked".
- *Deploy dependency:* migration `20261109120000_add_user_session_version` must be applied **before** this code is deployed, or every session fails.

**A11: dependencies.**
- `xlsx` is absent. `pdfjs-dist` 6.4.299 runs in a worker.
- `npm audit --omit=dev`: **0 critical / 0 high / 2 moderate** (`uuid` via `exceljs`).
- **Full `npm audit`: 13 high, 9 moderate, 2 low**. All are in dev tooling (`@lhci/cli` → lighthouse/puppeteer: `basic-ftp`, `extract-zip`, `tmp`, a nested `zod`).
- *Why PARTIAL:* the "Done when" ("npm audit reports no high or critical issues") is met for the shipped tree only.
- The CI gate is `--audit-level=critical`, which would not catch a new **high** in production dependencies.

#### Setup and operations

**F6: tooling and documentation.**
- `README.md` (setup, database, quality checks), `CLAUDE.md` and `.env.example` (94 lines) exist.
- `dotenv` and `tsx` are devDependencies.
- `prisma.config.ts` resolves `DIRECT_DATABASE_URL ?? DIRECT_URL`. Node is pinned (`engines` 22.x, `.nvmrc`).
- *Why PARTIAL:*
  - `CLAUDE.md`, `.nvmrc` and all docs are **untracked**, and `README.md` and `.env.example` are uncommitted edits. A fresh clone today gets none of this.
  - The "fresh clone installs and runs" check has not been done.
  - `npm run seed:perf` points at the gitignored `prisma/seed-k6.ts`.

**Q1: CI on pull requests.**
- `.github/workflows/ci.yml` defines: typecheck, lint, both test suites, build, `npm audit --omit=dev --audit-level=critical`, and a **migrations** job (replays every migration on a throwaway Postgres 16, checks drift and the trigram indexes). It uses no secrets.
- *Why PARTIAL:* the file is **untracked**, so it has never run on GitHub. The migrations job has never run anywhere.
- *This audit:* all quality-job steps pass locally, and pass on the clean file set (§6).

**A9: operations.**
- *Architecture mismatch:* the PDF assumes a self-hosted VPS (PR #9). The repository deploys to **Vercel** with **Supabase** Postgres/Storage and **Upstash** Redis:
  - `vercel.json` and commit `60004c0 deploy vercel`;
  - no `deploy/`, Dockerfile or server config;
  - `git ls-remote` shows no PR refs.
  - The VPS hygiene items (firewall, SSH keys, unattended upgrades) do not apply unless a VPS exists elsewhere.
- *Implementation:*
  - `scripts/ops/backup-db.sh`, `backup-storage.sh` and `restore-test.sh` (the restore script refuses production and checks the host);
  - `instrumentation.ts` `onRequestError` with an optional alert webhook;
  - the `docs/OPERATIONS.md` runbook.
- *Why BLOCKED:*
  - no backup has run;
  - no restore has been tested;
  - no uptime monitor, log drain or alert exists;
  - Supabase's own backup and PITR level is unknown.
- **Critical** for launch.

#### Core flows

**F1: role at sign-up.**
- Candidate sign-up is open. Google sign-up creates a CANDIDATE (`lib/server/auth-adapter.ts:62`).
- A COMPANY is created only with a valid admin invitation token. Roles are set only on the server.
- *Why BLOCKED:* the business decision (invite-only vs open company sign-up) is still recorded as pending.
- *Note:* under invite-only, "a new company registers, onboards and posts a job with no database edits" is achievable through the admin invitation UI. That has not been exercised end to end in a browser.

**F2: email and recovery pages.**
- `/forgot-password`, `/reset-password` and `/verify-email` exist, with their APIs.
- `lib/email/index.ts` has a Resend transport selected by `EMAIL_PROVIDER` (default `disabled`). Tokens travel in the URL fragment, and responses are generic.
- *Tests:* `email.test.ts`, `auth-flows.routes.test.ts` (with a capture transport).
- *Why BLOCKED:* no provider key, no verified sending domain (SPF/DKIM), no email ever delivered. Password recovery is **unusable** in production until this is done.

**F3: benefits saving.**
- `syncCompanyBenefits` runs only when `benefits !== undefined` (`app/api/profile/route.ts:867-868`). Benefits are reconciled by id.
- The old `PUT /api/dashboard/company` that replaced every benefit is gone.
- *Test:* A6 "saving one field leaves … benefits + job links unchanged".

**F4: callbackUrl and apply page.**
- `safeCallbackPath` allows same-site paths only (`lib/security/safe-redirect.ts:18-40`, used at `components/auth/login-form.tsx:16, 67`).
- The apply page checks "already applied" on load and maps error codes inline. A duplicate gets a 409.
- *Tests:* `safe-redirect.test.ts`, the duplicate-409 tests.
- *Why UNVERIFIED:* the acceptance criterion is browser behaviour (return to the same job, the message shown). The page's UI states have no automated test and no browser run.

**F5: admin.**
- `/dashboard` routes by DB role.
- The admin area has users, companies, invitations and stats. The stats page reads live Prisma counts (`app/(dashboard)/dashboard/admin/stats/page.tsx`).
- Link scan (this audit): every internal link target found in `app/`, `components/` and `lib/` matches a route in the build output.

**F7: dashboards.**
- The candidate, company and admin dashboards read scoped Prisma counts. No hard-coded metrics were found.
- *Tests:* `dashboard-redirects.test.ts`, `remaining-routes.test.ts` dashboard tests.
- Comparing the numbers with production data is part of Q4.

**A1: application eligibility.**
- `rejectionFor` refuses deleted, unpublished, expired and suspended-company jobs, and EXTERNAL jobs get a 400 (`app/api/application/route.ts:26-49`).
- The check runs before the insert **and again inside the transaction** (`:316-380`).
- Profile completeness is enforced by the API (`lib/candidate-profile-completeness.ts`).
- *Tests:* "expired jobs refuse applications", "D: deleted company, expired job and draft job all refuse applications", the A1 tests.
- *Negative control:* removing the expiry check made **2 tests fail**.
  - That control did **not** fail `remaining-routes.test.ts`, as expected: the coverage lives in two other files.

**A2: nightly expiry.**
- `vercel.json` cron at `0 2 * * *` calls `GET /api/job-offers/expire`, which requires `Bearer $CRON_SECRET` (constant-time compare). It returns 503 if the secret is unset.
- The update is idempotent and conditional, followed by an immediate cache expiry (`lib/server/job-expiry.ts`).
- Reads already hide expired jobs by time, so this is lifecycle housekeeping.
- *Why BLOCKED:* `CRON_SECRET` has not been confirmed in Vercel, and no run has been observed.

**A6: company profile.**
- Only the fields sent are written (`app/api/profile/route.ts:765-838`). Public caches are expired with `{ expire: 0 }` (`lib/cache.ts:72-86`).
- A slug change records a redirect. The page and API answer with a 308, and other companies cannot claim old slugs (`lib/server/company-slug.ts`, `app/(public)/companies/[slug]/page.tsx:266`).
- *Tests:* 5 A6 route tests.
- *Why UNVERIFIED:*
  - "A new logo shows on the public page straight away" is runtime cache behaviour on Vercel. The tests mock `next/cache` and only show that the right call is made.
  - The redirect table needs migration `20261111090000`.

**A7: status workflow.**
- *Workflow:* NOUVEAU → {review, interview, rejected}; REFUSE → only back to review; no Rejected→Hired (`lib/application-status.ts`).
- The PUT does an optimistic conditional update, writes a history row and a candidate notification **in the same transaction**, then invalidates analytics (`app/api/application/[id]/route.ts:255-340`).
- `/api/notifications` is user-scoped.
- *Tests:* A7 route and unit tests; the earlier negative control is documented.
- *Notes:*
  - Needs migration `20261111090000`.
  - Concurrency has been tested only through the code path.
  - A wrong company gets 403 (not 404), which reveals that the id exists. Low risk.

**Q2: end-to-end test.**
- `tests/integration/journey-candidate-apply.test.ts`: register → onboarding → AND search → apply → duplicate 409 → company notified and processes → candidate sees status, no notes.
- *Why PARTIAL:*
  - It runs real route handlers against the in-memory Prisma fake, with a DB-derived session. It is not a browser, and not real Postgres.
  - It is untracked, so it has never run in CI.
  - No Playwright suite exists (`tests/e2e` is gone; the `playwright-report/` deletion is staged).

#### Search and content

**P1: search.**
- Each filter group is a separate `AND` entry; values inside a group are OR/`in` (`lib/job-offers-utils.ts:52-129`).
- The visitor activity filter is applied. Filters live in the URL and requests are cancelled with `AbortController`. Filtering runs on explicit Apply/Enter, so no debounce is needed.
- *Test:* journey ("Alpha" + Tunis → 1; + Sousse → 0), `job-offers.routes.test.ts`.
- A location + category + activity combination is AND by construction (each pushes its own `andConditions` entry).

**P2: homepage search.**
- `cx-hero-search.tsx:80` pushes `/jobs?…`. `JobsPageClient.tsx:146-167` reads `activityType`, `language`, `location` and `search`. The tiles link to `/jobs?location=Remote`.
- *Why UNVERIFIED:* there is no test, and no browser click-through.

**P3: fake content.**
- No invented statistics or real brand names render. The About stats were removed, and the homepage carousel uses real active companies.
- `FeaturedBPOCard.tsx` still contains invented recruiting copy, but nothing renders it (only the barrel `index.ts:7` exports it). Delete it (Q3).

**P4: legal pages and links.**
- `/terms` and `/privacy` exist (static). There is no `/salaries` or settings link.
- The link scan (F5) found no dead targets.
- The legal text has not been legally reviewed.

**P5: hide expired and deleted jobs.**
- One rule, `publicJobWhere()` (`lib/security/company-activity.ts:31-38`), is used by the job page, preview, by-slug API, sitemap and recommendations.
- Equivalent inline filters are used by the public list (`app/api/job-offers/route.ts:40-53` plus the builder's expiry condition), the company page (`companies/[slug]/page.tsx:148-184`, company already filtered by `activeCompanyWhere`) and the companies list counts.
- Writes call `revalidateJobOffers()` with `{ expire: 0 }`.
- *Why UNVERIFIED:*
  - "Disappears straight away" is CDN/ISR runtime behaviour, which has not been observed on Vercel.
  - **Time-based** expiry triggers no write. An expired job can stay in an ISR page for up to 600 s (`revalidate = 600`), and in the cached list for up to 60 s, until the cron or the revalidation runs. Apply is still refused by the API (A1).
- *Maintainability note:* three inline copies of the visibility rule go against the CLAUDE.md "one rule" convention. They are equivalent today.

**P6: error pages.** `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`, `app/(public)/loading.tsx` and `app/(dashboard)/dashboard/loading.tsx` all exist; `/_not-found` is in the build output.

#### UI, accessibility and SEO

**U1: brand tokens and contrast.**
- `brand-*` tokens exist with documented ratios (`app/globals.css:138-149`). White-on-green buttons now use `brand-green-strong` (5.30:1).
- *Why PARTIAL:* the acceptance criterion is "**all** text passes AA (4.5:1)", and it is not met:
  - `app/(public)/jobs/[slug]/job-detail-client.tsx:432, 444, 459, 471` use `#9aa5b6` text on white: **2.49:1** (computed with the WCAG formula).
  - About 114 `text-slate-400`/`text-gray-400`/`#9aa5b6`-style uses remain (slate-400 on white is 2.56:1). Many are icons, but not all.
  - 401 hard-coded hex colour classes are not yet tokens.

**U2: accessibility labels.**
- Labels were added to job filters, chip removals, row actions, the notification bell and the status select. Filters are native `<select>`s, and the results count uses `aria-live`.
- *Why PARTIAL:* icon-only buttons with no accessible name remain:
  - `components/ui/dialog.tsx:114` (the shared close button, used by every dialog);
  - `app/(dashboard)/dashboard/company/(onboarded)/jobs/[jobId]/applications/candidate-review-modal.tsx:188`;
  - the pagers in `JobsPageClient.tsx:614` and `CompaniesPageClient.tsx:447, 478`, whose `‹`/`›` glyphs have no label, and whose active page has no `aria-current` (`PagerButton.tsx:9`).
- No screen-reader or keyboard pass has been done.

**U3: SEO.**
- `app/sitemap.ts` (request-time, `publicJobWhere`/`activeCompanyWhere`), `app/robots.ts` (private areas disallowed), `app/opengraph-image.tsx`, per-page metadata, and JSON-LD escaped against `</script>` (`lib/seo/job-posting.ts:73`).
- *Why PARTIAL:*
  - **N-2:** remote jobs (`lib/seo/job-posting.ts:62-65`) have no `applicantLocationRequirements`, and fully remote jobs have no `jobLocation`. Google's JobPosting guidelines require them, so expect Rich Results errors on those pages.
  - `addressCountry` is never set (a Google warning).
  - The Rich Results Test is blocked until there is a public URL.
  - `robots.txt` is **static**: its sitemap URL comes from `APP_URL`/`NEXT_PUBLIC_APP_URL` at **build** time, falling back to `http://localhost:3000` (`lib/seo/site-url.ts:7`).

**A10: public caching.** Build output (this audit):

| Mode | Routes |
|---|---|
| ○ static | `/jobs` (5 min), `/companies` (10 min), `/about`, `/privacy`, `/terms` |
| ● ISR | `/jobs/[slug]`, `/companies/[slug]` |
| ƒ dynamic | `/` (by design) |

- `app/(public)/layout.tsx` no longer calls `auth()`. HEAD still does.

**A12: AI calls.**
- Each AI call has an SDK timeout and a retry cap (`lib/ai-service.ts:35-36`). Each route is bounded by `AI_ROUTE_DEADLINE_MS` = 28 s with `AbortSignal.timeout`.
- *Why PARTIAL:* AI output is `JSON.parse`d and mapped defensively, **not schema-validated** (`lib/ai-service.ts:209, 371, 497`). Writes are re-validated with zod later, which limits the impact.

**Q3: lint and dead code.**
- `npm run lint:ci`: **0 errors, 34 warnings** (ratchet ≤ 35). The stale files listed in the PDF (`tmp-dbcheck.ts`, `false))`, etc.) are deleted.
- Leftovers:
  - `FeaturedBPOCard.tsx`;
  - an unused `Users` import in `components/landing/cx-hero-search.tsx:6`;
  - the `seed:perf` script pointing at an ignored file.

**Q4: manual QA.** BLOCKED: there is no browser or device evidence. The plan is in `docs/PRODUCTION-READINESS-AUDIT.md` §6.

---

## Section 3: Critical security findings

Ordered by severity. *Repository* = fixed in code (working tree). *Production* = state of the live system, which cannot be observed from here.

| # | Severity | Finding | Repository | Production |
|---|---|---|---|---|
| C-1 | **Critical** | The production session-signing secret (`NEXTAUTH_SECRET`) was in a developer `.env`. 205 production-issued tokens were derived from it (Gate 0, G0-2). Anyone holding it can forge a session for any account, including admin. | Local copy moved out; the dev `.env` now holds only localhost values (verified this audit: every host is `localhost`, all remote service variables empty) | **Not rotated** (Gate 0 §10.6/§11.2: "prepared; NOT executed"). Treat it as compromised until Vercel shows a new `AUTH_SECRET` and old sessions fail |
| C-2 | **Critical** | The code that can be deployed (HEAD/`origin`) still has S2 and S3. `GET /api/application/[id]` returns `notes` to candidates (`include`). `GET /api/job-offers` lets `?companyId=` override the company scope (HEAD `route.ts:246-248`), and a COMPANY user with **no profile** gets an unfiltered query over every company's drafts. | Fixed in the working tree | Unknown. If production runs HEAD or older, these leaks are live |
| C-3 | High | The shared seed/test passwords are in pushed Git history (G0-4, G0.1-1, including an admin-domain COMPANY account). Seeded, k6 and IDOR test accounts may exist in production. | Removed from current source (this audit: only synthetic fixtures such as `Strong-Pass-9` remain in tests). Seeds require an env password and refuse production | **Not verified**: accounts not counted, deactivated or rotated |
| C-4 | High | Other production credentials (DB password, Supabase service-role key, Upstash token, Google secret, invitation key) sat in a plain-text local file | Moved out of the repository | Rotation recommended, **not done** |
| C-5 | High | `cv` bucket privacy in production is unverified (S6) | Code serves only signed 60 s URLs | Unknown |
| C-6 | Medium | Session revocation (A8) and suspension revocation depend on the `sessionVersion` column | Code ready | Migration not applied |
| C-7 | Medium | The page CSP that restricts scripts is not enforced, and violations aren't reported (A3) | Report-Only | — |
| C-8 | Low | Dev-only high advisories (13) in the `@lhci/cli` chain (A11) | — | Not shipped |

**Credential-exposure remediation: detailed checks (repository side)**

| Check | Result |
|---|---|
| `AUTH_SECRET` vs `NEXTAUTH_SECRET` precedence | `lib/auth.ts:39`: `AUTH_SECRET ?? NEXTAUTH_SECRET`. If Vercel still has only the old `NEXTAUTH_SECRET`, it remains the signing key. `lib/env.ts:57, 90-92` warns if it is shorter than 32 characters |
| Hard-coded passwords in current source | None in seeds, scripts or k6 generators. Only synthetic test fixtures remain. `prisma/seed-guard.ts` requires `SEED_*` env passwords |
| Production DB guard: Prisma CLI | `prisma.config.ts` throws when any of the three URLs contains the production project ref, unless `CXJOBS_ALLOW_PRODUCTION_DATABASE=I_UNDERSTAND_THIS_IS_PRODUCTION` |
| Production DB guard: runtime and scripts | `lib/prisma.ts:22` (exempt when `VERCEL=1`), `scripts/get-job-ids.ts:7`, and `assertSeedTargetAllowed` in all three seeds |
| Guard limitation | It matches **one** hard-coded project ref. A rotated, renamed or staging production-like project is not covered |
| Session invalidation | Per-account (`sessionVersion`) only after the migration and the new code. Before that, only rotating the secret revokes sessions |
| `.gitignore` | `.env` and `.env.*` (except `.env.example`), `playwright-report/`, the k6 cookie files and ignored k6 scripts are ignored (verified with `git check-ignore`) |
| Playwright report | Tracked at HEAD; its removal is **staged, not committed** (3 deletions) |
| Local `.env` | Development values only (verified this audit) |
| Can the repo prove the secret was rotated? | **No.** Only Vercel's environment settings can (§7) |

---

## Section 4: Functional gaps

| Area | Gap | IDs |
|---|---|---|
| Authentication | No email delivery: forgot password, reset and verify cannot work in production. Email verification stays off (`REQUIRE_EMAIL_VERIFICATION=false`) | F2, A8 |
| Authentication | Legacy mixed-case duplicate emails unchecked; no case-insensitive DB constraint | A5 |
| Company onboarding | Invite-only vs open sign-up undecided; the PDF's role choice is not built | F1 |
| Company | Partial save and slug redirects need migration `20261111090000`; cache immediacy not observed | A6 |
| Applications | Status history and notifications need the same migration; no email notifications (after F2) | A7 |
| Jobs | Nightly expiry needs `CRON_SECRET`; time-expired jobs can stay up to 10 min in ISR pages (apply is refused) | A2, P5 |
| Admin | Functional; visual check pending | F5 |
| Search | Correct AND semantics; homepage wiring has no test | P1, P2 |
| Testing | No browser E2E; the journey test runs on an in-memory DB and is not in CI | Q2 |
| Operations | No backups, restore test, uptime monitor or alerting | A9 |

---

## Section 5: UI/UX, accessibility and SEO

| Area | Gap | ID |
|---|---|---|
| Contrast | `#9aa5b6` labels on the public job page at 2.49:1; ~114 `*-400` grey uses to triage; 401 hex classes not yet tokens | U1 |
| Accessibility | Unlabelled close buttons (shared `Dialog`, review modal); pagers without labels or `aria-current`; no screen-reader or keyboard pass | U2 |
| SEO | Remote-job JSON-LD likely invalid; no `addressCountry`; Rich Results not run; `APP_URL` must be set at build time for `robots.txt` | U3 |
| Caching | Static/ISR confirmed in the build; Vercel CDN behaviour (`x-vercel-cache`) and invalidation not observed | A10, P5 |
| Mobile/desktop | No manual QA | Q4 |
| Content | Dead `FeaturedBPOCard` with invented copy (not rendered) | P3, Q3 |

---

## Section 6: Test execution results

**Environment.**
- Every command ran with:
  - `DATABASE_URL`, `DIRECT_DATABASE_URL` and `DIRECT_URL` = `postgresql://placeholder:placeholder@127.0.0.1:9/placeholder`;
  - a placeholder `AUTH_SECRET`, `NEXTAUTH_SECRET` empty;
  - `EMAIL_PROVIDER=disabled`;
  - empty Upstash, Supabase and OpenAI variables. The build used `127.0.0.1:9` for these, as in CI.
- No command reached a network service. The local `.env` was confirmed development-only first.

**A. Working tree (repository checkout)**

| # | Command | Result | Detail |
|---|---|---|---|
| 1 | `npx tsc --noEmit --incremental false` | **PASS** | 0 errors |
| 2 | `npm run lint:ci` | **PASS** | 0 errors, 34 warnings (≤ 35) |
| 3 | `NODE_ENV=test npm run test:security` | **PASS** | 207 tests, 207 pass, 0 fail, 0 skipped (26.5 s) |
| 4 | `NODE_ENV=test npm run test:integration` | **PASS** | 270 tests, 270 pass, 0 fail, 0 skipped (34.6 s) |
| 5 | `npm audit --omit=dev` | exit 1 | 0 critical, 0 high, 2 moderate (`uuid` < 11.1.1 via `exceljs`) |
| 6 | `npm audit` | exit 1 | 13 high, 9 moderate, 2 low (dev tooling: `basic-ftp`, `extract-zip`, `tmp`, nested `zod`, via `@lhci/cli`) |
| 7 | `npx prisma validate` | **PASS** | schema valid (offline) |
| 8 | `npm run build` | **PASS** | 74 s; route table in §2.1 A10 |

**B. Clean file set** (`git ls-files -co --exclude-standard`, minus `playwright-report/`, copied to a scratch directory with no `.env` and `node_modules` linked). This approximates CI after a commit of the current tree.

| # | Command | Result | Detail |
|---|---|---|---|
| 9 | `npx prisma generate` | PASS | — |
| 10 | `npx tsc --noEmit --incremental false` | PASS | 0 errors |
| 11 | `npm run test:security` | 206/207 | 1 failure: "Gate 0.1: every tracked file that opens a database connection calls a production guard". It calls `git ls-files`, and the scratch copy has no `.git`. **Environment artefact**; it passes in a real checkout (run A3) |
| 12 | `npm run test:integration` | **PASS** | 270/270 |

**C. Negative controls** (scratch copy only; each file restored and byte-compared afterwards)

| Fix broken | Tests run | Result |
|---|---|---|
| S2: owner scope for **any** requested company (`job-offer-scope.ts`) | `job-offers.routes.test.ts` | 1 fail / 27 pass: detected |
| S3: `notes: true` added to `CANDIDATE_APPLICATION_SCALARS` | `applications-cv-upload.routes.test.ts` | 1 fail / 25 pass: detected |
| S9: `companyId` removed from the benefit ownership query | `job-offers.routes.test.ts` | 3 fail / 25 pass: detected |
| A1: expiry check removed from `rejectionFor` | `applications-cv-upload.routes.test.ts` + `company-suspension.test.ts` | 2 fail / 51 pass: detected |

**Not run, and why**

| Check | Reason |
|---|---|
| `prisma migrate status` / `deploy` / `diff --from-config-datasource` | Needs a Postgres; production is off-limits. The CI `migrations` job has never run |
| Playwright / browser E2E | No suite exists; no browser tooling |
| Upstash Lua on real Redis, Resend, Google OAuth, Supabase Storage | External services, no credentials (by design) |
| `next start` + HTTP header checks | Not repeated in this audit (header config verified statically and by `next-config.test.ts`) |

**Mocked vs real.** The integration suite runs the real route handlers, but against an in-memory Prisma fake, a mocked `next/cache` and a fake Upstash REST server. It proves the authorization and business logic. It does **not** prove PostgreSQL behaviour (e.g. ILIKE, transaction isolation), Redis Lua execution, or Vercel cache semantics.

---

## Section 7: External verification required

All read-only unless noted. Each needs the account named in the first column.

| Item | Access | Exact check | Pass when |
|---|---|---|---|
| C-1 session secret | Vercel (Production env) | Settings → Environment Variables. Note whether `AUTH_SECRET` and/or `NEXTAUTH_SECRET` exist. Fingerprint the value locally (`read -rs V; printf %s "$V" \| sha256sum \| cut -c1-12; unset V`) and compare with the fingerprint of the old value | A **new** `AUTH_SECRET` is set, `NEXTAUTH_SECRET` is removed, a redeploy has happened, and an old browser session gets an empty `/api/auth/session` |
| C-2 deployed code | Vercel | Deployments → Production → source commit | The deployed commit contains the fixes (i.e. after this work is merged) |
| C-3 test accounts | Supabase SQL (read-only transaction) | The queries in `docs/RELEASE-GATE-0-SECURITY-REVIEW.md` §11 (seed/k6/IDOR accounts) | 0 rows, or the accounts deactivated (separately approved write) |
| S6 CV bucket | Supabase SQL | `select id, public from storage.buckets where id='cv';` plus the policies on `storage.objects` for bucket `cv` (`docs/security/PRODUCTION_READINESS.md` §2) | `public = false`; no anon/authenticated read policy; a `/object/public/cv/<path>` URL returns 400/404 |
| A5 duplicates | Supabase SQL | `select lower(email), count(*) from users group by 1 having count(*) > 1;` | 0 rows |
| S5 legacy URLs | Supabase SQL | Count `companies` rows whose `website`/`linkedinUrl`/`twitterUrl`/`facebookUrl` are not `http(s)://…`, and image URLs not on the project storage host | 0, or cleaned |
| Migrations | Supabase (operator, approved window) | `npx prisma migrate status` with the production env file loaded explicitly | Three pending migrations are listed; applied **before** the code deploy |
| S7 Lua | Disposable Upstash DB | Run `redis-upstash.test.ts`-equivalent calls against a real Upstash test database | Limits, refunds and revocation publish behave as in the fake |
| A2 cron | Vercel | `CRON_SECRET` (≥ 16 chars) set in Production; Settings → Cron Jobs shows a 200 run | One successful nightly run |
| F2 email | Resend + DNS | Add `RESEND_API_KEY` and `EMAIL_FROM`; verify the domain (SPF/DKIM); `EMAIL_PROVIDER=resend` on staging | A reset email arrives on staging, its link resets the password, and old sessions are signed out |
| A9 operations | Backup storage, Supabase S3 keys, uptime service | Run `backup-db.sh` and `backup-storage.sh` once; run `restore-test.sh` on a scratch DB; create an uptime monitor on `/api/health`; set `ERROR_ALERT_WEBHOOK_URL` or a log drain; check the Supabase plan's backups/PITR | Backup file off-site, restore output recorded, one test alert received |
| A3 headers | Public URL | securityheaders.com on `/jobs`; DevTools console on key pages for CSP-Report-Only violations | Grade A; no violations, then switch to an enforced CSP **with** `report-to` |
| U3 SEO | Public URL | Google Rich Results Test on one on-site job and one **remote** job; fetch `/robots.txt` and `/sitemap.xml` | Valid JobPosting; production domain in robots/sitemap |
| A10 / P5 / A6 | Public URL | `curl -sI /jobs` twice (`x-vercel-cache: HIT`); close a job or change a logo, then reload the job/company page | Change visible on the next request |
| Q1 | GitHub | Commit, open a PR | `quality` and `migrations` jobs green |
| Q4 / F4 / P2 / U2 | Browsers, phone + laptop | Candidate: sign up → onboard → search from the homepage → apply → re-apply → log in from Apply. Company (invited): register → onboard → post → move an application to Interview. Keyboard-only and a screen reader on `/jobs` and the review modal | Signed-off checklist |

---

## Section 8: Regression findings

### 8.1 Current working tree vs HEAD (what is actually deployable)

HEAD `6e77684` is what `origin` holds. Gate 0 states production runs it; this audit could not confirm that.

| Item | HEAD | Working tree |
|---|---|---|
| S2 | **Defective**: `?companyId=` overrides the scope; a COMPANY user without a profile sees every company's drafts | Fixed |
| S3 | **Defective**: candidate `GET /api/application/[id]` uses `include` and returns `notes` | Fixed |
| A8 | No `sessionVersion` (0 occurrences in `lib/`); no per-account revocation | Fixed (needs migration) |
| A10 | `app/(public)/layout.tsx` calls `auth()`, so all public pages are dynamic | Fixed |
| Tests / CI | No security or integration test tracked; no `ci.yml` | 477 tests; CI defined |

### 8.2 Prior reports vs this audit

| Claim in prior docs | This audit |
|---|---|
| Security suite "201/202 (F-33 flaky)" / "206/206" / "207/207" | **207/207** (working tree) |
| Integration "270/270" | **270/270** (confirmed, also on the clean file set) |
| Lint 0 errors / 34 warnings | Confirmed |
| `npm audit --omit=dev` 0 high/critical | Confirmed |
| S7 "FIXED_AND_TESTED" | Implementation confirmed; **downgraded to UNVERIFIED**: the Lua scripts are only emulated by the test fake |
| P5 "FIXED_AND_TESTED", A6 "FIXED_AND_TESTED" | Logic confirmed; **UNVERIFIED**: immediate cache refresh is asserted only against a mocked `next/cache` |
| U3 "FIXED_AND_TESTED" | **PARTIAL**: remote-job JSON-LD gap (N-2) not covered by tests |
| U1/U2 "PARTIALLY_FIXED" | Confirmed, with concrete remaining failures (N-3, N-4) |
| A11 "FIXED_AND_TESTED (production tree)" | **PARTIAL** against the literal criterion (full audit: 13 high, dev-only) |
| F1 BLOCKED_DECISION, F2/A9/Q4 BLOCKED | Confirmed |
| G0-6 (tracked test reads ignored files, so CI fails) | **Resolved**: the N1 test reads only tracked files; the clean-file-set run confirms it |
| Gate 0 "the local `.env` holds production credentials" | **Resolved locally**: the `.env` now holds only localhost/empty values |
| "44 items" in the PDF | The PDF lists **42** IDs |
| PDF notes on PR #2/#5/#9, VPS, `fix/ci-pipeline` | None exist in this repository (no PR refs; only `main` and `hardening/production-readiness` on `origin`) |

No regression was found **within** the working tree: every fix that earlier docs claim is present and behaves as described, apart from the downgrades above.

---

## Section 9: Prioritized remediation roadmap

**P0: critical security and release blockers**
1. **Rotate the production session secret** in Vercel (new `AUTH_SECRET`, remove `NEXTAUTH_SECRET`, redeploy), and verify old sessions die (C-1).
2. **Commit the working tree** on a branch, open a PR, and get `ci.yml` green, **including the `migrations` job**. Keep the staged `playwright-report/` deletion (C-2, Q1).
3. Apply the three migrations to staging, then production, **before** deploying the code (A8, A6, A7).
4. Verify the `cv` bucket is private (S6).
5. Count and deactivate or rotate the seeded, k6 and IDOR test accounts, including the admin-domain COMPANY account (C-3).
6. Set up at least one off-site DB backup, one tested restore and one uptime alert (A9).

**P1: high-priority production blockers**
1. Email provider and verified domain; prove the reset flow end to end on staging (F2).
2. Set `CRON_SECRET` and observe one cron run (A2).
3. Run the read-only duplicate-email query (A5) and the legacy-URL query (S5).
4. Rotate the other exposed credentials: DB password, service-role key, Upstash, Google, invitation key (C-4).
5. Manual QA on phone and laptop for both roles (Q4, F4, P2).
6. Test the Upstash Lua scripts against a real test database (S7).

**P2: important functional gaps**
1. Decide F1 (invite-only vs open company sign-up).
2. Fix the remote-job JSON-LD (`applicantLocationRequirements`, `addressCountry`), then run the Rich Results Test (U3).
3. Add a CSP `report-to` endpoint, collect violations on staging, then enforce (A3).
4. A browser E2E (Playwright) against a throwaway Postgres in CI (Q2).
5. Schema-validate AI JSON output (A12).
6. After the A5 check: a `lower(email)` unique index (a hand-written migration).
7. Use `publicJobWhere()` in the three inline copies (P5 maintainability).
8. Consider `--audit-level=high` for production dependencies in CI (A11).

**P3: polish and optimization**
1. Fix the `#9aa5b6` labels and audit the `*-400` greys; migrate the hex classes to tokens (U1).
2. Give the `Dialog` and review-modal close buttons an `aria-label`; label the pagers and add `aria-current` (U2).
3. Delete `FeaturedBPOCard`, fix the unused import, and fix or remove `seed:perf` (Q3).
4. `POST /api/application`: return an explicit select (N-7). Owner job list: don't force the expiry filter (N-6).
5. Upgrade `@lhci/cli` to clear the dev-only highs (A11).

---

## Section 10: Final release decision: **NO-GO**

**Why not GO or CONDITIONAL GO today**

1. **The fixes are not deployable as they stand.**
   - Every verified fix and every test lives only in an uncommitted working tree.
   - The pushed branch still has the S2 draft-job exposure and the S3 recruiter-notes leak (§8.1), and CI has never run.
   - The code also requires three migrations that are applied nowhere. Deploying it before `sessionVersion` exists would break every session.
2. **The credential incident is still open in production.**
   - Rotating the production session secret is documented but not executed. Until it is, anyone holding the old value can forge an admin session.
   - Seeded accounts with passwords from pushed history may exist in production.
   - Neither can be ruled out from the repository.
3. **There is no safety net.** There are no backups or tested restore (A9), no alerting, and no email delivery. Account recovery is therefore impossible (F2).
4. **No human or browser has exercised the product** (Q4).

**What has been demonstrated**
- The working-tree code meets the plan's security intent: 21 items PASS, and none FAIL.
- 477 automated tests pass (207 security + 270 integration). Deliberately breaking S2, S3, S9 and A1 makes their tests fail.
- The production build is clean, and public pages are static or ISR.

**Path to CONDITIONAL GO.** Complete roadmap **P0 items 1–6**, with the evidence listed in §7. CONDITIONAL GO can then be granted, on condition that P1 items 1–2 (email, cron) are finished before public announcement, and P1 items 3–6 within the first week.

**Path to GO.** P0 and P1 complete, the U3 JSON-LD fix and a passing Rich Results Test, plus a signed-off Q4 checklist.

*This audit changed no source file. It made no commit, push, deploy, migration or external connection. The working tree (204 status entries, 3 staged deletions) was preserved. Scratch copies used for the clean-tree run and the negative controls are outside the repository.*

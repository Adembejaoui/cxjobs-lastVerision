# CXJobs: launch plan remediation ledger

- **Source of truth:** *CXJobs Launch Action Plan (updated 8 Nov)* (PDF, 44 items).
- **Worked on:** 11 Nov 2026, branch `hardening/production-readiness`, HEAD `6e77684` plus the **uncommitted** working tree.
- **Companion documents:** `docs/PRODUCTION-READINESS-REPORT.md` (summary and verdict), `docs/OPERATIONS.md` (A9 runbook).

## How to read this ledger

**Statuses**

| Status | Meaning |
|---|---|
| VERIFIED_FIXED | The fix was already in the code (earlier phases), re-checked now, with a passing test |
| FIXED_AND_TESTED | Fixed in this pass, with a passing regression test |
| PARTIALLY_FIXED | Part of the item is fixed; the remainder is listed |
| BLOCKED_EXTERNAL | Needs an account, credential, infrastructure or browser that is not available here |
| BLOCKED_DECISION | Needs a business decision |
| OPEN | Not addressed |
| NOT_APPLICABLE_WITH_EVIDENCE | Does not apply, with the evidence why |

**Evidence**
- Commands ran with every `.env` variable overridden by unroutable placeholders (the CI `env` block), so no check could reach the production database.
- Final counts: security tests **202 (201 pass; 1 failure = the known load-sensitive PDF timing test F-33, which passes 9/9 in three isolated re-runs)**, integration tests **270/270**, tsc 0 errors, ESLint 0 errors / 34 warnings, build passes.
- The command log is in §C.

**Discrepancy with the PDF.** The PDF notes cite "PR #2", "PR #5", "PR #9 (storage moved to our own server, VPS)" and a "fix/ci-pipeline branch". **None of these exist in this repository**: `git ls-remote origin` shows no `refs/pull/*`, and there is no such branch. The code uses Supabase Storage and deploys to Vercel. Items are judged against the code, not the PDF notes.

---

## A. Ledger

### Security (days 1–2)

| ID | Prio | PDF status | Current status | Root cause / evidence | Changes in this pass | Verification | Remaining |
|---|---|---|---|---|---|---|---|
| **S1** Session update callback | Critical | Done | **VERIFIED_FIXED** | `lib/auth-callbacks.ts`: an `update()` only forces a DB re-read, and role, id and isOnboarded come from the DB row. | — | `auth-flows.routes.test.ts` "session: client update() cannot escalate role" (real Auth.js handlers) passes | — |
| **S2** Company job isolation | High | Not started | **VERIFIED_FIXED** | `lib/security/job-offer-scope.ts`: `?companyId=` never widens scope; owner scope comes only from the session's company. | — | `job-offers.routes.test.ts` S2 / NF-03 tests (cross-company drafts, query manipulation, unauthenticated) pass | — |
| **S3** Notes in candidate responses | High | Not started | **VERIFIED_FIXED** | Explicit allow-list (`lib/security/application-fields.ts`, `app/api/application/[id]/route.ts`). | Status-change notifications carry no notes (A7). | Integration tests on the `SECRET_NOTE` marker, plus the new journey test (step 7) and the A7 notification test | — |
| **S4** SSRF in job scraper | High | In progress | **VERIFIED_FIXED** | `lib/job-scraper.ts`: https and port 443 only; every resolved address must be public (any blocked address → refused); IPv4-mapped IPv6 blocked; the connect-time guarded `lookup` pins the connection to the validated address (DNS-rebinding safe; TLS still verifies the hostname); every redirect re-validated, max 3; byte cap; timeout. | — | `tests/security/ssrf.test.ts` (15 tests: loopback, metadata 169.254.169.254, private ranges, mapped v6, encoded literals, rebinding, redirects, real transport) pass | — |
| **S5** Shared URL validator, image hosts | High | Not started | **FIXED_AND_TESTED** | `safe-url.ts` already covered most URL fields. **Open:** image URLs accepted any host; company LinkedIn/Twitter/Facebook URLs were free text (`javascript:` accepted). | `optionalStorageImageUrlSchema` / `isOwnStorageImageUrl` (https, this project's Supabase host only, public image buckets only, no traversal, no credentials or port) applied to avatar, logo, cover, culture image (profile, onboarding, admin). Social links use `optionalSafeUrlSchema`. | `launch-plan.test.ts` S5 (12 bad URLs); `launch-plan.routes.test.ts` S5 (9 payloads rejected, nothing written); `safe-url.test.ts` updated | Rows saved earlier with a third-party image URL must be re-uploaded before their next profile save |
| **S6** Private CVs | High | Done | **PARTIALLY_FIXED** (code verified; infrastructure **BLOCKED_EXTERNAL**) | Code: CVs are served only after an owner or applied-to-company check, with 60 s signed URLs and no public path (`lib/security/cv-access.ts`, `lib/server/cv-download.ts`). | — | `files-and-cv.test.ts`, `applications-cv-upload.routes.test.ts` pass | **The `cv` bucket's `public` flag and storage policies have never been verified** (audit B3/F-01). Read-only SQL in `docs/security/PRODUCTION_READINESS.md` §2. The CV link check in a logged-out browser has not been done |
| **S7** Rate limits + daily AI quota | High | In progress | **FIXED_AND_TESTED** | Rate limits already existed on auth and AI routes. **Open:** no daily per-user AI quota. | `lib/security/ai-quota.ts`: UTC-day key on the atomic Redis counter, shared by the 3 AI routes, fail-closed, `AI_DAILY_QUOTA` (default 30), 429 `AI_QUOTA_EXCEEDED` with `Retry-After`. Consumed only after validation. **Refunded** on failure (new atomic `REFUND_LUA`, never negative). CV parsing falls back to non-AI parsing when the quota is exhausted. | 4 route tests (cap across IPs, per-user isolation, refund, validation first, 4 concurrent requests → exactly 2 allowed) plus 2 unit tests. **Negative control:** the tests fail with the quota disabled. | Real Upstash execution of the Lua scripts not verified (needs staging) |
| **S8** Reset URL logged | High | Done | **VERIFIED_FIXED** | No token logging; logger redaction. | `instrumentation.ts` error hook logs paths without query strings. | `one-time-token.test.ts`, "S8/S10: logger redacts tokens…" pass | — |
| **S9** Benefit ownership | Medium | Not started | **VERIFIED_FIXED** | POST and PUT both call `validateBenefitOwnership` inside the transaction (`app/api/job-offers/[jobId]/route.ts:353`). | — | `job-offers.routes.test.ts` benefit tests (foreign id rejected, rollback) pass | — |
| **S10** Generic errors | Low | Not started | **VERIFIED_FIXED** | Repo-wide search: the only `error.message` in responses are fixed messages of domain error classes (`ProfileRelationError`, `DuplicateRelationIdError`). | AI and expiry routes log the error name only. | Leak assertions in the integration tests (`assertNotLeaked`; the health test checks for `Error:`, hosts, keys); a live check of the built server showed only React digests on a 500 | — |
| **A3** Security headers | High | Not started | **PARTIALLY_FIXED** | Already done: headers on every page, valid `Referrer-Policy`. **Open:** no script policy (F-16). | Full page CSP added as `Content-Security-Policy-Report-Only` (default-src self, explicit hosts, no `unsafe-eval` in production). The enforced minimal CSP and XFO DENY are kept. | `launch-plan.test.ts` A3; **live `next start` check**: all headers present on `/jobs`, `/about`, `/privacy` | Enforce the full CSP once staging shows no violations; securityheaders.com grade not measured (needs a public URL). Nonces are impossible without making pages dynamic (conflicts with A10) |
| **A4** Public endpoint limits | Medium | Not started | **FIXED_AND_TESTED** | Views (per-IP + dedupe) and web-vitals were already limited; views counted only for live jobs. **Open:** `/api/health` had no limit. | Health: 30/min per IP, fail-open, 429 with `Retry-After`. OpenAI check labelled "configured (not probed)" (F-28). | New health 429 test; NF-07 view tests (drafts, deleted, expired not counted) pass | — |
| **A5** Lower-case emails | Medium | Not started | **PARTIALLY_FIXED** | Done earlier: register, login, reset and Google normalize; any case variant counts as taken (`lib/server/user-email.ts`); new rows are lowercase, so the existing exact unique index enforces case-insensitive uniqueness for every new row. | Company contact email check now uses `emailIsTaken` (F-31). | NF-06 tests (16) pass | **Legacy mixed-case duplicates in production are unknown** (B4/F-07). Run `select lower(email), count(*) from users group by 1 having count(*) > 1;` read-only. A `lower(email)` unique index is deliberately **not** added: it would fail `migrate deploy` if duplicates exist, and Prisma can't declare expression indexes. Add it after the data check |
| **A8** Hashed tokens + session revocation | Medium | Not started | **VERIFIED_FIXED** | SHA-256 stored, single use, expiring, consumed in the same transaction as the password update, which also bumps `sessionVersion`. | — | S8 tests (reuse, concurrency, expiry, hash not replayable) and "reset: full flow … old sessions revoked" pass | — |
| **A11** Dependencies | Medium | Not started | **FIXED_AND_TESTED** (production tree) | `xlsx` absent. `pdfjs-dist` 6.4.299: the build contains **no** `isEvalSupported` / `new Function` code path (eval removed upstream), so CVE-2024-4367 doesn't apply. | — | `npm audit --omit=dev`: **0 critical, 0 high**, 2 moderate (`exceljs`→`uuid`; vulnerable `buf` path unreachable, see the earlier audit) | Dev-only highs (13, all in the `@lhci/cli` → lighthouse → puppeteer chain, including a nested zod 3.25) are not shipped. Fixing them needs a major `@lhci/cli` bump |

### Setup (days 1–2)

| ID | Prio | PDF | Current | Evidence / changes | Verification | Remaining |
|---|---|---|---|---|---|---|
| **F6** .env.example, README, CLAUDE.md | High | In progress | **FIXED_AND_TESTED** | Real `README.md` and `CLAUDE.md` written. `.env.example` documents every variable (new: `CRON_SECRET`, `AI_DAILY_QUOTA`, `SEED_*`, `K6_*`, `ERROR_ALERT_WEBHOOK_URL`). `dotenv` and `tsx` are devDependencies. **DIRECT_URL vs DIRECT_DATABASE_URL resolved from the code:** `prisma.config.ts` reads `DIRECT_DATABASE_URL`, falling back to `DIRECT_URL` (legacy); `lib/env.ts` and `.env.example` use `DIRECT_DATABASE_URL`. Node pinned (`engines` 22.x, `.nvmrc`). | `env-validation.test.ts` | "A fresh clone installs and runs by following the README" not exercised on a clean machine |
| **Q1** CI on pull requests | High | In progress | **PARTIALLY_FIXED** | `.github/workflows/ci.yml` (typecheck, lint, both suites, build, audit) exists but is **untracked**, so it has never run on GitHub. Added a **migrations** job: replays all migrations on a Postgres 16 service container, fails on schema drift, checks the trigram indexes. CI-safety tests refined to allow only that loopback container. | Every CI step reproduced locally except the migrations job (no Postgres/Docker here; local PGlite was refused by the sandbox) | Commit, open a PR and see it green. The migrations job is **unverified** until it runs |
| **A9** Self-hosted operations | Critical | Not started | **BLOCKED_EXTERNAL** | The repo is on Vercel + Supabase (no VPS; see the discrepancy note above). Added: `scripts/ops/backup-db.sh` (pg_dump → age → rclone off-site), `scripts/ops/backup-storage.sh`, `scripts/ops/restore-test.sh` (refuses production; host confirmation), `instrumentation.ts` `onRequestError` (one structured, redacted line per unhandled error, optional alert webhook), and the `docs/OPERATIONS.md` runbook. | Script syntax checked; restore guards verified (production and host mismatch refused); error hook type-checked | **No backup has run, no restore was tested, no uptime monitor or alert exists.** All need accounts or credentials (runbook §1–2) |

### Core flows (days 3–5)

| ID | Prio | PDF | Current | Evidence / changes | Verification | Remaining |
|---|---|---|---|---|---|---|
| **F1** Role choice at sign-up | Critical | Blocked | **BLOCKED_DECISION** | Invite-only company onboarding is preserved (admin invitation link; register route creates COMPANY only with a valid invitation token). Candidate sign-up is open. Roles are set server-side only. | `invitations.routes.test.ts`, `auth-flows` (role server-derived), journey test (new user → CANDIDATE) | Decide open vs invite-only company sign-up |
| **F2** Email + recovery pages | Critical | Not started | **PARTIALLY_FIXED** (code) / **BLOCKED_EXTERNAL** (delivery) | Pages `/forgot-password`, `/reset-password`, `/verify-email` and APIs exist; Resend transport behind `EMAIL_PROVIDER`; tokens in the URL fragment; generic responses. | `auth-flows.routes.test.ts` (reset, verify, resend, enumeration-safe) and `email.test.ts` pass with a capture transport | **No email has ever been delivered.** Needs a Resend key and a verified domain (SPF/DKIM) |
| **F3** Benefits saved by id | Critical | In progress | **FIXED_AND_TESTED** | Omitted `benefits` → unchanged (`benefits !== undefined`). The divergent `PUT /api/dashboard/company`, which replaced all benefits, was **removed** (F-19). | A6 test "saving one field leaves benefits and job links unchanged" (twice); PUT-removed assertions | — |
| **F4** callbackUrl + apply page states | High | Not started | **FIXED_AND_TESTED** | Login already honoured a validated same-site `callbackUrl`. Apply page: waits for the client session; checks **already applied on load**; a submit failure no longer replaces the page with "Job Not Found"; inline `role=alert` errors per code (duplicate → "already applied" view; profile incomplete → completion view; 401 → login with return path; 404; 429). Duplicate now **409**. | `safe-redirect.test.ts`; duplicate 409 tests; journey test | Browser check of the page states (Q4) |
| **F7** Real dashboard data | High | In progress | **VERIFIED_FIXED** | Candidate and company dashboards read DB counts scoped to the user or company, with empty states; no hard-coded numbers or fake activity (repo search). | `dashboard-redirects.test.ts`, `remaining-routes` dashboard tests | Numbers against production data not compared |
| **F5** Admin redirect, dead links | Medium | Not started | **FIXED_AND_TESTED** | `/dashboard` routes by DB role; every sidebar link resolves (build route table). The placeholder **Stats page now shows live counts** (accounts by role, suspended, jobs by status including "live", applications by status, last 30 days), with an error state. | Typecheck plus build; admin guard tests | Visual check |
| **A1** Application eligibility | High | Not started | **FIXED_AND_TESTED** | Expired, closed, deleted, draft, external-apply and suspended-company jobs were already refused at submit, re-checked in the transaction. **Added:** completed-profile rule enforced by the API (`lib/candidate-profile-completeness.ts`, shared with the apply page), checked after the job and duplicate checks. | A1 tests (incomplete → 400 with missing fields; gone job and duplicate take precedence); existing P1 #11/#12 tests | — |
| **A2** Nightly expiry | High | Not started | **FIXED_AND_TESTED** (code) / **BLOCKED_EXTERNAL** (schedule) | `vercel.json` cron (02:00 UTC) → `GET /api/job-offers/expire`, authorized by `Bearer $CRON_SECRET` (constant-time; disabled → 503 if unset). Idempotent conditional UPDATE; caches expired immediately; failures logged at error level. Manual admin POST kept. | 3 tests (auth, idempotency, only published+expired closed, cache expiry) | Set `CRON_SECRET` in Vercel and observe one run |
| **A6** Company profile saving | High | Not started | **FIXED_AND_TESTED** | Root cause: `upsertCompanyProfile` wrote `field \|\| null` for every field. Now only sent fields are written (`null` clears); public company and job caches expire at once; **slug changes keep old links**: new `company_slug_redirects` table, 308 from the page and API, and old slugs cannot be claimed by others. Admin slug edits are recorded too. | 6 tests (partial save, cache `{expire:0}`, create requires name+slug, redirect + no theft + move back, 404 unknown) | Apply the migration |
| **A7** Status rules, history, notifications | Medium | Not started | **FIXED_AND_TESTED** | `lib/application-status.ts` workflow (Rejected→Hired forbidden), enforced with **optimistic concurrency** (conditional update; a concurrent change → 409). `application_status_history` rows; in-app `notifications` (new application → company; status change → candidate); analytics cache invalidated on change; `/api/notifications` (GET, PATCH; user-scoped); bell in the dashboard header; the recruiter modal offers only allowed statuses; server errors shown as a toast. | 6 A7 route tests, 2 unit tests, journey test. **Negative control:** allowing Rejected→Hired fails the test | Concurrency conflict tested only through the code path (no real Postgres race test). Email notifications await F2 |
| **Q2** End-to-end test | High | Not started | **PARTIALLY_FIXED** | `tests/integration/journey-candidate-apply.test.ts`: register → onboarding → AND-filtered search → apply → duplicate 409 → company notified, lists and processes → candidate sees status and notification, no notes. Real route handlers. | Passes (1/1) | Runs against the in-memory DB with a DB-derived session (the real Auth.js login is covered separately). A browser E2E (Playwright) against Postgres is not set up |

### Search & content (days 6–8)

| ID | Prio | PDF | Current | Evidence / changes | Verification | Remaining |
|---|---|---|---|---|---|---|
| **P1** Filters AND, debounce, URL | High | Not started | **FIXED_AND_TESTED** | Already done: AND between filter groups (`lib/job-offers-utils.ts`), visitor activity filter, AbortController, URL state; filters apply on an explicit Apply / Enter (no per-keystroke requests, so no debounce needed). **Added:** removing a filter chip now updates the shareable URL. | Journey test ('Alpha' + Tunis → 1 job; + Sousse → 0); `job-offers.routes.test.ts` | — |
| **P2** Homepage search wiring | High | Not started | **VERIFIED_FIXED** | `cx-hero-search.tsx` pushes `/jobs?location=&activityType=&language=`, read by `JobsPageClient`; tiles link to `/jobs?location=Remote`, `/jobs`, `/companies`. | Static review | Browser click-through (Q4) |
| **P3** Fake content | High | Not started | **FIXED_AND_TESTED** | Removed invented About stats ("10k+ placements", "98% success rate"); the "50+ employees" default; the non-functional "Follow Company" and heart buttons; dead About CTAs (now links) and the `#` Instagram link; 18 unused components (incl. `admin-banner`, `featured-job-banner`, landing hero/categories/benefits/recruiter-cta). The homepage carousel uses real companies. | Build plus typecheck; dead-module scan | — |
| **P4** Legal pages, dead links | High | In progress | **VERIFIED_FIXED** | `/terms` and `/privacy` exist; no `/salaries` or settings links remain; every internal link target resolves (route table). | Static link scan | Legal text needs legal review (no compliance claim is made) |
| **P5** Hide expired/deleted jobs | Medium | Not started | **FIXED_AND_TESTED** | One rule, `publicJobWhere()`, used everywhere (lists, pages, company pages, sitemap, apply). **Root cause of "not straight away":** invalidation used `revalidateTag(tag, "max")`, which serves stale once; now `{ expire: 0 }`. The public job page is public-only; the client hides Apply when a cached page passes its expiry; DB errors are no longer turned into cacheable 404s. | Cache-profile assertions; suspension test suite; F-04 tests | CDN behaviour on Vercel not observed |
| **P6** not-found / error / loading | Medium | Not started | **FIXED_AND_TESTED** | `app/not-found.tsx`, `error.tsx` and `global-error.tsx` existed. Added branded, accessible loading states (public, dashboard) and a "view it from your account" hint on job 404s for signed-in users. | Live `next start`: 404 page served for an unknown job | — |

### Polish (days 9–10)

| ID | Prio | PDF | Current | Evidence / changes | Verification | Remaining |
|---|---|---|---|---|---|---|
| **U1** Brand tokens, contrast | Medium | Not started | **PARTIALLY_FIXED** | Tailwind tokens `brand-*` added (documented ratios). Every white-on-green button (1.8–2.8:1) moved to `brand-green-strong` (5.3:1); green text on light backgrounds → 5.3:1; failing grays → 6.5:1 or 4.76:1. | Ratios computed (WCAG formula) | Hundreds of remaining hard-coded hex classes not migrated to tokens; a full automated contrast audit in a browser has not been run |
| **U2** aria-labels, real checkboxes | Medium | Not started | **PARTIALLY_FIXED** | Labels added: job filters (search, activity, language, chip removals), job-row icon actions (with the job title), apply cover letter, notification bell, status select; results count announced (`aria-live`). The fake checkbox component was unused and deleted (filters are native `<select>`s). | Typecheck, lint | Screen-reader and keyboard pass in a browser |
| **U3** JobPosting, sitemap, robots, OG | High | Not started | **FIXED_AND_TESTED** | JSON-LD only on public job pages (no invented salary or country; escaped against `</script>`); `sitemap.xml` (public jobs and active companies only, request-time, cached); `robots.txt` (private areas disallowed); default OG image; per-page OG and canonical; "JobHub" titles fixed. | Unit tests; **live**: robots 200, OG image 200 PNG | Google Rich Results Test (needs a public URL). `APP_URL` must be set at build time (robots and sitemap URLs) |
| **A10** Cache public pages | Medium | Not started | **FIXED_AND_TESTED** | Root cause: `app/(public)/layout.tsx` called `auth()`. Now the session is read on the client; job page public-only, with `/jobs/[slug]/preview` (dynamic, noindex) for owners, admins and applicants; company page ISR. | **Build output:** `/jobs` ○ 5m, `/companies` ○ 10m, `/jobs/[slug]` ●, `/companies/[slug]` ●, about/privacy/terms ○ (all were ƒ). **Live:** `x-nextjs-cache: HIT`, `s-maxage=300` | Home `/` stays dynamic by design (no DB access at build) |
| **A12** AI timeouts + format | Low | Not started | **PARTIALLY_FIXED** | Timeouts and 1 retry existed. **Added:** every AI route is bounded by `AI_ROUTE_DEADLINE_MS` = 28 s (was 45 s; CV parsing gives the AI step only what the PDF step left); `maxDuration = 60` declared. | AI timeout tests pass | AI JSON output is still mapped defensively rather than schema-validated (F-26); writes are re-validated server-side anyway |
| **Q3** ESLint 0 errors, dead code | Medium | Not started | **FIXED_AND_TESTED** | 0 errors (warnings 34 ≤ ratchet 35). Deleted: `tmp-dbcheck.ts`, `verify_seed.ts` (contained the shared password), `inspect_trgm.js`, `tmp-verify/`, `summary.json`, 18 unused components, 2 unused validation modules, `CheckboxRow`. The `false))` artifact was already deleted. | `npm run lint:ci` | Ignored local files (`tmp-idor-*`, `.k6-*-cookies.txt`, `results.json`) are left for the owner to delete. `ai-autofill-modal.tsx` and `components/landing/index.ts` had uncommitted edits from an earlier session; they were dead and are deleted |
| **Q4** Manual QA mobile + desktop | High | Not started | **BLOCKED_EXTERNAL** | No browser tooling is available in this environment; only HTTP checks of the built server were possible. | — | Run the plan in `PRODUCTION-READINESS-AUDIT.md` §6 on staging |

### Additional findings fixed in this pass (not separate PDF items)

- **N1 (P0 if present): shared seed password.** It was removed from `prisma/seed.ts`, `seed-k6.ts` and the k6 generators. It now comes from env (≥12 characters). `prisma/seed-guard.ts` refuses the production DB outright and requires confirmation for any remote one. Seeded addresses moved from real `@gmail.com` addresses to the reserved `@cxjobs.test` domain. Tests included. **Accounts already seeded anywhere with the old password must be deactivated or have their passwords rotated.**
- **F-19:** unused `PUT /api/dashboard/company` removed.
- **F-31:** company email check is case-insensitive.
- **F-21:** Node pinned.
- **F-28:** health check labels the OpenAI status honestly.
- **Bug:** the job page's "already applied" check used an absolute `NEXT_PUBLIC_APP_URL`, so cookies were lost on an origin mismatch. It now uses a relative URL.

---

## B. Release blockers (must clear before production)

| # | Blocker | Evidence that clears it |
|---|---|---|
| B1 | All fixes are **uncommitted**; HEAD `6e77684` contains the vulnerable code | Commit, open a PR, `ci.yml` green **including the new `migrations` job** |
| B2 | 3 migrations not applied (`sessionVersion`, trigram indexes, A6/A7 tables). The code needs them **before** deploy | `prisma migrate status` clean on staging, then on production; app smoke test |
| B3 | `cv` bucket privacy unverified (S6) | Read-only SQL shows `public=false` and no anon/authenticated policies; a public-URL probe returns 400/404 |
| B4 | Possible legacy case-variant duplicate emails (A5) | Read-only duplicate count = 0, or manual resolution |
| B5 | N1: seeded accounts with the shared password may exist in production | Read-only count of `@gmail.com`/`@cxjobs.test` seed accounts; deactivate or rotate |
| B6 | No email delivery (F2/A8 recovery unusable) | A reset email arrives on staging and its link works |
| B7 | No backups, restore test or alerting (A9) | One off-site backup, one successful `restore-test.sh`, uptime monitor and alert fired once |
| B8 | `CRON_SECRET` unset → no nightly expiry (A2) | Vercel shows a successful cron run |
| B9 | Manual QA not done (Q4) | Candidate and company journeys pass on phone and laptop on staging |

---

## C. Commands run (11 Nov) and results

All with placeholder env (`DATABASE_URL=postgresql://…@127.0.0.1:9/…` and every other `.env` key overridden).

| Command | Baseline (start of pass) | Final |
|---|---|---|
| `npx tsc --noEmit --incremental false` | 0 errors | 0 errors |
| `npm run lint:ci` | 0 errors, 34 warnings | 0 errors, 34 warnings |
| `NODE_ENV=test npm run test:security` | 189/189 | **201/202** (F-33 timing flake; 9/9 ×3 in isolation) |
| `NODE_ENV=test npm run test:integration` | 246/246 | **270/270** |
| `npm run build` | pass (all public pages ƒ) | pass (public pages ○/● ISR) |
| `npm audit --omit=dev` | 0 crit / 0 high / 2 moderate | unchanged (exit 1 due to the moderates; CI gate is `--audit-level=critical`) |
| `npx prisma validate` | valid | valid |
| `npx prisma migrate diff --from-schema <before> --to-schema prisma/schema.prisma --script` | — | additive SQL only (used for the new migration) |
| `next start` on 127.0.0.1 + `curl` | — | headers, cache HIT, robots, OG, 404, 401, 503 health (no DB) as expected |

**Not run, with reasons:**
- `prisma migrate status` / `deploy` against any database: no local Postgres. The sandbox refused running the bundled PGlite server. The production DB is off-limits.
- Browser tests: no browser tooling.
- External services: no credentials, by design.

**Negative controls:** allowing Rejected→Hired and disabling the AI quota made exactly the 4 matching tests fail; both files were restored byte-for-byte.

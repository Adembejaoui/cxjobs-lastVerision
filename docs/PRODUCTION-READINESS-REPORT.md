# CXJobs: production readiness report (launch plan remediation)

- **Date:** 11 Nov 2026.
- **Scope:** all 44 items of *CXJobs Launch Action Plan (updated 8 Nov)*.
- **ID-by-ID evidence:** `docs/PRODUCTION-READINESS-REMEDIATION.md`.
- **Operations:** `docs/OPERATIONS.md`.

## 1. Verdict: **NO-GO today → CONDITIONAL GO once blockers B1–B9 are cleared**

**Code**
- Every security item in the plan is fixed and covered by passing regression tests.
- The core flows the plan asked for are implemented and tested: eligibility, status workflow, notifications, partial profile saves, slug redirects, scheduled expiry, real admin stats and the apply-page states.

**Production is not ready, for reasons the code cannot settle**
- The fixes are uncommitted.
- Three required migrations are not applied anywhere.
- CV bucket privacy and legacy data (duplicate emails, seeded test accounts) are unverified.
- Email is not delivered.
- There are no backups, alerts or manual QA yet.

None of these can be closed from the repository, and claiming otherwise would be false.

## 2. Starting point

- **Branch:** `hardening/production-readiness`, HEAD `6e77684` (same as `origin`).
- **Working tree:** large and uncommitted from earlier hardening phases (≈89 tracked files modified or deleted, plus ≈40 untracked paths: `lib/security/`, `tests/`, `docs/`, migrations, `ci.yml` …). It was preserved; nothing was reset, stashed, committed or pushed.
- **Baseline checks:** tsc 0; lint 0 errors / 34 warnings; security 189/189; integration 246/246; build OK, but every public page was dynamic.
- **Safety:** the developer `.env` points at the **production** Supabase database. Every check ran with all variables overridden by unroutable placeholders. No database, storage, Redis, email, OAuth or AI service was contacted.
- **PDF discrepancy:** the PDF cites PRs #2/#5/#9 and a VPS migration. None of these exist in this repository. The code is Vercel + Supabase + Upstash.

## 3. What changed in this pass

| Area | Change |
|---|---|
| S7 | Daily per-user AI quota across the 3 AI routes: atomic, fail-closed, refunded on failure; CV parsing degrades to non-AI |
| S5 | Image URLs limited to this app's public storage buckets; company social links validated |
| A3 | Full page CSP shipped as Report-Only, for staged enforcement |
| A4 | `/api/health` rate-limited (fail-open) |
| A1 | Completed-profile rule enforced by the API (shared with the UI); duplicate application → 409 |
| F4 | Apply page: waits for the session, shows "already applied" on load, inline per-error messages; a failed submit no longer shows "Job Not Found" |
| A6/F3 | Company save writes only the fields sent; old slugs redirect (new table); unused PUT that wiped benefits removed |
| P5 | Cache invalidation is now immediate (`{expire:0}`; it was stale-while-revalidate); DB errors no longer become cached 404s |
| A7 | Status workflow (no Rejected→Hired), optimistic concurrency, history table, in-app notifications with API and bell, analytics refresh |
| A2 | Vercel Cron + `CRON_SECRET`-authenticated, idempotent expiry |
| F5 | Admin stats page with live counts |
| A10 | Public layout no longer reads cookies; public job page public-only plus a session-aware `/preview`; company page ISR |
| U3 | JobPosting JSON-LD, sitemap, robots, OG image and metadata; "JobHub" titles fixed |
| U1/U2 | AA-passing brand tokens and contrast fixes; accessible names on filters and icon actions |
| P3/Q3 | Invented stats and fake buttons removed; 18 dead components and stale scripts deleted |
| P6 | Branded loading states; job 404 hint for owners and applicants |
| A12 | All AI requests bounded to 28 s; `maxDuration` declared |
| A9 | Error hook (`onRequestError`), backup/restore scripts with guards, operations runbook |
| N1 | Shared seed password removed; seed guard refuses production; reserved `.test` addresses |
| F6/Q1 | README, CLAUDE.md, env docs, Node pin; CI migration-replay job on a throwaway Postgres |

**One migration added:** `20261111090000_slug_redirects_status_history_notifications`.
- Purely additive: 1 enum and 3 tables.
- Generated offline with `prisma migrate diff`.
- Statically tested to contain no DROP, no alteration of existing columns and no data rewrite.
- **Not applied to any database.**

## 4. Verification evidence

| Check | Result |
|---|---|
| TypeScript | 0 errors |
| ESLint (`lint:ci`) | 0 errors, 34 warnings (ratchet ≤ 35) |
| Security/unit tests | 202 tests: 201 passed, 1 failed in the full run. The failure is the documented load-sensitive PDF timing test (F-33), which passed 9/9 in three isolated re-runs. New: 13 |
| Integration tests (real route handlers, in-memory DB) | 270/270 passed, 0 skipped (new: 22 including the E2E journey) |
| Negative controls | Breaking the A7 and S7 fixes fails exactly the 4 matching tests |
| Production build | Pass. `/jobs`, `/companies`, `/about`, `/privacy`, `/terms` static/ISR; `/jobs/[slug]` and `/companies/[slug]` ISR (all were dynamic) |
| Built server (`next start`, placeholder env) | Security headers on all pages, `x-nextjs-cache: HIT` on `/jobs`, robots and OG image served, 404/401/503 as designed, no internals in error pages |
| `npm audit --omit=dev` | 0 critical, 0 high, 2 moderate (unreachable `uuid` path in `exceljs`) |
| `prisma validate` | valid |
| Migration replay on real Postgres | **Not run.** No local Postgres; the CI job was added but has not yet run |

Exact commands are in the ledger, §C.

## 5. Security findings: status

- **Closed in code, tested:** S1, S2, S3, S4, S5, S7, S8, S9, S10, A4, A8, A11 (production tree), N1 (code).
- **Partially closed:**
  - A3: enforce the full CSP after a staging run.
  - A5: legacy duplicate data, and a `lower(email)` index after the check.
  - S6: bucket privacy unverified.
- **Open risks:**
  - The `cv` bucket may be public (B3).
  - Seeded accounts with a shared password may exist in production (B5).
  - Production credentials sit in the developer `.env` (operator-error risk).
  - Dev-tool advisories (`@lhci/cli`).
  - `next-auth` is a beta release.
  - CSP has no enforced `script-src`.

## 6. Still required: infrastructure, credentials, decisions and manual checks

1. **Commit** the work and open a PR. CI must pass, including the `migrations` job (B1).
2. **Read-only production checks:** `prisma migrate status`; duplicate emails; seed accounts; `cv` bucket policies (B2–B5).
3. **Staging environment:** apply the 3 migrations; test Upstash Lua, the Resend domain and Google OAuth; run the manual QA plan on phone and laptop (B6, B9).
4. **Vercel settings:** `CRON_SECRET`, `APP_URL` / `NEXT_PUBLIC_APP_URL` at build, optionally `AI_DAILY_QUOTA` and `ERROR_ALERT_WEBHOOK_URL`; confirm the cron runs (B8).
5. **A9:** off-site DB and storage backups, one restore test, uptime monitor, log drain and alerts (B7).
6. **Decision F1:** keep invite-only company sign-up, or open it.
7. **Post-launch:**
   - enforce the CSP;
   - add the `lower(email)` unique index;
   - schema-validate AI output (F-26);
   - migrate the remaining hard-coded colors to tokens;
   - Google Rich Results check;
   - Playwright E2E against Postgres in CI.

## 7. What would clear each blocker

| Blocker | Evidence |
|---|---|
| B1 uncommitted | Merged PR with green CI |
| B2 migrations | `migrate status` "up to date" on staging and production; smoke test passes |
| B3 CV bucket | SQL shows `public=false`; a public-URL probe returns 400/404 |
| B4 duplicates | Count = 0 |
| B5 seed accounts | Count = 0, or accounts deactivated |
| B6 email | Reset mail received and the link works on staging |
| B7 operations | Backup file off-site; restore-test output recorded; an alert received |
| B8 cron | Successful run listed in Vercel |
| B9 QA | Signed-off checklist (both roles, both form factors) |

## 8. Post-deploy smoke test

1. `GET /api/health` returns 200.
2. `/jobs` and a job page load; the response headers show the CSP and `X-Frame-Options`.
3. As a test candidate: apply, then try again and see "already applied".
4. As a test company: move the application to Interview; the candidate sees the notification.
5. As admin: the Stats page loads.
6. `/robots.txt` and `/sitemap.xml` use the production domain.
7. Watch the logs for 30 minutes: `"Unhandled server error"`, `"Rate limiter backend error"`, Prisma errors.

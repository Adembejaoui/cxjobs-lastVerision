# Phase 2: Remediation changes

Companion to `docs/RE-AUDIT.md`. Everything here is **uncommitted** working-tree change; nothing was committed or pushed.

## Verification

All results below are local, with unroutable placeholder env vars.

| Check | Before (Phase 1) | After |
|---|---|---|
| `tsc --noEmit` | 0 errors | 0 errors |
| ESLint | 31 errors / 28 warnings | 0 errors / 35 warnings (`npm run lint:ci` ratchet passes) |
| Security tests | 142/142 | **154/154** |
| Integration tests | 102/102 | **121/121** |
| `next build` (isolated) | Pass, but queried the DB during prerender | Pass, with **no DB access** |
| `npm audit --omit=dev` | 18 (13 high) | **2 moderate** (exceljs/uuid, no viable fix) |
| `npm audit` (all) | 41 (29 high) | 25 (rest is dev tooling, mostly `@lhci/cli`, which needs a major bump) |

## Fixes by audit ID

| ID | Change | Files |
|---|---|---|
| F6 | Prisma config reads `DIRECT_DATABASE_URL` (falling back to `DIRECT_URL`) and no longer throws, so `npm ci` / `prisma generate` work on a fresh checkout. `dotenv` is declared. The `.env.example` template is no longer gitignored. Stale `package.json` `prisma.seed` removed. Invitation-key placeholder now has a valid format. | `prisma.config.ts`, `package.json`, `.gitignore`, `.env.example` |
| NF-05 | Builds need no database: job pages are ISR on demand (`generateStaticParams` returns `[]`), and the homepage is request-time via `connection()`. | `app/(public)/jobs/[slug]/page.tsx`, `app/(public)/page.tsx` |
| NF-01 | The update schema no longer defaults `applicationType`. Cross-field rules (EXTERNAL needs a URL, OTHER needs `activityCustom`, `salaryMin <= salaryMax`) are checked on the **merged** final state. | `lib/validations/job.ts`, `app/api/job-offers/[jobId]/route.ts` |
| P1 #12, #11 | Application POST refuses EXTERNAL, expired, unpublished and deleted jobs, both before and inside the transaction. | `app/api/application/route.ts` |
| P1 #17 | `salaryMin <= salaryMax` is enforced on create and update. | `lib/validations/job.ts` |
| NF-02 | The public listing forwards `activityType`. | `app/api/job-offers/route.ts` |
| P1 #1 | Filter groups are combined with AND; values within one group use OR (`in`). | `lib/job-offers-utils.ts` |
| NF-03 | A COMPANY user gets its private list only when it asks for its own `companyId`; `/jobs` shows the public catalogue. | `lib/security/job-offer-scope.ts` |
| P1 #16 | Invalid `status`/`jobId`/`companyId`/salary query params return 400 (or are ignored) instead of a 500. | `app/api/application/route.ts`, `app/api/admin/job-offers/route.ts`, `app/api/job-offers/route.ts` |
| NF-06 | Emails are normalized (trim + lowercase) in every auth schema. Lookups are exact-then-case-insensitive, with a strict JS re-check (ILIKE-wildcard safe; ambiguous legacy duplicates resolve to null). Registration blocks case-variant duplicates. | `lib/server/user-email.ts` (new), `lib/validations/auth.ts`, `lib/auth.ts`, `lib/server/account-emails.ts`, `app/api/auth/register/route.ts`, `app/api/auth/verify-email/route.ts` |
| NF-15 | An admin address change clears `emailVerified` and deletes outstanding reset and verification tokens. A case-only normalization is not treated as an identity change. | `app/api/admin/users/[id]/route.ts` |
| NF-08 | Pages get `X-Frame-Options: DENY`, `nosniff`, and CSP `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`. The page CSP deliberately omits `form-action`, which would break the Google OAuth redirect. `Referrer-Policy` is fixed. `/api/*` keeps its stricter CSP. | `next.config.ts` |
| NF-07 | View counter: PUBLISHED, non-deleted, unexpired jobs only; one counted view per hashed IP per job per hour; per-IP cap. Both limits fail open. | `app/api/job-offers/[jobId]/views/route.ts` |
| P1 #10 | Company page and companies API list and count only live jobs. The `_count` no longer reveals drafts or deleted jobs. | `app/(public)/companies/[slug]/page.tsx`, `app/api/companies/[slug]/route.ts` |
| P1 #15 | Job mutations also revalidate `/companies` and `/companies/[slug]`. | `lib/cache.ts` |
| F4 | `callbackUrl` is honoured through a same-origin, path-only validator (`safeCallbackPath`, unit-tested against open-redirect payloads). | `lib/security/safe-redirect.ts` (new), `components/auth/login-form.tsx`, `app/login/page.tsx`, apply page |
| NF-13 | The application POST response no longer exposes the company owner's `userId`. | `app/api/application/route.ts` |
| NF-12 | An omitted `benefits` field means "unchanged"; only an explicit `[]`/`null` clears. | `app/api/profile/route.ts` |
| NF-10 | Public catalogue reads fail open on a limiter outage; auth, AI and writes stay fail-closed. | job-offers list, single and by-slug routes |
| NF-18 | Health deep checks are shared for 15 s per instance (bounded backend load); response format unchanged. | `app/api/health/route.ts` |
| P1 #4, #6, #8 | Salary display uses the min/max range. A "Hybrid" work-mode option is added. Work-mode flags survive reload. Stale requests are aborted. List keys use the unique slug. | `app/(public)/jobs/JobsPageClient.tsx` |
| P1 #23, #24 | `app/not-found.tsx`, `app/error.tsx` (shows only the digest, never the message), `app/global-error.tsx`. | new files |
| F5, #20, #22 | Dead code deleted: `components/ui/sidebar.tsx` (dead links), `components/landing/{trusted-strip,featured-section,header}.tsx` (third-party brand names, `/salaries` link). | deleted |
| #27 | New `ci.yml` quality gate: typecheck, lint ratchet, both test suites, build and critical audit, with **no secrets**. k6 workflow fixed (valid YAML), made manual-only, and given a guard that refuses non-staging targets. ESLint ignores generated, k6 and scratch files. | `.github/workflows/*`, `eslint.config.mjs`, `package.json` scripts |
| NF-09 | `prisma`, `@prisma/client`, `@prisma/adapter-pg` → 7.10.1 (kept in lockstep; client regenerated). `@vercel/functions` → 3.11.1. `npm audit fix` (semver-compatible only). | `package.json`, `package-lock.json` |

## New tests

- `tests/security/user-email.test.ts`
- `tests/security/safe-redirect.test.ts`
- Header tests in `next-config.test.ts`
- Scope tests in `authorization.test.ts`
- Integration regressions in `job-offers`, `applications-cv-upload`, `auth-flows` and `admin-ai-scrape-cv`

The test fake now honours `mode: "insensitive"` for `equals`, as Postgres does.

## Deliberately not done (needs a decision or infrastructure)

- **S6b**: verify the `cv` bucket is private (read-only SQL in `docs/security/PRODUCTION_READINESS.md` §2).
- **A1**: enabling `REQUIRE_EMAIL_VERIFICATION` requires `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` and `APP_URL` first, plus a plan for existing unverified users. Otherwise they are locked out.
- **NF-14**: the application CV falls back to the current resume. This is a product decision, because removing the fallback hides the CV when an old file was replaced.
- **NF-11**: the per-account login lockout should count failures only. That needs a non-incrementing "peek" in the rate-limit store.
- **NF-16**: run `git rm --cached` on tracked scratch files (index change left to you), and delete the local `.k6-*-cookies.txt` files.
- **NF-17**: explicit trusted-proxy configuration, needed only for non-Vercel hosting.
- **P1 #5**: an experience filter needs a schema field (no column exists).
- **P1 #25**: more `loading.tsx` files.
- **ESLint debt**: 19 `set-state-in-effect`/`refs` sites, now warnings capped by the ratchet.
- **`perf-ci.yml`**: still injects production secrets into the build, and its `start` step has no env, so it can't boot. Decide on a staging DB, or move it to a preview deployment.
- **`exceljs`** moderate advisory: npm's only "fix" is a downgrade.
- **`@lhci/cli`**: major bump; dev-only.
- **Before deploying**: commit, then apply migration `20261109120000_add_user_session_version` to the target DB **before** the code. Builds now need no DB, but the runtime does.

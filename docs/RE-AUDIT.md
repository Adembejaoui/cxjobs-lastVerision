# CXJobs — Phase 1 Security & Codebase Re-Audit (read-only)

- **Audit date:** 2026-11-09
- **Scope:** Current working tree of `C:\Users\tun\Desktop\cxjobs`, which includes a large **uncommitted** diff on top of `HEAD`.
- **Method:** Direct source inspection with file:line evidence. Local-only quality checks, with every external service replaced by an unroutable placeholder.
- **No production database, storage, Redis, email, or OAuth service was contacted.**

> **Read this first.** Almost every fix below exists **only in the uncommitted working tree**: 44 modified tracked files (2,130+ / 5,280−) and 21 untracked paths, including `lib/auth-callbacks.ts`, `lib/security/`, `lib/email/`, `lib/server/session-revocation.ts`, the CV routes, the token-flow pages and the `sessionVersion` migration.
>
> `HEAD` (`6e77684`) still contains the pre-fix code. Examples:
> - `HEAD:lib/auth.ts:115-117` copies client-supplied `session.user.isOnboarded` into the JWT.
> - `HEAD:app/api/upload/route.ts:322` issues a public URL for every bucket, including CVs.
>
> A deployment built from Git (e.g. Vercel) would ship the vulnerable version. "Fixed" in this report means **fixed in the working tree, not committed**.

---

## A. Executive summary

| Item | Value |
|---|---|
| Current branch | `hardening/production-readiness` |
| Current HEAD | `6e776843c56e3b26bf2dbff5ae2e9fb2da4a25b9` (`6e77684 v0`) |
| Comparison commit | `9cf094e` (exists locally) |
| Commits since comparison | **22** (`git log --oneline 9cf094e..HEAD`). Committed diff: 245 files, +32,048 / −7,077 |
| Uncommitted changes | **Yes**: 44 modified/deleted tracked files plus 21 untracked paths (see `git status`) |
| Test runner | Yes. `node:test` via `tsx` (`package.json:10-11`). 12 security + 9 integration test files. |
| CI | Yes, but not a quality gate. `perf-ci.yml` (build + Lighthouse) and `k6-load-test.yml`, which does not parse as YAML. No lint, type-check or test job. |

**Overall security assessment.**

- **Fixed in the working tree:** all ten original P0 security issues (S1–S10), plus upload content validation.
- **Strong points:**
  - JWT claims are always re-derived from the database, and sessions can be revoked.
  - Job-offer list scope is derived only from the server-side identity.
  - Candidate responses use an explicit allow-list (recruiter `notes` excluded).
  - SSRF defence is connect-time and DNS-rebinding-safe, with per-hop redirect checks, a port lock, a timeout and a byte cap.
  - One-time tokens are hashed, single-use and expiring.
  - Rate limiting is atomic in Redis and fails closed.
  - CVs are served only through authorized, 60-second signed URLs.
- **No Critical or High security vulnerability was confirmed in the working tree.**
- **Remaining risks are operational and functional:**
  - A fresh install fails (F6).
  - A normal `next build` reads the production DB through `.env` (NF-05).
  - The CV bucket's privacy can't be verified from code (S6b).
  - Two High-impact functional bugs: EXTERNAL jobs silently become INTERNAL (NF-01), and the public activity filter is ignored (NF-02).
  - Several Medium hardening gaps (NF-03 … NF-09).

**Safe to proceed to staging?** **Conditionally yes**, for an *isolated* staging environment (its own DB, Redis, Supabase project and email sandbox), and only after:

1. The working-tree changes are committed to the branch that staging builds from.
2. `DIRECT_URL` is provided, or F6 is fixed (otherwise `npm ci` / `prisma generate` fail).
3. Migration `20261109120000_add_user_session_version` is applied to the staging DB **before** the code is deployed.
4. The staging `cv` bucket is confirmed private.

**Not ready for production** until NF-01, NF-02, F6 and S6b are resolved.

---

## B. Quality checks

| Check | Result | Errors | Warnings | Notes |
|---|---|---:|---:|---|
| TypeScript (`npx tsc --noEmit`) | ✅ Pass (exit 0) | 0 | 0 | Reliable. Purely local. |
| ESLint (`npx eslint .`) | ❌ Fail (exit 1) | 31 | 28 | 319 files linted. **20 errors in app code**: `react-hooks/set-state-in-effect` ×18 and `react-hooks/refs` ×2 (`job-applications-client.tsx:176`, `company-jobs-client.tsx:157`). **11 errors in scratch/tooling files** (`tests/k6/*.js` ×8, `inspect_trgm.js` ×2, `tmp-idor-test.ts` ×1), mostly `no-require-imports`. Warnings: 21 `no-unused-vars`, 3 anonymous default exports, 2 `<img>`, 2 unused disable directives. Reliable. |
| Next.js build (`next build`, isolated) | ✅ Pass (exit 0) | 0 | 0 (app) | Compiled in 7.6 s. The build's TypeScript pass succeeded and 62/62 static pages were generated. See the paragraphs below the table. |
| Security tests (`npm run test:security`) | ✅ Pass | 0 | — | 142/142. Run with placeholder env. No network (DNS test seams are injected). |
| Integration tests (`npm run test:integration`) | ✅ Pass | 0 | — | 102/102. Prisma, Supabase and AI are mocked; Upstash runs against a local fake REST server. |

**How the build was isolated.** `@next/env` only applies a `.env` value to keys that are `undefined` in `process.env` (verified in `node_modules/@next/env/dist/index.js`). The build therefore ran with **every key defined in `.env`** (16 keys, names only) pre-set to placeholders:

- DB → `127.0.0.1:9`
- Redis/Supabase → `http://127.0.0.1:9`
- Invitation key → a format-valid all-zero key
- `NEXT_TELEMETRY_DISABLED=1`

**Build result details.** The only service errors were Prisma `Can't reach database server at 127.0.0.1:9`, from `generateStaticParams` (jobs) and a `companies.findMany` during prerender. Both are caught and logged, and the build still succeeds. These are expected service-unavailable errors, not application errors.

A first isolated attempt failed at "collect page data" because `INVITATION_TOKEN_ENCRYPTION_KEY` must be valid base64 of 32 bytes. That key is validated at module load (`lib/server/invitation-token-crypto.ts`), so builds need it set.

> ⚠ A plain `npm run build` on this machine would load the production `.env` and run those prerender queries against the production database (NF-05).

---

## C. P0 Security findings

| ID | Status | Evidence (file:line) | Notes |
|---|---|---|---|
| S1 — JWT session update | **Fixed** | `lib/auth.ts:136-155`: `jwt()` never passes `session` to `jwtCallback`. `lib/auth-callbacks.ts:116-130`: `trigger==="update"` only forces `needsRefresh`; claims come from `deps.loadUser` (DB) via `applyRecord` (`:80-90`), which overwrites `id/role/isOnboarded/emailVerified/sv` from the DB row. `:121`: missing/inactive user → `null`. `:123`: `sessionVersion` mismatch → `null`. | A POST of `{"id":"other","role":"ADMIN"}` to the session-update endpoint is ignored, and the DB row is the source of truth. `lib/auth-user-record.ts:18-33` reads by `token.id`, which was minted server-side. **HEAD still has the older callback** (`HEAD:lib/auth.ts:115-117` trusts client `isOnboarded`). |
| S2 — Job offer ownership bypass | **Fixed** | `app/api/job-offers/route.ts:188-198` → `lib/security/job-offer-scope.ts:26-45`. COMPANY gets owner scope only when `requestedCompanyId` is absent or equals the DB-resolved own id (`:38-39`). Otherwise, and for a profile-less COMPANY, the public PUBLISHED-only scope applies (`:41`). `privateScopeBaseWhere` (`:48-53`) always sets `deletedAt:null` and `companyId`. | Another company's drafts can't be listed. `status` is validated (`route.ts:145-151`). The response has `Cache-Control: private, no-store` for sessions (`:233`, `:280`). Functional side effect: see NF-03. |
| S3 — Recruiter notes disclosure | **Fixed** | `app/api/application/[id]/route.ts:41-71`: candidate branch uses `select: {...CANDIDATE_APPLICATION_SCALARS}` (`lib/security/application-fields.ts:9-19`, no `notes`), plus `stripRecruiterOnlyFields` (`:82`). `app/api/application/route.ts:65-90`: candidate list selects only `id/status/createdAt/jobOffer`. `app/api/dashboard/candidate/route.ts:73-91` uses the allow-list. Candidate pages: `dashboard/candidate/page.tsx:180-195` and `candidate/applications/page.tsx:24-40` use explicit `select`. | Nested relations (`jobOffer`, `company`) have no notes field. COMPANY/ADMIN still receive notes, as intended (`[id]/route.ts:96-156`, ownership checked `:139-151`). Minor: POST response leaks `company.userId` (NF-13). |
| S4 — SSRF | **Fixed** | `lib/job-scraper.ts`: blocklists `:33-66` (0/8, 10/8, 100.64/10, 127/8, 169.254/16 incl. metadata, 172.16/12, 192.168/16, multicast/reserved; `::1`, `::/96`, `::ffff:0:0/96`, NAT64, 6to4, Teredo, `fc00::/7`, `fe80::/10`). IPv4-mapped forms are caught (`:83`). Pre-check `isSafeUrl` `:93-112`: https only, port 443 only, no credentials, no single-label or `.local/.internal/...` hosts, IP literals checked. `createGuardedLookup` `:134-150` rejects if **any** resolved address is blocked, and the socket connects to the validated address (rebinding-safe). Redirects: manual, `isSafeUrl` re-run per hop `:226-253`, max 3 (`:10`). Timeout covers the whole fetch, including redirects (`:220`, default 10 s, plus route deadline 22 s in `scrape-from-url/route.ts:15,96`). 100 KB cap `:9,262-274`. HTML-only content types `:201,255-260`. `agent:false` `:175`. | Schema also enforces https (`lib/validations/job.ts:178-181`). The route is COMPANY-only and rate-limited (`scrape-from-url/route.ts:45-66`). Covered by `tests/security/ssrf.test.ts`. |
| S5 — Dangerous URLs / navigation | **Fixed** | `lib/security/safe-url.ts:26-49`: WHATWG parse, http/https only, rejects control characters, whitespace and `\`, rejects credentials. Used by `externalApplyUrl` (`lib/validations/job.ts:58,117`), company `logoUrl/coverImageUrl/website` (`lib/validations/profile.ts:416-418`), `avatarUrl` (`:114`), candidate LinkedIn host-pinned (`lib/validations/linkedin.ts`). Point-of-use: `toSafeHref` in `jobs/[slug]/job-detail-client.tsx:158,568`, `companies/[slug]/page.tsx:312`, `jobs/[slug]/apply/page.tsx:131-134` (`window.open(..., 'noopener,noreferrer')`). | No `dangerouslySetInnerHTML` in `app/` or `components/`. Company `linkedinUrl/twitterUrl/facebookUrl` are free strings (`profile.ts:426-428`), but only `linkedinUrl` is rendered, behind a fixed `https://linkedin.com/company/` prefix (`companies/[slug]/page.tsx:334`). Not exploitable. |
| S6a — CV exposure (application code) | **Fixed** | `lib/supabase.ts:198-205`: `getPublicUrl` throws for the `cv` bucket. `app/api/upload/route.ts:319-330`: CV upload returns only the object path plus a 120 s preview signed URL. Access goes only through `app/api/application/[id]/cv/route.ts:39-68` (candidate / owning company / admin via `canAccessApplicationCv`, `lib/security/cv-access.ts:95-102`; folder-owner check `:65`) and `app/api/profile/cv/route.ts`, which redirect to 60 s signed URLs (`lib/server/cv-download.ts:17-35`, `no-store`, `no-referrer`). The DB stores object paths (`profile/route.ts:612-620` via `normalizeOwnCvReference`). The UI links to the authorized routes (`candidate-review-modal.tsx:361`, `candidate-profile-form.tsx:751`). | Legacy signed/public URLs in old rows are parsed back to paths (`cv-access.ts:30-56`). Fallback concern: NF-14. |
| S6b — CV bucket configuration and legacy data | **Can't tell** | Not visible in code. Requires Supabase. | If the `cv` bucket is still **public**, the object paths stored in `candidate.resumeUrl` / `application.cvUrl`, which are returned to companies by `GET /api/application` (`route.ts:145-156`), map directly to public URLs. Verify with the read-only SQL in `docs/security/PRODUCTION_READINESS.md` §2. |
| S7 — Rate limiting | **Fixed** | Store: `lib/rate-limit.ts:69-89`, a single atomic `EVAL` (`INCR` + first-hit `PEXPIRE` + TTL repair) in Upstash Redis. Fail-closed by default (`:150-159,168-174`). No memory fallback in production (`:120-128`). 1.5 s backend timeout (`:48,162`). Applied on: login (per-IP 30/15 min plus per-account 10/15 min, hashed email: `lib/auth.ts:50-51,98-105`); register (`register/route.ts:47,89`); forgot-password (IP plus email: `forgot-password/route.ts:40-43`); reset-password (`reset-password/route.ts:17`); verify-email and resend (`verify-email/route.ts:25,116-119`); `generate-with-ai` (user plus IP: `generate-with-ai/route.ts:64-66`); `scrape-from-url` (user plus IP: `:57-60`); `cv-parse` (user plus IP: `onboarding/cv-parse/route.ts:48-51`). | IP source: on Vercel, `x-real-ip` first (`lib/utils.ts:191-193`), which isn't client-controllable there. Elsewhere the last XFF hop is used, with a shared `"unknown"` bucket (NF-17). The Lua script was tested only against a local fake (`tests/integration/redis-upstash.test.ts`), not real Redis. Availability trade-off: NF-10. Lockout DoS: NF-11. |
| S8 — Password-reset token leakage | **Fixed** | `forgot-password/route.ts:54`: all account work is deferred (`runAfterResponse`), and the response is identical in every case (`:16-19,56`). Errors are logged by name only (`:58`). Token: 256-bit CSPRNG, **SHA-256 stored** (`lib/security/one-time-token.ts:12-19`; `lib/server/account-emails.ts:25-31`). Link base comes only from config (`lib/email/index.ts:132-144`). Token goes in the URL **fragment** (`:151-156`). The email transport never logs bodies (`:63-77,85`). | No `console.log` in the route. Reset consumption is transactional, conditional and single-use (`reset-password/route.ts:45-63`; `one-time-token.ts:54-74`). It revokes other tokens and bumps `sessionVersion` (`:57-61`). TTL 1 h (`account-emails.ts:5`). |
| S9 — Company benefit ownership | **Fixed** | POST: `app/api/job-offers/route.ts:350-363` → `validateBenefitOwnership` (`lib/security/benefits.ts:25-40`: every id must match `companyId` from `companies.findUnique({userId})`). PUT: validated inside the transaction against the **job's** company (`[jobId]/route.ts:314-321`), before `deleteMany/createMany` (`:338-345`). Mass assignment: `featured/highlight/publishedAt/closedAt` stripped for non-admins (`:236-239`; `benefits.ts:47-53`). `companyId` on create is server-set after the spread (`route.ts:389-391`). `benefitIds` must be UUIDs (`validations/job.ts:52,111`). | Another company's benefits are rejected with 400 `INVALID_BENEFITS`. |
| S10 — Error information disclosure | **Fixed** | Job-offers GET: generic `"Failed to fetch job offers"` (`route.ts:282-288`). CV parse: generic messages (`onboarding/cv-parse/route.ts:125-147`). Repo-wide search: `error.message`/`stack` appear only inside `logger.*` calls (`[jobId]/applications/export/route.ts:284,340`, `[jobId]/views/route.ts:50`, `lib/company-analytics.ts:151`). The `profile/route.ts:552,563` messages are controlled domain-error messages. | `health/route.ts` returns fixed strings only. |
| A1 — Login email verification | **Partially fixed** | Enforcement exists: `lib/auth-callbacks.ts:174-176` (credentials, checked after a correct password, so no enumeration) and `:128` (existing sessions rejected). Google: `lib/auth.ts:171-173` rejects `email_verified !== true` and marks the account verified (`:139-149`). **But the flag defaults OFF**: `isEmailVerificationRequired()` reads `REQUIRE_EMAIL_VERIFICATION` (`auth-callbacks.ts:194-197`), and it isn't set in local `.env` (key list checked). | Enabling the flag would lock out every existing credentials user whose `emailVerified` is null, and sign them out within 15 min (`:128`), until they use the resend flow. That flow sends nothing unless `EMAIL_PROVIDER=resend` and `APP_URL` are set (`lib/email/index.ts:100-109,132-144`). Production flag values: **can't tell**. |
| A2 — Upload MIME validation | **Fixed** | `lib/supabase.ts:145-192`: size checks (`:156-166`, 5 MB), declared MIME must be on the allow-list **and** match the detected type (`:169-189`). Detection uses magic bytes: `lib/security/file-type.ts:48-49,63-83` (`%PDF-` + `%%EOF`, OLE2, DOCX ZIP structure, JPEG/PNG/WebP/GIF). Extension must agree (`:110-113,126-129`). SVG is not accepted anywhere. Images are re-validated by sharp (`upload/route.ts:279-288`) and re-encoded to PNG/WebP (`:31-71,291-298`). Stored `contentType` is the detected type (`:294-298`). Filenames are server-generated, `<userId>/<ts>-<uuid>.<ext>` (`lib/supabase.ts:127-134`). Content-length pre-check (`upload/route.ts:221-233`). | Delete path: normalized, owner-prefix and `..` checks (`upload/route.ts:387-398`). The CV-parse route re-checks PDF content (`cv-parse/route.ts:100-110`). DOC/DOCX are stored unmodified (not sanitized) but are served only via signed download URLs. |

---

## D. P0 Broken flows

| ID | Status | Evidence (file:line) | Notes |
|---|---|---|---|
| F1 — Company registration | **Fixed** (invite-only by design) | Public signup hardcodes `role:"CANDIDATE"` server-side (`app/api/auth/register/route.ts:215-221`). COMPANY accounts are created only with a validated admin invitation token (`:77-86,147-213`: COMPANY role, invitation consumed atomically, company row created). UI: `app/onboarding/company/page.tsx:46-88` renders `SignupForm` with `invitationToken` and `isInvitationMode`. The client can't send a role (`registerSchema` has none: `lib/validations/auth.ts:11-16`). Onboarding uses the DB role (`app/api/onboarding/route.ts:25-32,60-107`). | Google sign-up only ever creates CANDIDATE users (Prisma default `schema.prisma:17`). No company Google path exists, by design. `/register` never passes a token (`app/register/page.tsx:11`); that's correct for candidates. |
| F2 — Email verification and password recovery | **Fixed** (code). Delivery: **Can't tell** | Pages: `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`, `app/verify-email/page.tsx` (forms in `components/auth/token-flow-forms.tsx`). APIs: `forgot-password`, `reset-password`, `verify-email` POST/PUT. Provider: Resend over HTTPS with an 8 s timeout (`lib/email/index.ts:41-80`); senders never throw (`:219-244`). Verification sent on register (`register/route.ts:236-237`) and on resend (`verify-email/route.ts:129`). Tokens are hashed, single-use and expiring (1 h reset, 24 h verify: `account-emails.ts:5-6`), validated server-side and transactionally (`one-time-token.ts:54-74`). | **Default disables email**: `EMAIL_PROVIDER` defaults to `"disabled"` (`lib/email/index.ts:101,107`). Local `.env` has no `EMAIL_PROVIDER`/`RESEND_API_KEY`/`APP_URL`. Send failures are logged without tokens, and the user always sees the generic success message, so a misconfiguration is invisible to users. No real email was sent. |
| F3 — Company benefit deletion | **Fixed** | `app/api/profile/route.ts:416-472`: `syncCompanyBenefits` reconciles by id. It deletes only removed rows, scoped by `companyId` (`:445-449`), updates in place to preserve ids and `JobOfferBenefit` links (`:461-471`), and rejects foreign or duplicate ids (`:427-441`). Cascade still exists (`schema.prisma:289`, `onDelete: Cascade`), but only genuinely removed benefits cascade. | Residual footgun: an omitted `benefits` field means an empty list (`profile/route.ts:851`). Any partial POST would delete all benefits and their job links (NF-12). The current UI always sends the full list (`components/dashboard/company-profile-form.tsx:275-306`). |
| F4 — Login callback URL | **Still present** (functional) | `components/auth/login-form.tsx:50` always runs `router.push('/dashboard')`, and `:60` hardcodes Google `callbackUrl:'/dashboard'`. `callbackUrl` is never read. It *is* produced by `app/(public)/jobs/[slug]/apply/page.tsx:101`. | **No open redirect** exists, since nothing is honoured. The return-to-apply flow is broken. Fix with a same-origin, path-only validation. |
| F5 — Admin redirect and sidebar links | **Fixed** | `app/(dashboard)/dashboard/page.tsx:17-18`: ADMIN → `/dashboard/admin`. Guard: `app/(dashboard)/dashboard/admin/layout.tsx:17-24` (`requireAdmin`, `lib/auth-helpers.ts:74-89`). The live sidebar is `components/dashboard/sidebar.tsx:58-76`, and all its targets exist (`dashboard/admin/{,users,companies,tokens,stats}`, company and candidate routes). | `components/ui/sidebar.tsx:40-62,201,208` still holds dead links (`/admin`, `/admin/jobs`, `/dashboard/settings`, …). It is **imported nowhere** (repo-wide search), so it's dead code that should be deleted. |
| F6 — Fresh install and environment | **Partially fixed** | `.env.example` exists and documents most variables (DB, auth, Google, OpenAI, Supabase, Upstash, invitation key, `REQUIRE_EMAIL_VERIFICATION`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`). `tsx` is in devDependencies (`package.json:68`). **But** `prisma.config.ts:11` requires `env('DIRECT_URL')`, while `.env.example:10`, `lib/env.ts:10` and the docs use `DIRECT_DATABASE_URL`. **Verified**: loading `prisma.config.ts` with only `DIRECT_DATABASE_URL` throws `Cannot resolve environment variable: DIRECT_URL.`, so `postinstall: prisma generate` (`package.json:12`) fails on a fresh `npm ci`, and so does CI (`perf-ci.yml:23`). | `dotenv` is imported (`prisma.config.ts:2`) but **not declared**; it resolves only transitively via `c12` (lockfile). `.env.example` is listed in `.gitignore:13,85-86` yet tracked. `prisma.config.ts:8` seeds with `tsx ./prisma/seed.ts`, but `package.json:20` defines a separate `ts-node` seed on `prisma/seed-k6.ts`, which is itself gitignored (`.gitignore:69`). Build-time requirement: `INVITATION_TOKEN_ENCRYPTION_KEY` must be valid base64 of 32 bytes, or `next build` fails (observed). |

---

## E. P1 Functional findings

| # | Item | Status | Evidence (file:line) | Notes |
|---:|---|---|---|---|
| 1 | Keyword and location merged with OR | **Still present** | `lib/job-offers-utils.ts:91-97` (location OR), `:99-125` (search appended to the **same** `where.OR`), `:149-152` (one OR group). Multi-value contract/employment/activity also join that OR (`:57-58,67-68,144-145`). | `search=agent&location=Tunis` returns jobs matching *either* condition. |
| 2 | Only 10 fetched, then filtered client-side | **Fixed** | `JobsPageClient.tsx:118,182,213`: limit 20, all filtering server-side. | — |
| 3 | `job.department` | **Fixed** | Remains only as an unused type field (`JobsPageClient.tsx:93`). There's no `department` column in `schema.prisma`. | Remove the dead field. |
| 4 | Salary string parsing | **Still present** | `JobsPageClient.tsx:321-326`: `parseFloat(job.salary)` on free text, otherwise `salaryMax`. `salaryMin` is ignored, and the currency defaults to USD. | `"1500-2000 TND"` → `"د.ت1.5k/mo"`. A range is shown as one number. |
| 5 | Experience filter wired | **Still present** | No experience parameter in `buildQueryParams` (`JobsPageClient.tsx:179-207`) or in the API filters (`app/api/job-offers/route.ts:126-143`). | Not implemented. |
| 6 | Work-mode filter wired | **Partially fixed** | Only "Remote" (via the location dropdown) maps to `isRemote=true` (`JobsPageClient.tsx:198-203`). No UI for Hybrid or On-site. The API supports `isHybrid` (`route.ts:136`). | — |
| 7 | Debounce | **Fixed** (N/A) | Fetches happen only on "Apply Filters" or a page change (`JobsPageClient.tsx:229-236,263-301`), not per keystroke. | — |
| 8 | Abort previous requests | **Still present** | `JobsPageClient.tsx:209-227`: no `AbortController` / `signal`. | A slow earlier response can overwrite a newer one. |
| 9 | Filters reflected in URL | **Fixed** | Read on mount (`JobsPageClient.tsx:124-139,174-176`), written on apply (`:270-300`). | — |
| 10 | Soft-deleted jobs hidden on company pages | **Still present** | `app/(public)/companies/[slug]/page.tsx:136-166`: `where:{companyId,status:'PUBLISHED'}` has no `deletedAt:null` and no `expiresAt` filter. Same in `app/api/companies/[slug]/route.ts:49`. | A soft-deleted job that was still PUBLISHED stays visible and counted. |
| 11 | `expiresAt` checked when listing | **Partially fixed** | Main listing: yes (`job-offers-utils.ts:154-156`). Not checked on company pages (#10), single-job GET (`[jobId]/route.ts:83-95`), or application POST (`application/route.ts:252,286`). | Candidates can apply to expired jobs until the expire job flips their status. |
| 12 | EXTERNAL jobs accept internal applications | **Still present** | `app/api/application/route.ts:248-257,283-288` check only `deletedAt`/`status`. No `applicationType` guard. | The UI redirects (`apply/page.tsx:131-136`), but the API accepts a direct POST. Made worse by NF-01. |
| 13 | Dashboard stats hardcoded to zero | **Fixed** | Company: `dashboard/company/page.tsx:240-292` (groupBy/count). Candidate: `api/dashboard/candidate/route.ts:62-67,124-128`. Admin: `api/admin/overview/route.ts:31-62` (SQL counts). | Zeroed maps are only defaults before aggregation. |
| 14 | Apply page error handling | **Fixed** | `apply/page.tsx:137-139` (job error), `:168-170` (load failure), `:204-212` (submit error surfaced, including the API message). | — |
| 15 | Cache revalidation on job edit | **Partially fixed** | PUT, POST and DELETE call `revalidateJobOffers()` (`lib/cache.ts:68-72`: tags `job-offers`, `job-offer`). `companies/[slug]/page.tsx:19` uses ISR `revalidate=600` with no tag, so job edits and deletions appear on company pages only after up to 10 min. | `revalidateTag(..., "max")` is stale-while-revalidate: the first request after an edit still gets stale data. |
| 16 | Invalid status query → 500 | **Partially fixed** | Fixed: `api/job-offers/route.ts:145-151` (400), `[jobId]/applications/route.ts:36-42,82`. Still present: `api/application/route.ts:26,57-59,125-127` (raw string into a Prisma enum filter) and `api/admin/job-offers/route.ts:55,82-83`. | A Prisma validation error lands in the generic catch and returns 500. |
| 17 | `salaryMin <= salaryMax` validated | **Still present** | `lib/validations/job.ts:48-49,107-108`. No refine compares them. | — |
| 18 | Hero search wired to jobs search | **Partially fixed** | `components/landing/cx-hero-search.tsx:63-80` pushes `/jobs?location&activityType&language`. **But** the API drops `activityType` for public users (NF-02), so the hero's main filter has no effect. There's no keyword input. | — |
| 19 | Fake jobs displayed | **Fixed** | Homepage renders only DB companies (`app/(public)/page.tsx:6-30,36-61`). | `components/landing/featured-section.tsx` (demo data) is imported nowhere. |
| 20 | Fake brand names displayed | **Fixed** | Not rendered on any live page. `components/landing/trusted-strip.tsx:5-6` (Teleperformance, Concentrix, …) is imported nowhere. | Delete the dead component (trademark risk if it's ever re-enabled). |
| 21 | Hardcoded statistics | **Fixed** | No hardcoded counters on public pages (`page.tsx`, `about`, hero, jobs, companies). | `CompaniesPageClient.tsx:41` "1000+" is a size-filter label. |
| 22 | `/terms`, `/privacy`, `/salaries` exist | **Partially fixed** | `app/(public)/terms/page.tsx` and `app/(public)/privacy/page.tsx` exist. `/salaries` doesn't. | It's linked only from the unused `components/landing/header.tsx:43,87`. |
| 23 | `not-found.tsx` | **Still present** | None in `app/` (search). The framework default `/_not-found` is used. | — |
| 24 | `error.tsx` / `global-error.tsx` | **Still present** | None in `app/`. | Unhandled render errors show the default Next error page. |
| 25 | `loading.tsx` | **Partially fixed** | Present: `dashboard/candidate`, `dashboard/company`, `(public)/jobs`, `onboarding/company`. Missing elsewhere (admin, companies, job detail). | — |
| 26 | Automated tests present | **Fixed** | `tests/security/` (12 files, 142 tests) and `tests/integration/` (9 files, 102 tests). All pass. | Not run in CI (#27). |
| 27 | CI configured | **Partially fixed** | `.github/workflows/perf-ci.yml` runs `npm ci`, build and Lighthouse. It would fail at `npm ci` today (F6), and it builds with `secrets.DATABASE_URL`, so prerender queries hit that DB (NF-05). `.github/workflows/k6-load-test.yml:14` has bad YAML indentation and doesn't parse; if fixed, it would load-test staging with 50 VUs on **every push and PR** to `main`. | No lint, `tsc` or test job anywhere. |

---

## F. New findings

| ID | Severity | Issue | Evidence | Impact | Recommended fix |
|---|---|---|---|---|---|
| NF-01 | **High** (integrity / functional) | A partial PUT silently converts EXTERNAL jobs to INTERNAL. | `lib/validations/job.ts:116`: `applicationType: ...optional().default("INTERNAL")` in the **update** schema. Verified with zod 4.6.7: parsing `{title}` yields `applicationType:"INTERNAL"`. The UI sends status-only PUTs: `company-jobs-client.tsx:241-245` (`{status:newStatus}`). | Publishing, closing or archiving an EXTERNAL job flips it to INTERNAL. The external URL stops being used and candidates apply internally to a company that doesn't process them. | Remove `.default()` from the update schema (keep it on create), and add a server-side EXTERNAL guard on application POST (P1 #12). |
| NF-02 | **High** (functional) | The public job listing ignores the `activityType` filter. | `app/api/job-offers/route.ts:203-218`: the `getPublicJobOffers({...})` call omits `activityType`, even though it's parsed (`:133`) and validated (`:175-184`). The cache key slot stays empty (`:87`). Sent by `JobsPageClient.tsx:189-192` and `cx-hero-search.tsx:72-74`. | The main filter on `/jobs` and the homepage hero search return unfiltered results for anonymous users and candidates. | Pass `activityType: filters.activityType`, and add an integration test asserting the filter reaches Prisma. |
| NF-03 | Medium (functional) | COMPANY users browsing the public `/jobs` page see only their own jobs. | `JobsPageClient.tsx:179-183,213` sends no `companyId`. `lib/security/job-offer-scope.ts:36-39` gives a COMPANY with a profile and no `companyId` the **owner** scope. | Recruiters see a "public" catalogue limited to themselves, including any status filter they pass. | Make owner scope explicit opt-in (e.g. `scope=mine` or a dashboard-only endpoint); default every role to the public scope. |
| NF-05 | Medium (operational safety) | Builds query the database, and Next auto-loads the production `.env`. | `app/(public)/jobs/[slug]/page.tsx:174-176` (`generateStaticParams` → `prisma.jobOffer.findMany`). A prerender `prisma.companies.findMany` was observed in the isolated build log. `@next/env` loads `.env` ("Environments: .env" in the build output). `perf-ci.yml:28-38` builds with `secrets.DATABASE_URL`. | Running `npm run build` locally reads the production DB with production credentials; CI does the same with whichever DB the secret points at. Read-only, but it violates environment isolation and couples builds to DB availability. | Keep production secrets out of the dev checkout (use `.env.local` pointing at a dev DB); make DB-backed pages dynamic or tolerate an empty build-time DB; give CI a disposable DB. |
| NF-06 | Medium (auth correctness) | Email addresses are not normalized; uniqueness and lookups are case-sensitive. | `schema.prisma:13` (`@unique`, case-sensitive). `lib/validations/auth.ts:12,24` (no lowercasing). `register/route.ts:101-104,215-217` stores the raw case. Login `lib/auth.ts:109-110` and reset `lib/server/account-emails.ts:18-21` use exact match. Only admin edits are case-insensitive (`admin/users/[id]/route.ts:107,131-135`). | `Alice@x.com` and `alice@x.com` can be separate accounts (look-alike accounts in front of recruiters). Users who type a different case can't log in or reset. | Lowercase and trim in every schema and lookup; dedupe existing rows; consider `citext` or a unique index on `lower(email)`. |
| NF-07 | Medium | The view counter is unauthenticated, unthrottled and accepts any job. | `app/api/job-offers/[jobId]/views/route.ts:5-42`: no auth, no rate limit, matches by id **or** slug, with no `status`/`deletedAt` check. | Anyone can inflate a job's views (including drafts and deleted jobs), distorting company analytics. It's also an unbounded DB write path. | Add per-IP rate limiting, dedupe (hashed IP/day), and restrict to PUBLISHED, non-deleted jobs. |
| NF-08 | Medium | HTML pages have no clickjacking protection; `Referrer-Policy` has an invalid value. | `next.config.ts:48-75`: `X-Frame-Options: DENY` and the CSP (`frame-ancestors 'none'`) apply only to `/api/:path*`. `:84-85` sets `"strict-origin-when-x-origin"`, which isn't a valid token, so browsers ignore it. | Dashboard, admin and profile pages can be framed (UI redress). The intended referrer policy isn't applied. | Apply `frame-ancestors 'none'` / `X-Frame-Options` to all routes, fix the value to `strict-origin-when-cross-origin`, and add a page CSP. |
| NF-09 | Medium | Known vulnerable dependencies. | `npm audit`: 41 total (29 high, 9 moderate, 3 low); `--omit=dev`: 18 (13 high, 5 moderate, 0 critical). Direct packages flagged: `@vercel/functions` (via `@vercel/oidc`), `prisma` (via `@prisma/config` → `deepmerge-ts`, `@prisma/dev` → `hono`/`@hono/node-server`), `exceljs` (→ `uuid`). Transitive: `fast-uri`, `minimatch`, `brace-expansion`, `source-map-js`, `mysql2`. `next-auth` is `5.0.0-beta.32`. | Mostly tooling/transitive and DoS-class. No request-path exploit was confirmed in this audit. | In Phase 2: upgrade `prisma`/`@prisma/*`, `@vercel/functions`, and `@lhci/cli` (major); assess the `exceljs` alternative; add `npm audit --omit=dev` to CI. |
| NF-10 | Low (availability) | A Redis outage takes down login and the public catalogue. | `lib/rate-limit.ts:150-158`: fail-closed by default. No route sets `failOpen` (repo search). Applies to `job-offers-list` and `job-offer-single` (`route.ts:111`, `[jobId]/route.ts:58`) and to login. | Safe for brute-force protection, but any Upstash incident causes a full public outage. | Use `failOpen` (or a conservative local fallback) for cheap public reads only; keep auth and AI fail-closed. |
| NF-11 | Low | Per-account login lockout can be used as a DoS. | `lib/auth.ts:51,101`: 10 attempts per 15 min per email, regardless of IP. | An attacker can keep a known user locked out. | Count only failed attempts; add progressive delay or CAPTCHA instead of a hard block; let a successful reset clear the counter. |
| NF-12 | Low | An omitted `benefits` field deletes every company benefit, and their job links. | `app/api/profile/route.ts:851` (`benefits ?? []`); cascade at `schema.prisma:289`. | A future or partial client (e.g. a logo-only update) would wipe benefits across all jobs. | Treat `undefined` as "leave unchanged". |
| NF-13 | Low | The application POST response exposes the company owner's user id. | `app/api/application/route.ts:298-311` (`company.select.userId: true`). | Internal identifier disclosed to candidates. | Drop `userId` from the response select. |
| NF-14 | Low (privacy) | The application CV falls back to the candidate's **current** resume. | `app/api/application/[id]/cv/route.ts:62-63` (`cvUrl ?? candidate.resumeUrl`). | Companies can download CVs uploaded after the application, including from older applications with a null `cvUrl`. | Serve only the CV snapshot attached to the application. |
| NF-15 | Low | An admin email change leaves outstanding reset and verification tokens valid. | `app/api/admin/users/[id]/route.ts:236-239` bumps `sessionVersion` only. No `passwordResetToken`/`emailVerificationToken` cleanup, and `emailVerified` isn't reset (the search found no matches in the file). | A reset link already mailed to the **old** address works for up to 1 h after reassignment. A pending verification link verifies the new address. | Delete both token types and clear `emailVerified` in the same transaction. |
| NF-16 | Low (hygiene) | Gitignored scratch files are tracked, and sensitive local artifacts sit in the working tree. | Tracked despite `.gitignore`: `tmp-dbcheck.ts`, `tmp-verify/*`, `verify_seed.ts`, `inspect_trgm.js`, `WORK_LOG.md`, `postman_collection.json`, `.env.example`; the deleted `false))` entry. Untracked locally: `.k6-*-cookies.txt` (session cookies, dated 2026-10-05; past the 30-day JWT `maxAge` if never refreshed), `results.json` (157 MB). | Confusing repo state, and a risk of accidentally sharing session cookies. No secrets were found in tracked files or in a history search for JWT, `sk-proj-` and `upstash.io` patterns. | `git rm --cached` the scratch files, fix `.gitignore` (don't ignore `.env.example`), and delete the stale cookie files. |
| NF-17 | Low | Client-IP derivation outside Vercel is spoofable or shared. | `lib/utils.ts:191-206`: off-Vercel it uses the **last** XFF entry, else `"unknown"`. | When self-hosted without a proxy that appends XFF, a client can rotate IPs. Without XFF, all clients share one bucket. | Make the trusted-proxy configuration explicit (env-driven hop count); fail visibly when it's unset in production. |
| NF-18 | Low | The health endpoint is unauthenticated and pings three backends on every hit. | `app/api/health/route.ts:83-90`. No rate limit. | Cheap amplification against DB, Redis and Supabase; reveals which integrations are configured. | Use a shallow public liveness check plus a protected deep check. |

(There is no NF-04: the fresh-install defect is reported under F6.)

---

## G. Recommended remediation order

The default order is adjusted because S1, S2, S3, F1 and F3 are already fixed in the working tree. Operational and integrity risks now come first.

1. **Commit the working tree** (it's the only place the fixes exist), then **apply migration `20261109120000_add_user_session_version` to staging before deploying** (see `docs/security/PRODUCTION_READINESS.md` §1).
2. **F6:** make `prisma.config.ts` and `.env.example` agree (`DIRECT_URL` vs `DIRECT_DATABASE_URL`), declare `dotenv`, and fix `.gitignore`. This unblocks `npm ci` and CI.
3. **NF-05:** isolate builds from production (no production `.env` in the dev checkout, disposable CI DB, DB-tolerant prerender).
4. **S6b:** verify the `cv` bucket is private and audit legacy rows (read-only SQL in the readiness doc).
5. **NF-01 + P1 #12:** fix the update-schema default and enforce `applicationType`/`expiresAt` in application POST.
6. **NF-02 + P1 #1 + NF-03:** search correctness (forward `activityType`, AND between filter groups, public scope by default).
7. **A1 + NF-06 + NF-15:** email-verification rollout (configure the provider and `APP_URL`, backfill or grandfather existing users before enabling the flag), email normalization with a dedupe migration, and token cleanup on email change.
8. **NF-08, NF-07, NF-09:** headers, the view counter, dependency upgrades.
9. **F4:** honour `callbackUrl` with same-origin, path-only validation.
10. **Remaining P1 items:** #10, #11, #15, #16, #17, #4–#6, #8, #22–#25; then wire lint, `tsc` and the tests into CI (#27) and fix the k6 workflow YAML.
11. **Low and hygiene:** NF-10…NF-14, NF-16…NF-18; the 20 app ESLint errors; delete dead components (`components/ui/sidebar.tsx`, `components/landing/{trusted-strip,featured-section,header}.tsx`).

---

## H. Final counts

| Category | Audited | Fixed | Still present | Partially fixed | Can't tell |
|---|---:|---:|---:|---:|---:|
| C. P0 security (S1–S10, S6 split a/b, A1, A2) | 13 | 11 | 0 | 1 | 1 |
| D. P0 broken flows (F1–F6) | 6 | 4 | 1 | 1 | 0 |
| E. P1 functional (1–27) | 27 | 10 | 9 | 8 | 0 |
| **Total** | **46** | **25** | **10** | **10** | **1** |

**New findings by severity:** Critical 0 · High 2 (NF-01, NF-02; both functional/integrity) · Medium 6 (NF-03, NF-05 … NF-09) · Low 9 (NF-10 … NF-18). **Total 17.**

**"Fixed" vs "verified."** "Fixed" means confirmed by reading the executing code path in the working tree. Where the repo has tests, those also pass (244/244). No fix was verified against live infrastructure.

**Checks not completed: 7.** Each needs isolated test infrastructure.

1. CV bucket public/private flag and legacy URL rows (S6b). Requires Supabase.
2. Real email delivery through Resend (F2/A1). Requires a provider sandbox.
3. `FIXED_WINDOW_LUA` / `PUBLISH_MAX_LUA` executed in a real Redis. Only a local fake was used.
4. Production values of `REQUIRE_EMAIL_VERIFICATION`, `EMAIL_PROVIDER`, `APP_URL`, `VERCEL`. Requires access to the deployment config.
5. Migration state of any real database.
6. Google OAuth end-to-end (the `email_verified` path and account linking).
7. Runtime and browser behaviour (no dev server, Playwright or k6 run). K6 must never target production.

**Five most important remaining risks**

1. **The fixes are uncommitted, and a fresh install fails (F6).** Deploying from Git ships the pre-fix code; a clean checkout can't `npm ci`.
2. **Builds read the production DB through `.env` (NF-05).** Environment isolation is broken for developers and CI.
3. **CV bucket privacy is unverified (S6b).** If the bucket is public, stored object paths are equivalent to public CV URLs.
4. **EXTERNAL jobs silently become INTERNAL on any status change (NF-01)**, with no server-side guard (P1 #12).
5. **Core search filters are wrong (NF-02, P1 #1).** The activity filter is ignored for public users, and keyword/location use OR.

---

### Appendix — what was executed

| Command | Network | Notes |
|---|---|---|
| `git status/branch/log/diff/show/ls-files/check-ignore/cat-file` | none | Read-only. |
| `npx tsc --noEmit` | none | Rewrites the gitignored `tsconfig.tsbuildinfo` (incremental). |
| `npx eslint .` (JSON output to the scratchpad) | none | — |
| `npm run test:security`, `npm run test:integration` | none | Placeholder env (`DATABASE_URL` → `127.0.0.1:9`, Upstash/Supabase/OpenAI empty, `EMAIL_PROVIDER=disabled`). |
| `next build` via a scratchpad wrapper | localhost:9 (placeholder DB/Redis/Supabase); public Google Fonts CDN for `next/font/google` (`app/layout.tsx:2`). No project service. | Every `.env` key pre-set to a placeholder, telemetry disabled. Rewrites the gitignored `.next/`. |
| `npx tsx -e "import('./prisma.config.ts')"` with `DOTENV_CONFIG_PATH` → empty file | none | Config evaluation only; no Prisma command was run. |
| `node -e` (zod behaviour, YAML parse, lockfile inspection) | none | — |
| `npm audit --json`, `npm audit --omit=dev --json` | public npm registry only | Read-only; no install or fix. |

`.env` values were never printed; only key names and value *classifications* (placeholder vs real-looking) were inspected.

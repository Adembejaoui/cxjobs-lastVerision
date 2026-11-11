# Phase 4B: Final production readiness audit (audit only)

- **Date:** 2026-11-10
- **Subject:** the working tree on `hardening/production-readiness`, HEAD `6e77684` plus all uncommitted Phase 1–4A changes.
- **Method:** the repository code was treated as the source of truth and re-read for every blocker. Earlier reports were used only as pointers. Local quality gates were re-run.
- **Safety:** this phase changed **no application code, test, configuration or dependency**. Only this file and `docs/PRODUCTION-READINESS-AUDIT.md` were written.
  - No commit, push, deploy, migration, branch change, stash or reset.
  - No database, Supabase Storage, Upstash, Resend, Google, OpenAI or Vercel service was contacted. Every SQL statement below is **NOT EXECUTED**.
  - No secret value was printed. The local `.env` was classified by host and port only, and hard-coded passwords were compared by SHA-256 prefix only.

Status vocabulary: **FIXED IN CODE** · **VERIFIED LOCALLY** · **VERIFIED EXTERNALLY** · **NOT VERIFIED** · **REQUIRES PRODUCTION ACTION**.

---

## 1. Verdict

### **NO-GO for production today. CONDITIONAL GO after the checklist in §7.**

The application code is in good security shape, and every Phase 1–4A fix is present and tested locally. Nothing is deployable yet:
- **B1:** none of it is committed.
- **B2–B5:** none of the infrastructure or data blockers has been verified.
- **New:** a likely P0 data issue (§4, **N1**). The repository hard-codes one shared password for 105 seeded test accounts, including 5 COMPANY accounts. The evidence suggests k6 was run against production, so those accounts may exist there.

Moving from NO-GO to CONDITIONAL GO needs only read-only checks and approved, bounded production actions. No further code change is strictly required, although §4 lists recommended ones.

| Blocker | Code | Local | External | Overall |
|---|---|---|---|---|
| B1 Uncommitted changes | All fixes present in the working tree | VERIFIED LOCALLY (tree complete; nothing required is gitignored) | — | **OPEN.** REQUIRES ACTION (commit/PR, user approval) |
| B2 Migrations | FIXED IN CODE (2 additive migrations; schema matches) | VERIFIED LOCALLY by static replay only | NOT VERIFIED (no DB available; drift unknown) | **OPEN.** REQUIRES PRODUCTION ACTION |
| B3 CV bucket privacy | FIXED IN CODE (private-bucket design; signed 60 s URLs after authorization) | VERIFIED LOCALLY (tests) | NOT VERIFIED; **treat the bucket as public** | **OPEN.** Read-only check, then REQUIRES PRODUCTION ACTION if public |
| B4 Duplicate emails | FIXED IN CODE (no new duplicates; Phase 4A H8 code side) | VERIFIED LOCALLY | NOT VERIFIED (existing data unknown) | **OPEN.** Read-only check, then manual resolution |
| B5 External integrations | FIXED IN CODE (timeouts, fail modes, guards) | VERIFIED LOCALLY against fakes only | NOT VERIFIED | **OPEN.** Needs a safe external test environment |

---

## 2. Local verification (Task D)

All commands were run in the working tree on Windows 10 (Node v24.14.1 locally; CI pins Node 22).

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit --incremental false` | **PASS**: exit 0, 0 errors. `--incremental false` so nothing is written (the project's `tsconfig` is incremental) |
| ESLint | `npm run lint:ci` (`eslint . --max-warnings=35`) | **PASS**: exit 0, 0 errors, 35 warnings (ratchet holds; same as Phase 3 and 4A) |
| Security tests | `npm run test:security` | **PASS**: 189/189; 0 fail, 0 skipped, 0 cancelled, 0 todo |
| Integration tests | `npm run test:integration` | **PASS**: 220/220; 0 fail, 0 skipped, 0 cancelled, 0 todo |
| Production build | `next build` with **all 16 keys** from the local `.env` overridden by unroutable placeholders (`127.0.0.1:9`, dummy secrets) | **PASS**: exit 0, compiled, 63/63 pages, 0 database-connection errors in the log |
| Dependency audit | `npm audit --omit=dev` | 2 moderate (`exceljs` → `uuid`, GHSA-w5hq-g745-h8pq; earlier analysed as unreachable), 0 high, 0 critical. Unchanged |
| Side effects | `git status --short`, `git diff` hash and `next-env.d.ts` hash compared before and after all checks | **Identical**: the checks modified no tracked or untracked file (only the gitignored `.next/`) |

Not run, by design: k6 or any load test, `prisma migrate *`, `prisma db *`, the seed scripts, `next start`/`next dev` against the local `.env` (it points at production, §3 B2), anything contacting an external service.

---

## 3. Blockers B1–B5 (Task A)

### B1: Uncommitted code changes. **OPEN**

**Evidence**
- Branch `hardening/production-readiness`; HEAD `6e77684` ("v0").
- `git status --short`: 123 entries (74 modified, 15 deleted, 34 untracked paths). `git diff --stat`: 89 tracked files, +4026 / −10463. Most of the deletions are `package-lock.json` (−6561 net), the four dead components deleted in Phase 2, and the 9 company pages moved into `company/(onboarded)/` in Phase 4A.
- **Untracked but required at runtime.** A commit that leaves these out breaks the application:
  - Security modules: `lib/security/`, `lib/auth-callbacks.ts`, `lib/server/{session-revocation,user-email,auth-adapter,account-emails,after-response,cv-download,pdf-text-worker}.ts`, `lib/email/`, `lib/cv/`, `lib/ai-errors.ts`, `instrumentation.ts` (env validation).
  - Routes: the CV routes (`app/api/{application/[id],profile}/cv/`), `app/api/auth/invitation/`, the token-flow pages (`app/{forgot-password,reset-password,verify-email}/`), `app/{error,global-error,not-found}.tsx`, `components/auth/{company-invitation,token-flow-forms}.tsx`, and the company route group `app/(dashboard)/dashboard/company/(onboarded)/`.
  - **`public/`, which is entirely untracked** (HEAD has 0 files under `public/`). It holds `public/brand/cxjobs-watermark.png`, used by CV export (`lib/cv/watermark.ts`).
  - Both new migrations, and `.github/workflows/ci.yml`.
- **Tests and docs, untracked:** `tests/{security,integration,helpers}/`, `tests/k6/lib/` (the k6 target guard the tracked k6 scripts import), `docs/`.
- **Gitignored files** (`git status --ignored`): `.env`, `.next/`, `app/generated/` (Prisma client, regenerated by `postinstall`), `node_modules/`, `tsconfig*.tsbuildinfo`, `prisma/seed-k6.ts`, `tests/k6/generate-company-sessions.js`, `tests/k6/production-full-app.js`, `tmp-idor-*`, `results.json`, `.k6-*cookies.txt`, `.kilo/`.
  - **No required fix lives only in a gitignored file:** nothing in `app/`, `lib/` or `components/` imports any of them.
  - `package.json` `seed:perf` references the ignored `prisma/seed-k6.ts` (dev-only script).
  - The two ignored k6 scripts already use the staging-only target guard.
- **Generated files:**
  - `next-env.d.ts`: modified vs HEAD by `next build`, +1 line `import "./.next/types/root-params.d.ts"`. Safe to commit as-is or to revert; Next regenerates it.
  - `package-lock.json`: modified, consistent with `package.json`; a lockfile change from earlier phases.
- **Pre-existing user changes vs phase changes:** the phase documents attribute the modified files to Phases 1–4A. One pre-existing local edit (`candidate-review-modal.tsx`) was carried into the route group unchanged in Phase 4A. The tracked deletion of a junk file named `false))` is harmless. Tracked scratch files remain: `tmp-dbcheck.ts`, `tmp-verify/*.ts` (no secrets found; NF-16).
- **Completeness:** tsc, lint, 409 tests and the build pass on this tree, so the tree is self-consistent and contains every fix the phase docs list.

**Required action:** commit the full working tree (including every untracked path above and the deletions) on a branch, open a PR, and let `ci.yml` run green on GitHub.
- Do **not** commit `.env`, the k6 cookie files or `results.json`; they are gitignored, so keep it that way.
- Review the diff for `tests/k6/README.md` and `prisma/seed.ts` in light of **N1**.
- No production access needed. **Explicit user approval is required** (the commit/push was out of scope for every phase so far).

**Verification criteria:** `git status` clean apart from ignored files; a fresh clone runs `npm ci && npm run typecheck && npm run lint:ci && npm run test:security && npm run test:integration && npm run build` green in CI.

### B2: Database migrations. **OPEN, NOT VERIFIED against any database**

**Evidence**
- Both directories exist and are untracked:
  - `prisma/migrations/20261109120000_add_user_session_version/migration.sql`: `ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;`. Additive. On PostgreSQL 11 or later, a constant default is a metadata-only change, so it doesn't rewrite the table (a brief `ACCESS EXCLUSIVE` lock only).
  - `prisma/migrations/20261109130000_restore_trigram_search_indexes/migration.sql`: `CREATE EXTENSION IF NOT EXISTS pg_trgm` plus 5 × `CREATE INDEX IF NOT EXISTS … USING GIN (… gin_trgm_ops)` on `job_offers.{title,description,customLocation}` and `companies.{name,location}`. Additive, idempotent, no DROP/ALTER/UPDATE.
- **Schema consistency:** `git diff HEAD -- prisma/schema.prisma` shows exactly 3 additions: `User.sessionVersion Int @default(0)`, 3 JobOffer GIN indexes and 2 companies GIN indexes, with `map:` names identical to the migration. No other schema change, so no undeclared drift was introduced by Phases 1–4A.
- **No earlier migration was edited:** `git diff HEAD -- prisma/migrations` is empty for tracked files; the only changes are the two new directories. They sort last (`…120000` < `…130000`).
- **Index use matches the queries:** `contains` + `mode: "insensitive"` (`ILIKE '%…%'`) on exactly those five columns (`lib/job-offers-utils.ts`; `app/api/dashboard/candidate/route.ts` for `description`). The static replay test `tests/security/migrations.test.ts` passes.
- **Pre-existing history oddities** (tracked at HEAD, not introduced by these phases):
  - `20261107143000_add_multiple_shift_types` and `20261107143012_add_multiple_shift_types` both convert `candidates.shiftType` to an array. On a clean replay the second is a type no-op plus a `CREATE INDEX "candidates_lastCvExportAt_idx"`, which is valid because `20261012151716` dropped it. Consistent in order.
  - `20261012143343` says the column may have been "added via `prisma db push`", so the production schema may have been changed outside migrations. **Drift between production and the migration history is therefore a real possibility and is unverified.**
- **Operational hazard found (see N2).** The local `.env` contains `DATABASE_URL` (Supabase pooler, port 6543) and `DIRECT_DATABASE_URL`/`DIRECT_URL` (Supabase direct, port 5432; classified by host and port only). `prisma.config.ts` uses the direct URL for every CLI command. With this checkout, `npm run db:migrate` (`prisma migrate dev`), `npm run db:push` and `prisma db seed` / `migrate reset` would act on the only Supabase database, presumably production. `migrate dev` offers to **reset** the database when it detects drift.

**Locking risk**
- The `sessionVersion` migration takes a momentary lock.
- Each trigram `CREATE INDEX` (not `CONCURRENTLY`; it can't run inside Prisma's script transaction) holds a `SHARE` lock that **blocks writes** to `job_offers` / `companies` until the index is built: seconds at small sizes, longer for large text columns.
- Mitigation: check sizes first (SQL 2.2). For large tables, run the five `CREATE INDEX CONCURRENTLY IF NOT EXISTS …` by hand in a quiet window. The migration then becomes a no-op.

**Required action** (in this order; each production step needs explicit approval):
1. Read-only: `npx prisma migrate status` and the SQL in §8.2 against production (needs credentials and approval).
2. If a staging DB becomes available: `prisma migrate deploy`, then `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --shadow-database-url <staging-shadow>` (expect empty).
3. Production: `npx prisma migrate deploy` with `DIRECT_DATABASE_URL`. **Never `migrate dev`, `db push` or `migrate reset`.** Then deploy the code.

**Verification criteria:** `migrate status` reports up to date; `users.sessionVersion` exists with default 0; `\di *trgm*` lists 5 indexes; `EXPLAIN` of a catalogue search shows a Bitmap Index Scan on a trigram index.

**Dependency:** code that selects `sessionVersion` (`lib/auth-user-record.ts`) must not run before migration 1 is applied, or every authenticated request fails.

### B3: CV storage privacy. **OPEN** (code ready for a private bucket; bucket state NOT VERIFIED and assumed public)

**Code paths inspected**

| Path | Behaviour | Evidence |
|---|---|---|
| Upload (`POST /api/upload`, `type=cv`) | CANDIDATE only. Content-sniffed PDF/DOC/DOCX, 5 MB. Server-generated path `<userId>/<ts>-<uuid>.<ext>`. Returns the **object path** plus a **120 s** signed preview, never a public URL | `app/api/upload/route.ts:81,319-330`; `lib/supabase.ts:127,145-192` |
| Public URL guard | `getPublicUrl()` throws for the `cv` bucket | `lib/supabase.ts:198-209` |
| Candidate's own CV (`GET /api/profile/cv`) | Active session, then the stored path parsed and folder-owner checked, then a 302 to a **60 s** signed URL with `no-store` and `no-referrer` | `app/api/profile/cv/route.ts:14-36`; `lib/server/cv-download.ts` |
| Application CV (`GET /api/application/[id]/cv`) | Active session, rate limit, then `canAccessApplicationCv` (the applying candidate, the owning company resolved from the DB, or admin), 404 otherwise; object must be in the applicant's folder; 60 s signed URL | `app/api/application/[id]/cv/route.ts:26-68`; `lib/security/cv-access.ts:95-104` |
| Frontend | Links only to `/api/profile/cv` and `/api/application/<id>/cv`; no component renders a stored CV reference as `href`/`src` (repo-wide search) | `components/dashboard/candidate-profile-form.tsx:752`, `…/candidate-review-modal.tsx:361` |
| Delete | Owner-prefix checked | `app/api/upload/route.ts` (DELETE) |
| Profile writes | A CV reference must be the caller's own object path (or a parseable legacy URL to it) | `normalizeOwnCvReference`, 4A-T1 tests |
| Watermark | Static `/brand/cxjobs-watermark.png`, not the `cv` bucket (but see B1: `public/` is untracked) | `lib/cv/watermark.ts` |

**Conclusion:** the application **can operate with a private `cv` bucket**, and no path depends on public access. Authorization always happens before a signed URL is minted, and the 60 s TTL is reasonable.

**Residual exposure while the bucket is public:**
- Object paths are returned to the owning company (application lists, export, company dashboard), and legacy rows may hold full public URLs. **If the bucket is public, every one of those is a permanent, unauthenticated CV link** that no code can revoke.
- The paths are unguessable (UUID-based), but they leak through exports, logs and browser history.

**Conflicting evidence:** `docs/security/PRODUCTION_READINESS.md` §2 says "verified in the connected **cxjobs-test** project: `cv` bucket `public = false`". This conflicts with the statement that no test project exists, and it would say nothing about production anyway. Not relied on here.

**Required action**
1. Read-only SQL §8.3 in the production project (approval and credentials).
2. If `public = true` or a `cv` policy exists for `anon`/`authenticated`: make the bucket private and drop those policies. **This is a production change requiring explicit approval.** It is safe for the code, and legacy rows keep working because the app re-derives the object path.
3. Re-run 8.3 and request `…/storage/v1/object/public/cv/<a known path>`. Expect 400/404.

**Verification criteria:** `public = false`; RLS on; zero `cv` policies for anon/authenticated; the public object URL is refused; the authorized route returns 302 and the signed URL expires after about 60 s.

### B4: Duplicate email integrity. **OPEN** (no new duplicates in code; existing data NOT VERIFIED)

**Code (every path re-checked)**

| Path | Case handling | Evidence |
|---|---|---|
| Registration | `emailSchema` trims and lowercases; `emailIsTaken` checks every variant (strict re-check) | `lib/validations/auth.ts:8`; `app/api/auth/register/route.ts` |
| Credentials login | Normalized; `findUserByEmail`: exact match first, then case-insensitive with strict re-check; **ambiguous → null** | `lib/auth.ts`; `lib/server/user-email.ts` |
| Password reset / verify resend | Same `findUserByEmail` | `lib/server/account-emails.ts:22,43,60` |
| Google OAuth | Adapter `getUserByEmail` sees every variant (including ambiguous ones) → `OAuthAccountNotLinked`, never a link; new users stored lowercase as CANDIDATE, unverified | `lib/server/auth-adapter.ts`; 14 tests |
| Invitation create / accept | Normalized, `emailIsTaken` | `app/api/admin/tokens/route.ts`; register |
| Admin email change | Normalized; `findFirst` with `mode: insensitive`, no strict re-check (false-positive 409 only) | `app/api/admin/users/[id]/route.ts:131-146` |
| Company profile `emailCompany` | Normalized; **exact** match against `users.email` (misses legacy variants; `emailCompany` isn't a login identity) | `app/api/profile/route.ts:779-797` (N9, P3) |
| DB constraint | `users.email String @unique`, a **case-sensitive** unique index; no `lower(email)` index | `prisma/schema.prisma:13` |

**Can mixed-case duplicates still exist?**
- **New ones:** no, through any application path.
- **Old ones:** yes. Rows created before NF-06, and any Google duplicates created by the pre-4A adapter, remain. The DB constraint doesn't prevent them.

**Impact of existing duplicates** (derived from the code):
- **Two variants, neither exactly lowercase:** `findUserByEmail` returns null, so password login fails, no reset email is sent, and Google returns `OAuthAccountNotLinked`. **The person is locked out.**
- **One lowercase row plus a mixed-case row:** the lowercase row always wins, and **the mixed-case row (its applications, company, CV) is unreachable** by login or reset.
- **A Google-created lowercase duplicate of a legacy mixed-case credentials account** (possible before Phase 4A): Google signs into the duplicate; password login also resolves to the duplicate, which has no password, so it fails. The original account is unreachable.

**Required action:** read-only SQL §8.4 (counts first, then the listing only if non-zero). Resolve each group manually with the owner; **never auto-merge**. Afterwards (code plus migration, a separate phase): lowercase `users.email`, then a unique index on `lower(email)`. This also removes the fallback scan (P2).

**Verification criteria:** 8.4 returns 0 duplicate groups (or every group has a documented resolution) before go-live; after the migration, the unique `lower(email)` index exists.

### B5: External integrations. **OPEN, NOT VERIFIED externally**

| Integration | Implemented in code | Locally verified (fakes) | Needs a safe external test |
|---|---|---|---|
| **Upstash Redis** | Rate limits: one atomic Lua `EVAL` (fixed window plus TTL repair), 1.5 s store timeout. **Fail-closed by default**; **fail-open** only for public reads and telemetry (`job-offers` list and detail, `by-slug`, views and view dedupe, `web-vitals`). Revocation: monotonic Lua publish; per-request GET with a 300 ms timeout and a null fallback; DB re-read at most every 15 minutes. Production startup throws if Upstash isn't configured (`lib/redis.ts`). | `redis-upstash.test.ts` (10, local REST fake), `rate-limit.test.ts` (10), `session-revocation.test.ts` (18), revocation integration tests | Lua inside real Upstash (`EVAL` allowed on the plan); limit enforcement; immediate revocation; outage behaviour (auth/AI/scrape closed, catalogue open) |
| **Email (Resend)** | `EMAIL_PROVIDER` (default **`disabled`**); 8 s timeout; **no retry**; send never throws; runs after the response; status-only error logs; token in the URL fragment; links only from `APP_URL`. **Invitations are not emailed** (the admin copies the link). | `email.test.ts` (9), auth-flow tests | Real delivery of verification, reset and "account exists" mail; SPF/DKIM; link host. The **local `.env` has no `EMAIL_PROVIDER`/`APP_URL`/`RESEND_*`**. If Vercel production matches, no mail is sent, and **password reset can't work** (users still see a success message) |
| **Google OAuth** | `email_verified === true` required; existing accounts never linked (`OAuthAccountNotLinked`); new users are CANDIDATE, unverified, lowercase; verification trusted only for the same address; already-linked accounts resolve by provider id | 14 tests through the real Auth.js `handleLoginOrRegister` + PrismaAdapter; auth-callbacks (19) | The real redirect/callback round trip, redirect-URI configuration per environment, a verified and an unverified test account, the login-page error message |
| **PDF parsing** | pdfjs-dist v6 in a `worker_thread`: 10 s timeout, 256 MB heap cap, 30 pages, 200k characters; `serverExternalPackages` plus `outputFileTracingIncludes` for the worker files | `cv-parser.test.ts` (9): valid, multi-page, page bound, malformed, hang, crash, allocation bomb | Worker threads and the traced `.mjs` on the Vercel Node runtime; memory under the plan's function size; a 30+ page and a malformed PDF on a Preview |
| **OpenAI** | 20 s per attempt, 1 retry, caller `AbortSignal`, generic `AIServiceError`, 504 on timeout. Route budgets: generate-with-ai 45 s, scrape 22 s (fetch plus AI), **cv-parse has no route-level deadline** (PDF ≤ 10 s plus AI ≤ about 41 s) | `ai-timeout.test.ts` (6, real SDK against a local server) | Real latency and error mapping; key scoping per environment |
| **Vercel** | Node runtime (no `runtime` exports, no `vercel.json`); **no `maxDuration` anywhere**; **no Node version pin** (`engines`/`.nvmrc` absent; CI uses 22); env validation at startup (`instrumentation.ts`, names only) | Build passes isolated | Plan and Fluid defaults vs the 22/45/≈51 s budgets; Node version setting; Preview vs Production env separation (DB, Redis, Supabase, Google, Resend, `INVITATION_TOKEN_ENCRYPTION_KEY`); worker thread and `sharp` on the runtime |

**Required action:** the staging plan in `PRODUCTION-READINESS-AUDIT.md` §7, on an isolated Preview with **separate** non-production credentials.
- **No such environment exists today.** Creating one (a second Supabase project or branch, a second Upstash database, a Resend test domain, a Google OAuth test client) is a prerequisite and needs user approval.
- Without it, B5 can only be verified in production, which this audit does not recommend.

---

## 4. Code-level and operational risks (Task C)

Severity: **P0** exploitable or data-loss · **P1** blocks a safe launch · **P2** important reliability or maintainability · **P3** optional.

### New findings in this audit

| ID | Sev | Finding | Evidence | Required action |
|---|---|---|---|---|
| **N1** | **P0 if present in production** (P1 otherwise) | **Shared hard-coded password for 105 seeded test accounts.** The tracked `prisma/seed.ts` (the configured Prisma seed, `prisma.config.ts` `seed: tsx ./prisma/seed.ts`) creates 100 CANDIDATE users `user1..100@gmail.com` and 5 COMPANY users `company1..5@cxjobs.test`. All are `isActive`, `isOnboarded` and email-verified, and all share one plaintext password (`prisma/seed.ts:78`). It also creates 12 **PUBLISHED** test jobs. The same password (identical SHA-256) is the default in the tracked `tests/k6/generate-candidate-sessions.js:9` and the ignored `generate-company-sessions.js:10`. **Indications that it ran against production:** before Phase 3 the k6 scripts defaulted to the production URL (H2); local k6 session-cookie files (Sep–Oct 2026) and a 157 MB `results.json` exist. If the accounts exist, anyone who knows the password (the repo, any clone, CI logs) can sign in as 5 companies, post or alter jobs and read applicants' data. Also, `user*@gmail.com` are real third-party Gmail addresses, and the seed's `updateMany` (`:240-248`) **overwrites `role` and `passwordHash` of any real user at those addresses** every time it runs. | `prisma/seed.ts:9-19,78,214-248`; k6 generators; local artefacts (metadata only) | (1) Read-only SQL §8.5. (2) If found: with approval, deactivate the accounts (`isActive=false` and `sessionVersion+1`) or delete them, and unpublish or delete the `k6-test-*` jobs and companies. (3) Remove the hard-coded password from the repo (env var with no default); add a "refuse unless the target is local or staging" guard to the seed; consider that the password is burned. (4) Never run the seed with this `.env`. |
| **N2** | **P1** (operational) | **The local Prisma CLI points at the Supabase database (assumed production).** With this checkout, `npm run db:migrate` (`migrate dev`, which offers a **reset** on drift), `npm run db:push`, `prisma db seed` and `migrate reset` would change production. Drift is plausible (B2). | `.env` classification (§3 B2); `prisma.config.ts:12`; `package.json` `db:migrate`, `db:push` | Move production credentials out of the default `.env` (use a separate, explicitly loaded file only for `migrate deploy`). Use only `migrate deploy` / `migrate status` against production. Consider removing `db:push` from `package.json`. |
| **N3** | **P1** (part of B1) | `public/` is entirely untracked, so the CV-export watermark would 404 after a Git deploy. Same for `instrumentation.ts`, without which startup env validation would silently not run. | `git ls-tree HEAD public/` → 0 files | Include them in the B1 commit. |
| **N4** | **P2** | **Invitation tokens issued before Phase 3** were delivered as `/onboarding/company?token=…`, so they may sit in Vercel request logs and browser history. If still PENDING and unexpired (TTL up to 90 days), they are usable, and the client deliberately still accepts legacy `?token=` links. | Phase 3 H3; `components/auth/company-invitation.tsx` (legacy support); schema `company_invitations` | Read-only count §8.6. With approval, revoke and re-issue every PENDING invitation created before the deploy (admin UI "revoke" + "create"). Optionally drop legacy `?token=` support after that. |
| **N5** | **P2** | **AI/PDF route budgets vs function limits:** no `maxDuration` is exported anywhere. If the project runs without Fluid compute on default limits (10 s Hobby / 15 s Pro), scrape (22 s), generate (45 s) and cv-parse (≈51 s, no route deadline) are killed by the platform with an unhandled 504 instead of the app's generic error. | `grep maxDuration` → none; no `vercel.json` | Check the Vercel plan and Fluid setting. Export `maxDuration` (≥ 60) on the three routes; give cv-parse a route deadline like the others. |
| **N6** | **P2** | No Node version pin (`engines`/`.nvmrc`); CI uses 22, local 24, Vercel uses the project setting. | `package.json`; `ci.yml:45` | Set Vercel Node 22.x and add `"engines": {"node": "22.x"}`. |
| **N7** | **P2** | Local sensitive leftovers (gitignored, never commit): `.k6-*cookies.txt` (session cookies, Sep–Oct; past the 30-day max age, so expired), `results.json` (157 MB k6 output; may contain production response data), `tmp-idor-*`. | `git status --ignored` (contents not opened) | Delete locally once no longer needed (user action). |
| **N8** | **P2** | Documentation conflict: `docs/security/PRODUCTION_READINESS.md` §2 claims a verification in a "cxjobs-test" project, which contradicts "no test project exists". | that file, §2 | Confirm which Supabase projects exist; correct the doc. |
| **N9** | P3 | `/api/profile` checks `emailCompany` against users with an **exact** match (the same gap fixed for invitations in 4A, F5). | `app/api/profile/route.ts:782` | Use `emailIsTaken`. |
| **N10** | P3 | Two `add_multiple_shift_types` migrations 12 s apart (pre-existing). Consistent on replay. | §3 B2 | None; be aware when reading history. |

### Previously reported concerns, re-checked

| Concern | Sev | Status | Evidence / action |
|---|---|---|---|
| 4 partially tested routes (`admin/overview`, `dashboard/company/analytics`, `health`, `auth/[...nextauth]` Google leg) | P2 | Unchanged. Auth, role and leakage tested; raw SQL, analytics and the real OAuth leg not | Staging (B5) or a Postgres-backed test DB |
| `PUT /api/dashboard/company` | P2 | **Still unused** (no client caller). URL schemes fixed in 4A. Still: replaces **all** benefits when sent (cascades job↔benefit links), `linkedinUrl` unvalidated, non-JSON → 500, JWT role only | Remove it (`POST /api/profile` is the supported path) |
| Google OAuth with existing duplicates | P1 (via B4) | Code: never links and never creates another duplicate. Data: see the B4 impact analysis | B4 SQL + manual resolution |
| Company onboarding redirect | P2 | FIXED IN CODE, VERIFIED LOCALLY (15 tests, real layouts, loop detection). **Not verified in a browser** | Staging smoke test: not-onboarded COMPANY → profile → save → dashboard |
| Unbounded text lengths | P2 | Unchanged. E.g. job `description` and the `requirements` arrays (`lib/validations/job.ts:39,51,101,113`); 41 `z.string()` vs 4 `.max()` in `profile.ts`. Bounded only by the platform request size (about 4.5 MB) | Add `.max()` to free-text fields and arrays |
| Zod strips instead of rejecting unknown keys | P3 | Unchanged (0 `.strict()` in `lib/validations/*`; only web-vitals). Safe for mass assignment (fields mapped explicitly; tests confirm) | Optional `.strict()` on write schemas |
| Case-insensitive email fallback scans | P2 | Unchanged. Every lookup miss (each new registration, unknown-email login) runs `ILIKE` on `users` without a usable index | `lower(email)` migration (B4 follow-up) |
| Per-request revocation Redis GET | P2 | Unchanged by design. ≤ 300 ms per authenticated request; one Upstash command per request | Watch latency and the command budget on staging; could cache per instance for a few seconds |
| `web-vitals` rate limiting | — | **FIXED IN CODE, VERIFIED LOCALLY** (4A): 60/min per IP, fail-open, strict schema | — |
| AI duration vs `maxDuration` | P2 | See N5 | — |
| Scrape timeout | — | 22 s route deadline bounds fetch **and** AI; SSRF guard, 3 redirects, 443 only, 100 KB | Covered by tests; real-site behaviour unverified |
| Old invitation tokens in logs | P2 | See N4 | — |
| Trigram index write lock | P2 | See B2 locking; size check §8.2 | — |
| Routes that trust the JWT role claim | P3 | Roles are immutable through the API; suspension revokes sessions (immediately with Redis, ≤ 15 minutes without) | Optional DB re-read |
| Issues introduced by Phases 1–4A | — | **None found.** Phase 4A behaviour change: inactive users with a still-valid JWT are sent to `/login` by the dashboard shell (intended) | — |

---

## 5. External verification gaps (summary)

Not verifiable without infrastructure or credentials:
- **Production database:** migration state and drift (B2), the duplicate-email data (B4), the seeded test accounts (N1), pending pre-fix invitations (N4), table sizes for the lock window.
- **Supabase Storage:** `cv` bucket flag, RLS and policies (B3).
- **Upstash:** Lua `EVAL`, limits, revocation, outage behaviour.
- **Resend:** whether it's configured at all in production, plus delivery and DNS.
- **Google:** the OAuth round trip and redirect URIs per environment.
- **Vercel:** plan and Fluid duration limits, Node version, Preview/Production env separation, worker thread and `sharp` at runtime, log retention (N4).
- **Browser:** the onboarding redirect flow, error pages, filters.

---

## 6. What is fixed (re-verified from code in this phase)

| Area | Status |
|---|---|
| Phase 1–2 security fixes (IDOR, mass assignment, CV access, sessions, tokens, SSRF, upload validation, headers) | FIXED IN CODE, VERIFIED LOCALLY (409 tests) |
| H1 trigram indexes | FIXED IN CODE. NOT applied to any DB |
| H2 k6 production defaults | FIXED IN CODE (tracked and ignored scripts both use the guard) |
| H3 invitation token in the query string | FIXED IN CODE (legacy links still accepted, see N4) |
| H4 AI timeouts | FIXED IN CODE, VERIFIED LOCALLY (real SDK against a local server) |
| H5 route coverage | FIXED: 41/41 loaded by tests (37 full, 4 partial) |
| H6 perf-ci secrets | FIXED IN CODE (workflows never ran on GitHub) |
| H7 env validation | FIXED IN CODE |
| H8 Google case-variant duplicates | Code side FIXED, VERIFIED LOCALLY. Data side open (B4) |
| Company onboarding loop | FIXED IN CODE, VERIFIED LOCALLY. Browser not verified |

---

## 7. Final production release plan (Task E)

Every step lists its risk, evidence, action, whether production access is needed, dependencies, verification criteria and whether explicit approval is required.

### 7.1 Work that can be completed locally (no production access)

| # | Item | Risk addressed | Action | Depends on | Verification | Approval |
|---|---|---|---|---|---|---|
| L1 | N1 code part | Burned shared password; seed hazard | Remove the hard-coded password from `prisma/seed.ts` and both k6 generators (env var, no default); add a local/staging-only target guard to the seed | — | grep finds no literal password; the seed refuses a non-local URL | Yes (code change; out of scope for this audit) |
| L2 | N2 | Accidental production migrate/reset/seed | Move production credentials out of the default `.env`; document "`migrate deploy` only"; consider removing `db:push` | — | `prisma migrate status` with the default env does **not** reach Supabase | Yes (local config) |
| L3 | N5, N6 | Platform timeouts; Node drift | `maxDuration` on 3 routes, cv-parse deadline, `engines.node` | — | Build plus tests | Yes (code change) |
| L4 | Recommended P2 | Hardening | Remove `PUT /api/dashboard/company`; `.max()` on free text; N9 | — | Tests | Yes (code change) |
| L5 | N7 | Local leaks | Delete local k6 cookies, `results.json`, `tmp-idor-*` | — | Files gone | User's own action |
| L6 | **B1** | Ship none of the fixes | Commit everything (incl. `public/`, `instrumentation.ts`, migrations, `tests/`, `docs/`) on a branch; PR; CI green | L1–L4 if they're done first (optional) | CI green on GitHub; a clean clone builds | **Yes** |

### 7.2 Work requiring a safe external test environment (none exists today)

| # | Item | Action | Depends on | Verification | Approval |
|---|---|---|---|---|---|
| S0 | Create the environment | A second Supabase project or branch, a second Upstash DB, a Resend test domain, a Google OAuth test client, a Vercel Preview with environment-scoped secrets | — | No production credentials in Preview | **Yes** (new infrastructure, possible cost) |
| S1 | B2 on staging | `migrate deploy` on an empty DB or an anonymized snapshot; `migrate diff` against a shadow DB (expect empty); `EXPLAIN` the search | S0, L6 | Up to date, 5 trigram indexes, no drift | Yes |
| S2 | B5 Redis | Audit §7.3 (limits, revocation, outage) | S0 | Revocation is immediate; fail-closed and fail-open as designed | Yes |
| S3 | B5 Email | Audit §7.4 | S0 | Mail arrives; `#token=` links; no tokens in logs | Yes |
| S4 | B5 Google | Verified and unverified test accounts; an existing-password account gets the "different sign-in method" message; a mixed-case legacy row | S0 | As in the Phase 4A tests | Yes |
| S5 | B5 PDF / AI / Vercel | Large, malformed and 30+ page PDFs; AI timeouts; confirm duration limits | S0, L3 | Bounded latency, generic errors, no function crash | Yes |
| S6 | Browser plan | Audit §6, including the company onboarding redirect | S0 | All rows pass | Yes |

If S0 is refused, the alternative is a **production-only verification**, with the risk that entails. That needs explicit acceptance of the risk, and the read-only steps (7.3) must be done first.

### 7.3 Work requiring read-only production verification (credentials and approval; nothing modified)

| # | Item | SQL / step (§8) | Verification criteria | Approval |
|---|---|---|---|---|
| R1 | N1 test accounts and jobs | §8.5 | 0 rows, or a list to remediate in P2 | **Yes** |
| R2 | B3 bucket | §8.3 | `public=false`, RLS on, no `cv` policies | **Yes** |
| R3 | B4 duplicates | §8.4 | 0 groups, or a resolution list | **Yes** |
| R4 | B2 state | `npx prisma migrate status` (with a *deliberately loaded* production direct URL); §8.2 | Only the two new migrations pending; table sizes known | **Yes** |
| R5 | N4 invitations | §8.6 | Count of PENDING invitations created before the deploy | **Yes** |
| R6 | Vercel config | Dashboard: plan and Fluid, Node version, per-environment env vars (`EMAIL_PROVIDER`, `APP_URL`, `RESEND_*`, `REQUIRE_EMAIL_VERIFICATION=false`), Google redirect URIs | All required variables present per `lib/env.ts`; Preview isolated | **Yes** |

### 7.4 Work requiring production changes (explicit approval for each)

| # | Change | Depends on | Verification | Rollback |
|---|---|---|---|---|
| P1 | Deactivate or delete the seeded test accounts and `k6-test-*` jobs and companies (N1) | R1 | §8.5 returns 0 active rows | Re-activate (if deactivated) |
| P2 | Make the `cv` bucket private / drop `cv` policies (B3) | R2 | §8.3 plus the public-URL probe refused | Re-enable (not recommended) |
| P3 | Resolve duplicate-email groups with the owners (B4) | R3 | §8.4 = 0 | Per case |
| P4 | `npx prisma migrate deploy` (B2), in a quiet window; optionally create the trigram indexes `CONCURRENTLY` by hand first | R4, L6 | Column and indexes present; `migrate status` clean | Code rollback is safe; **never drop `sessionVersion`** while new code runs |
| P5 | Revoke and re-issue pre-fix PENDING invitations (N4) | R5, deploy | Old links refused | Re-issue |
| P6 | Set the missing Vercel production env vars (email provider, `APP_URL`) | R6 | Startup validation shows no warnings | Revert the vars |

### 7.5 Deployment and post-deployment checks

1. All of 7.1 L6, 7.3 and 7.4 P1–P4 and P6 are complete (and 7.2, if the environment was approved).
2. Order: **P4 migrate → deploy the commit from L6 → P5**.
3. Smoke tests (audit §7.8):
   - `GET /api/health` → healthy.
   - Anonymous `/jobs` and a job page.
   - Candidate and company login, one apply, one status change.
   - Admin dashboard.
   - `curl -I` shows XFO/CSP/HSTS.
   - The public CV URL is refused.
   - A not-onboarded test COMPANY lands on its profile page.
   - Password-reset mail arrives (if the provider is configured).
4. Watch the logs for 30 minutes: auth errors, Prisma `sessionVersion` errors, rate-limiter "backend error", 504s on the AI routes.
5. Rollback: Vercel Instant Rollback of code only. Leave the migrations in place.

---

## 8. Read-only SQL (NOT EXECUTED)

> **NOT EXECUTED.** Every statement is a `SELECT`. Run only with explicit approval, ideally as a read-only role, in the Supabase SQL editor of the intended project. Some queries return email addresses (personal data): run the count variants first.

### 8.1 Safety preamble
```sql
-- Make the session read-only so nothing below can change data, even by mistake.
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
```

### 8.2 Migration state and lock-window sizing (B2)
```sql
-- NOT EXECUTED
select migration_name, finished_at, rolled_back_at
from "_prisma_migrations" order by started_at desc limit 10;

select column_name, data_type, column_default
from information_schema.columns
where table_name = 'users' and column_name = 'sessionVersion';   -- expect 0 rows before P4

select indexname from pg_indexes
where tablename in ('job_offers','companies') and indexname like '%trgm%';

select extname from pg_extension where extname = 'pg_trgm';

select relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) as total_size
from pg_stat_user_tables where relname in ('job_offers','companies','users');
```

### 8.3 CV bucket privacy (B3)
See `docs/security/PRODUCTION_READINESS.md` §2 for the full set. Minimum:
```sql
-- NOT EXECUTED
select id, public from storage.buckets where id = 'cv';                    -- expect public = false
select relrowsecurity from pg_class where oid = 'storage.objects'::regclass; -- expect true
select policyname, roles, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and (coalesce(qual,'') ilike '%''cv''%' or coalesce(with_check,'') ilike '%''cv''%' or qual is null);
                                                                            -- expect 0 rows
```

### 8.4 Duplicate and mixed-case emails (B4)
```sql
-- NOT EXECUTED: counts only (no personal data)
select count(*) as duplicate_groups, coalesce(sum(n),0) as rows_in_groups
from (select lower(btrim(email)) k, count(*) n from users group by 1 having count(*) > 1) d;

select count(*) filter (where email <> lower(email))  as mixed_case_rows,
       count(*) filter (where email <> btrim(email))  as whitespace_rows
from users;

-- Google-created rows that duplicate another account (possible before Phase 4A)
select count(distinct u.id) as google_duplicates
from users u
join accounts a on a."userId" = u.id and a.provider = 'google'
where exists (select 1 from users v where v.id <> u.id and lower(btrim(v.email)) = lower(btrim(u.email)));

-- NOT EXECUTED: listing, only if the counts above are non-zero (returns emails)
select lower(btrim(email)) as email_key, count(*) as n,
       array_agg(id order by "createdAt") as user_ids,
       array_agg(role::text order by "createdAt") as roles,
       array_agg(("passwordHash" is not null) order by "createdAt") as has_password
from users group by 1 having count(*) > 1 order by n desc;
```

### 8.5 Seeded k6 test data (N1)
```sql
-- NOT EXECUTED
select role, count(*) as n, count(*) filter (where "isActive") as active,
       min("createdAt") as first_created, max("createdAt") as last_created
from users
where email ~ '^user([1-9]|[1-9][0-9]|100)@gmail\.com$'
   or email ~ '^company[1-5]@cxjobs\.test$'
group by role;

select status, count(*) from job_offers where slug like 'k6-test-job-%' group by status;
select count(*) from companies where slug like 'k6-test-company-%';
-- Note: a user1..100@gmail.com row MAY be a real person; check "createdAt"
-- against the seed run dates before touching anything.
```

### 8.6 Invitations issued before the fragment-link fix (N4)
```sql
-- NOT EXECUTED: replace <deploy-date> with the Phase 3 deploy timestamp
select count(*) as usable_legacy_invitations
from company_invitations
where status = 'PENDING' and "revokedAt" is null and "usedAt" is null
  and "expiresAt" > now() and "createdAt" < '<deploy-date>';
```

---

## 9. Confirmation

During this phase:
- **No commit, push, deployment, migration, schema change or data change was made.**
- **No branch change, stash, reset or discard.** All 123 working-tree entries are preserved; `git status` and the diff hash were identical before and after the local checks.
- **No connection** to the production database, Supabase Storage, Upstash, Resend, Google, OpenAI or Vercel. No SQL was executed; the Supabase and Vercel tools available in this session were not used.
- **No dependency installed, upgraded or removed; no application code, test or configuration changed.**
- Files written: `docs/PHASE-4B-AUDIT.md` (new) and `docs/PRODUCTION-READINESS-AUDIT.md` (status update).

# Phase 3: Production-readiness remediation

Companion to `docs/PRODUCTION-READINESS-AUDIT.md` (findings H1–H7) and `docs/PHASE-2-CHANGES.md`.

**Everything is uncommitted working-tree change.** Throughout this phase there was no commit, push, deploy or migration, no k6 run, and no contact with any production database, storage, Redis, email or OAuth service. All builds, tests and server runs used unroutable placeholders (`127.0.0.1:9`), with every `.env` key overridden so no real value could load.

## Verification

| Check | Before Phase 3 | After Phase 3 |
|---|---|---|
| TypeScript (`tsc --noEmit --incremental false`) | 0 errors | **0 errors** |
| ESLint (`--max-warnings=35` ratchet) | 0 errors / 35 warnings | **0 errors / 35 warnings** (no new warnings) |
| Security tests | 154/154 | **189/189** |
| Integration tests | 121/121 | **132/132** |
| Total tests | 275 | **321** (+46) |
| API routes with tests | 19/40 | 22/41 |
| `next build` (isolated) | Pass, no DB access, 62 pages | **Pass, no DB access, 63 pages**; no env-validation output (build phase skipped as designed) |
| `next start` smoke (perf-ci config) | not run | **Boots.** `/login`, `/register`, `/jobs`, `/about`, `/terms`, `/onboarding/company` return 200 with `X-Frame-Options: DENY` and the page CSP. With a required variable missing, startup fails with a named error and no value. |
| `npm audit --omit=dev` | 2 moderate / 0 high / 0 critical | **unchanged** (no dependency changes in this phase) |
| `npm audit` (all) | 25 (13 high, dev tooling) | **unchanged** |
| Phase 1 and 2 fix invariants (19 grep checks) | — | **all intact** |

---

## 1. Missing database search indexes (H1)

**Investigation.**
- `20260602135300_add_performance_indexes_and_trgm` created `idx_job_offers_title_trgm` and `idx_job_offers_description_trgm`.
- `20260915154208_gender_fix` dropped both.
- `idx_job_offers_description_trgm` was re-created by `20260928140000` and `20260928184500`, then dropped by `20260928181412_add_job_offer_closed_at` and finally by `20261001163809_fix_error_gender`.
- **The final migration state had no trigram index.**

**Root cause.** The indexes were never declared in `schema.prisma`. Every `prisma migrate dev` therefore treated them as drift and generated `DROP INDEX`. Adding another migration alone would have been undone by the next `migrate dev`.

**Indexes required by the current code.** These columns are searched with `contains` + `mode: "insensitive"`, which compiles to `ILIKE '%…%'` and is unservable by B-tree:
- `job_offers.title`, `job_offers.description`, `job_offers.customLocation`
- `companies.name`, `companies.location`

They come from `lib/job-offers-utils.ts` and, for `description`, `app/api/dashboard/candidate/route.ts`. Admin and company-scoped searches run over small or `companyId`-filtered sets and were left as they are.

**Solution.**
- `prisma/schema.prisma` declares the five indexes with `type: Gin, ops: raw("gin_trgm_ops")` and `map:` names matching the historical names. Future `migrate dev` runs now see them as intended.
- A new forward-only migration, `prisma/migrations/20261109130000_restore_trigram_search_indexes/migration.sql`, contains `CREATE EXTENSION IF NOT EXISTS pg_trgm` plus five `CREATE INDEX IF NOT EXISTS … USING GIN (… gin_trgm_ops)`.
- The definitions are exactly the SQL `prisma migrate diff --from-schema <old> --to-schema <new> --script` emits for the declarations. That diff was computed **offline**: Prisma 7's schema engine needs a datasource URL even for schema-to-schema diffs, and an unroutable placeholder was supplied.
- The migration is additive only (no DROP/ALTER/UPDATE). No earlier migration was edited.

**Tests: `tests/security/migrations.test.ts` (4).**
1. Replays every `CREATE`/`DROP INDEX` across all migrations in order and asserts the five indexes exist at the end.
2. Asserts the exact restore SQL and its idempotency guards, and that it sorts after the `sessionVersion` migration.
3. Asserts the schema declarations.
4. Asserts that every index named in the schema survives the migration history.

Negative control: with the new migration removed, 3 of 4 fail.

**Limitations and actions.**
- **NOT VERIFIED against a database.** Apply on staging first.
- Plain `CREATE INDEX` takes a write-blocking lock while each index builds (seconds at current sizes). `CONCURRENTLY` can't be used inside a Prisma migration script. For a large table, create the indexes concurrently by hand beforehand; `IF NOT EXISTS` then makes the migration a no-op.
- On Supabase, confirm `pg_trgm` is available. Earlier migrations already used it.

## 2. Invitation token security (H3)

**Investigation.** Tokens are 256-bit, SHA-256 hashed for lookup and AES-encrypted for admin "copy link", and consumed atomically in `POST /api/auth/register`. But the links were `/onboarding/company?token=…` (`app/api/admin/tokens/route.ts`, `[id]/link/route.ts`), and the server page validated `searchParams.token`. So the bearer secret reached access logs and browser history while still valid.

**Solution.**
- `lib/security/invitation-link.ts`: `buildInvitationLink()` produces `/onboarding/company#token=…` (fragment, empty query). Both admin routes use it, and their responses now send `Cache-Control: no-store`.
- New `POST /api/auth/invitation` (`app/api/auth/invitation/route.ts`):
  - The token is accepted **only in the JSON body**, format-checked (64 hex), and rate-limited per IP (20/min, fail-closed).
  - It returns only `companyName`, `managerName` and `managerEmail`.
  - It does **not** consume the invitation; consumption stays atomic in register.
  - It never logs the token, and responses are `no-store`.
- `app/onboarding/company/page.tsx` no longer reads, validates or renders the token server-side. Signed-in users go to `/dashboard`.
- `components/auth/company-invitation.tsx` reuses `ClientTokenGate` (now exported from `components/auth/token-flow-forms.tsx`). It reads the token once (fragment, or a **legacy `?token=`** link so already-issued links keep working), scrubs it from the address bar and history, validates it via POST, and passes it in memory to `SignupForm`. `SignupForm` already sends it in the register POST body.
- Expiration, revocation, single use and status checks are unchanged (`lib/server/invitation-validation.ts`, `consumeInvitation`).

**Tests.**
- `tests/integration/invitations.routes.test.ts` (8): fragment-only links from both admin routes with `no-store`; only the hash is stored; POST validation returns display fields only and doesn't consume; malformed and unknown tokens get a generic 400; the full flow (validate → register as COMPANY → reuse refused by validation **and** register); expired and revoked refused; per-IP rate limit; **the raw token never appears in any log line** across create, copy, validate, register and reuse.
- `tests/security/invitation-link.test.ts` (4): builder output, client extract/scrub round trip, legacy query links, non-token fragments ignored.
- Test fake: `companyInvitation` model added (`tests/integration/fake-prisma.ts`).

**Limitations.**
- Links issued before this change still contain `?token=`. They keep working (and are scrubbed client-side), but they already passed through logs once. Consider revoking and re-issuing outstanding invitations (admin → Tokens).
- A COMPANY user with `isOnboarded=false` still loops between `/onboarding/company` and the dashboard layout. This is pre-existing (old code redirected to `/dashboard/company/profile` with the same effect) and unreachable through invitation registration, which sets `isOnboarded=true`.

## 3. OpenAI request timeouts (H4)

**Investigation.** `new OpenAI({ apiKey })` used SDK defaults: a 10-minute timeout and 2 retries. The scrape route's 22-second deadline covered only the page fetch. The three calls (`generateJobDescription`, `parseCVWithAI`, `extractJobFromUrlText`) logged the raw provider error object.

**Solution.**
- `lib/ai-service.ts`:
  - `createOpenAIClient()` with `AI_REQUEST_TIMEOUT_MS = 20_000` and `AI_MAX_RETRIES = 1` (the SDK retries only connection errors, 408/409/429 and 5xx).
  - Every call accepts an optional `AbortSignal`, forwarded to the SDK; abort cancels the attempt **and** any retry.
  - Failures are classified into `AIServiceError` (`timeout` / `unavailable` / `invalid_response`) with fixed, generic messages. Messages are unchanged, so existing route checks still match.
  - Logs carry only the error class name, HTTP status and error code.
  - A missing key now raises a generic `AIServiceError` instead of an env-naming `Error`.
  - `__setOpenAIClientForTests` is the test hook.
- `lib/ai-errors.ts`: the error type, dependency-free so routes can classify failures even when the AI module is mocked.
- `app/api/job-offers/generate-with-ai/route.ts`: `AbortSignal.any([request.signal, AbortSignal.timeout(45_000)])`; a timeout returns **504 `AI_TIMEOUT`** with a generic message; logs show name and kind only.
- `app/api/job-offers/scrape-from-url/route.ts`: the route's own deadline signal now also bounds the AI call; an AI timeout maps to the existing 504 `TIMEOUT`.
- `lib/cv-parser.ts`: 25-second deadline on the AI step, falling back to basic parsing on timeout; the warning log shows name and kind only.

**Tests.**
- `tests/security/ai-timeout.test.ts` (6) drives the **real SDK** through an injected fetch:
  - client defaults asserted;
  - a never-answering provider yields `AIServiceError(timeout)` fast;
  - a caller deadline aborts with **no retry** even with a 60-second per-attempt timeout;
  - exactly one retry on 500, and the provider error body never reaches the caller or the logs;
  - non-JSON output becomes `invalid_response`;
  - a missing key gives a generic error.
- `tests/integration/admin-ai-scrape-cv.routes.test.ts` (+3): generate timeout → 504 with a signal passed; other failures → fixed 500; cv-parse falls back on AI timeout.

**Limitations.**
- Real OpenAI latency and timeouts are **NOT VERIFIED** (no external calls).
- The scrape route's AI-timeout mapping is covered by unit tests only; its happy path needs a real page fetch.
- Vercel `maxDuration` is not set explicitly. The worst case of about 45 seconds fits a 60-second limit; confirm the plan limit.

## 4. Environment validation (H7)

**Investigation.** `lib/env.ts` (`assertEnv`) was never imported: there was no `instrumentation.ts`, and no call anywhere. Its production list was also wrong for runtime. It required `DIRECT_DATABASE_URL` (migrations only), **both** `AUTH_SECRET` and `NEXTAUTH_SECRET`, and Google credentials (optional), while omitting the required `INVITATION_TOKEN_ENCRYPTION_KEY`. Wiring it as-is would have crashed correct deployments.

**Solution.**
- `lib/env.ts` rewritten as a pure `validateEnv(env, mode)` returning issues by **name only**.
- **Fatal in production:**
  - `DATABASE_URL` (must be a postgres URL);
  - `AUTH_SECRET` **or** `NEXTAUTH_SECRET`;
  - Upstash URL and token;
  - Supabase URL and service key;
  - `INVITATION_TOKEN_ENCRYPTION_KEY` (must be base64 of 32 bytes).
- **Warnings only:**
  - missing or non-https `APP_URL`/`NEXT_PUBLIC_APP_URL`;
  - email provider disabled, unsupported, or incomplete;
  - `REQUIRE_EMAIL_VERIFICATION=true` without email delivery;
  - only one of the two Google variables set;
  - missing `OPENAI_API_KEY`;
  - a short auth secret.
- Outside production nothing is fatal.
- `instrumentation.ts` calls `runStartupEnvValidation()` once per server process. It is **skipped** when `NEXT_PHASE === "phase-production-build"` (Next sets this in `next build`, verified in `node_modules/next/dist/build/index.js`) and on non-Node runtimes. Builds and CI with placeholders are unaffected.

**Tests: `tests/security/env-validation.test.ts` (9).**
- A complete production env passes cleanly.
- Each requirement is fatal when missing; either secret name suffices.
- Migration-only and optional variables are not required.
- Malformed key and URL are rejected; dangerous combinations warn.
- Development and test never fail.
- **No value ever appears** in results, logs or thrown messages.
- `register()` is skipped at build and on edge, and rejects (by name) at production server start.

Runtime check: `next start` with a missing Upstash token refused requests with `Environment validation failed: UPSTASH_REDIS_REST_TOKEN missing…` and no values.

**Limitation.** On Vercel a fatal misconfiguration makes every request fail with a 500 and a named log line. That's deliberate (fail fast), but it means a bad env var change takes the deployment down until it's fixed. Validate Preview first.

## 5. k6 production safety (H2)

**Investigation.**
- `production-authenticated-candidate.js` and `production-multi-user-candidates.js` (tracked) and `production-full-app.js` (gitignored, local) defaulted `BASE_URL` to `https://cxjobs-last-verision.vercel.app`.
- The README instructed testing production.
- The session generators had a `K6_ALLOW_PRODUCTION_SESSION_GENERATION` override.

**Solution.**
- `tests/k6/lib/target-guard.mjs` is shared by k6 (ES import), the Node generators (dynamic import), the workflow and the tests. The policy:
  - an explicit `K6_BASE_URL` is required;
  - production hosts are always refused, with **no override** (extendable via `K6_PRODUCTION_HOSTS`);
  - only local, `staging`/`preview`-labelled and Vercel `-git-` branch hosts are accepted, plus exact `K6_ALLOWED_HOSTS`.
- All five scripts now use the guard; the default URLs and the override are removed. Generators refuse before any request (verified by line order, and by running them with no target: exit 1). User-Agent labels say "staging".
- `tests/k6/README.md` is rewritten for staging only.
- The k6 workflow's guard step now runs the same module, before the k6 step.

**Tests: `tests/security/k6-target-guard.test.ts` (6).** Target mandatory; production refused even when allow-listed; accepted forms; unknown hosts refused (label match, not substring); malformed URLs refused; no script or README defaults to production or keeps an override, and every script uses the guard.

**Not executed:** k6 itself. Scripts were syntax-checked with `node --check` only. The script names keep their historical `production-*` prefix (renaming wasn't in scope; the README explains).

## 6. CI/CD security (H6)

**Investigation (`perf-ci.yml`).**
- It injected `secrets.DATABASE_URL`, Upstash, OpenAI and Supabase secrets into the build.
- Its `npm run start &` step had no env, so it couldn't boot, and it collided with Lighthouse CI's own `startServerCommand`.
- `lighthouserc.json` audited DB- and session-dependent pages, set `staticDistDir` (which conflicts with `startServerCommand`), and **uploaded reports to public storage**.

**Solution.**
- `.github/workflows/perf-ci.yml`:
  - placeholder env only, and no service secrets;
  - `permissions: contents: read` and a concurrency group;
  - Node 22, `npm ci`, build, `npx lhci autorun` (one server, started by Lighthouse CI with the placeholder env), reports uploaded as an artifact;
  - `workflow_dispatch` added; no deploy step.
- `lighthouserc.json`:
  - audits DB-independent pages only (`/login`, `/register`, `/jobs`, `/about`, `/terms`) on localhost;
  - `startServerReadyPattern: "Ready"`;
  - `staticDistDir` removed;
  - upload target is `filesystem` (`./.lighthouseci`), not public storage;
  - assertion thresholds unchanged.
- `.github/workflows/k6-load-test.yml`: the guard now uses `target-guard.mjs` (still manual-only).

**Tests: `tests/security/ci-workflows.test.ts` (6).** No workflow references DB, storage, Redis, AI, email, OAuth, auth or Vercel secrets. No workflow deploys or migrates. Service variables are `127.0.0.1:9` placeholders. perf-ci has no bare background start. Lighthouse is localhost-only with no public upload. k6 is manual-only, with the guard before k6. Negative control: the HEAD `perf-ci.yml` had 6 forbidden secret references and a bare start.

Runtime check: `next start` with exactly the perf-ci env booted and served all audited pages (200).

**Limitations.**
- No workflow has run on GitHub: everything is uncommitted, and `ci.yml` is untracked.
- Lighthouse scores and thresholds are **NOT VERIFIED**; the pages may not meet the 0.9 minimum scores.
- `LHCI_GITHUB_APP_TOKEN` is no longer passed, so Lighthouse CI won't post GitHub status checks. Re-add it only if wanted; it's a GitHub token, not a service secret.

---

## Files changed in Phase 3

| Change | Files |
|---|---|
| **Modified** | `prisma/schema.prisma`, `app/api/admin/tokens/route.ts`, `app/api/admin/tokens/[id]/link/route.ts`, `app/onboarding/company/page.tsx`, `components/auth/token-flow-forms.tsx` (one `export`), `lib/ai-service.ts`, `lib/cv-parser.ts`, `app/api/job-offers/generate-with-ai/route.ts`, `app/api/job-offers/scrape-from-url/route.ts`, `lib/env.ts`, `.github/workflows/perf-ci.yml`, `.github/workflows/k6-load-test.yml`, `lighthouserc.json`, `tests/k6/README.md`, `tests/k6/generate-candidate-sessions.js`, `tests/k6/production-authenticated-candidate.js`, `tests/k6/production-multi-user-candidates.js`, `tests/integration/harness.ts`, `tests/integration/fake-prisma.ts`, `tests/integration/admin-ai-scrape-cv.routes.test.ts` |
| **Modified, gitignored local files** (safety only; not part of any commit) | `tests/k6/generate-company-sessions.js`, `tests/k6/production-full-app.js` |
| **Added** | `prisma/migrations/20261109130000_restore_trigram_search_indexes/migration.sql`, `lib/security/invitation-link.ts`, `app/api/auth/invitation/route.ts`, `components/auth/company-invitation.tsx`, `lib/ai-errors.ts`, `instrumentation.ts`, `tests/k6/lib/target-guard.mjs`, `tests/security/{migrations,invitation-link,ai-timeout,env-validation,k6-target-guard,ci-workflows}.test.ts`, `tests/integration/invitations.routes.test.ts` |
| **Regenerated (gitignored)** | `app/generated/prisma` (offline `prisma generate`) |

## Infrastructure actions still required

1. **Commit** the working tree (B1), and let `ci.yml` and `perf-ci.yml` run on a PR.
2. **Staging DB:** `prisma migrate deploy` applies `20261109120000_add_user_session_version` **and** `20261109130000_restore_trigram_search_indexes`. Verify with `\di *trgm*` and the `sessionVersion` column check. Then production, **before** the code deploy (B2).
3. Supabase `cv` bucket privacy check (B3), and the case-variant duplicate email check (B4).
4. Revoke and re-issue invitations created before this change (their links contained `?token=`).
5. Set the production env so startup validation passes:
   - **fatal if missing or invalid:** `DATABASE_URL`, `AUTH_SECRET`, Upstash ×2, Supabase ×2, and `INVITATION_TOKEN_ENCRYPTION_KEY` (base64, 32 bytes);
   - **warnings only:** `APP_URL` (https), the email provider settings, Google ×2, `OPENAI_API_KEY`.
   - Validate on a Preview first.
6. Confirm the Vercel function duration limit is at least 60 s for the AI routes.
7. Run the staging plan (audit §7), including k6 **against staging only** (the scripts now enforce this).

# Release Gate 0: local environment and secret safety review

- **Date:** 11 Nov 2026.
- **Repository:** `hardening/production-readiness` @ `6e77684` (same as `origin`). Nothing staged, committed or pushed.
- **Method:** local, read-only inspection.
  - No database connection, no Prisma command and no network call.
  - No file was deleted, no credential changed, no token used or revoked.
  - Secret values were never printed. Values are shown only as a host class, a length, or a 4-character redacted prefix.
- **Initial verdict (review): FAIL.**
- **After the approved cleanup (§10): CONDITIONAL PASS.** The local environment is isolated and verified. Production secret rotation and the production data clean-up remain separately approved operations; see §10.8.

## 1. Summary

| # | Severity | Finding |
|---|---|---|
| G0-1 | **Critical** | The local `.env` holds **production** credentials: 3 Postgres URLs, the Supabase **service-role** key (bypasses all row-level security), the Supabase URL, an Upstash token, a Google OAuth secret and two session secrets. `next dev`, `next build`, every Prisma CLI command and the seeds load it automatically. |
| G0-2 | **Critical** | **The production session-signing secret is on this machine.** All 205 tokens in the k6 cookie files were issued under the `__Secure-` (HTTPS-only) cookie name with a key derived from the local `NEXTAUTH_SECRET`. The k6 scripts and `results.json` target the production host. Anyone with this `.env` can **forge a session for any account, including an admin**, if production still uses that secret. |
| G0-3 | High | 205 raw Auth.js session tokens are in 3 local files. They should have expired: issued 26 Sep and 5 Oct with a fixed 30-day lifetime. They are still sensitive. |
| G0-4 | High | The shared seed/test password is in **pushed** Git history (`origin/main` and `origin/hardening/production-readiness`) and in the local `tmp-idor-setup.ts`. |
| G0-5 | High | `.gitignore` does **not** ignore `.env.staging`, `.env.production`, `.env.development`, `.env.test` or `.env.k6`. The release plan asks people to create per-environment env files, and `git add -A` would commit them. |
| G0-6 | Medium | `prisma/seed-k6.ts`, `tests/k6/generate-company-sessions.js` and `tests/k6/production-full-app.js` are **gitignored and untracked**. This has two effects: (a) the N1 password removal in two of them would never be committed; (b) the tracked test `tests/security/launch-plan.test.ts` ("N1: no shared test password…") reads two of these files, so **it fails in CI**, where they don't exist. `package.json` `seed:perf` also points at the ignored file. |
| G0-7 | Info | The secret scan found **no** real `.env` secret value anywhere in the working tree or Git history (only the public Supabase URL, which is public by design). No `.env*` file was ever committed. |

## 2. Environment audit (A)

### 2.1 Files

| File | Exists | Tracked | Ignored | Contents (classified, no values) |
|---|---|---|---|---|
| `.env` | yes | no (never in history) | yes | **Production** (table below) |
| `.env.local` | no | — | yes | — |
| `.env.example` | yes | yes | no (`!.env.example`) | Placeholders only. DB URLs → `localhost`; secrets are `your-…` placeholders; the invitation key is the all-zero placeholder; the others are `false`, `disabled`, `30` |

### 2.2 Variables configured in `.env`

| Variable | Classification | Production? |
|---|---|---|
| `DATABASE_URL` | Supabase pooler, port 6543, `pgbouncer=true`, has a password | **Yes**: production project ref |
| `DIRECT_DATABASE_URL` | Supabase direct, port 5432, has a password | **Yes** |
| `DIRECT_URL` (legacy alias) | Supabase, port 5432, has a password | **Yes** |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | **Yes** (public value) |
| `SUPABASE_SERVICE_ROLE_KEY` | JWT, `role=service_role` | **Yes**: production ref. Full DB and storage access, bypasses RLS |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Upstash host / opaque token (62 chars) | Unknown. It is the only Redis configured, so treat it as production |
| `AUTH_SECRET` | opaque, 42 chars | Unknown (it did not sign the k6 tokens) |
| `NEXTAUTH_SECRET` | opaque, 44 chars | **Yes**: it signed the production k6 sessions (§3) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | real-looking (72 chars / `GOCSPX-` prefix) | Likely the production OAuth client |
| `INVITATION_TOKEN_ENCRYPTION_KEY` | 44-char base64 key, not the zero placeholder | Likely production (it decrypts stored invitation links) |
| `OPENAI_API_KEY` | placeholder | No |
| `NODE_ENV` | `development` | — |
| `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL` | `localhost:3000` | No |

### 2.3 Who loads `.env`

- **Next.js** (`next dev` / `build` / `start`) loads `.env` automatically. Process environment variables override it.
- **`prisma.config.ts`** calls `import 'dotenv/config'`, which loads `.env` (not `.env.local`) for **every** Prisma CLI command. The CLI URL is `DIRECT_DATABASE_URL ?? DIRECT_URL`, and **both point at production**.
- **The seeds** (`prisma/seed.ts`, `seed-k6.ts`) now refuse production (`prisma/seed-guard.ts`). **The Prisma CLI has no such guard.** `npx prisma migrate dev` or `db push` from this checkout would act on production; `migrate dev` can offer a database **reset** when it detects drift.
- **A local `next dev`** with this file reads and writes the production database, production storage (service role) and, probably, production Redis.

**Conclusion:** yes, `DATABASE_URL` and `DIRECT_URL` point at production, as do `DIRECT_DATABASE_URL`, the Supabase URL and the service-role key.

### 2.4 Safe development configuration

Production credentials leave the repository directory. A **new** `.env` holds development values only: Prisma reads `.env`, and Next reads both `.env` and `.env.local`.

```dotenv
# .env  (development ONLY; never production values)
DATABASE_URL="postgresql://cxjobs:cxjobs@localhost:5432/cxjobs_dev?schema=public"
DIRECT_DATABASE_URL="postgresql://cxjobs:cxjobs@localhost:5432/cxjobs_dev?schema=public"
# DIRECT_URL intentionally absent
AUTH_SECRET="<new value: openssl rand -base64 32>"          # never the production secret
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
APP_URL="http://localhost:3000"
INVITATION_TOKEN_ENCRYPTION_KEY="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
EMAIL_PROVIDER=disabled
REQUIRE_EMAIL_VERIFICATION=false
# Leave empty: an in-process rate limiter is used outside production.
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
# Uploads: a SEPARATE development Supabase project, or leave empty (uploads disabled locally).
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
OPENAI_API_KEY=
```

- A local Postgres with `pg_trgm` is enough, e.g. Docker: `docker run -d --name cxjobs-pg -e POSTGRES_USER=cxjobs -e POSTGRES_PASSWORD=cxjobs -e POSTGRES_DB=cxjobs_dev -p 5432:5432 postgres:16`.
- Staging and production credentials go only in files **outside** the repository, loaded explicitly for a single command (`docs/FINAL-RELEASE-EXECUTION-PLAN.md` §2.4).

## 3. k6 session files (B)

| File | Size | Modified | Tracked | Ever in Git | Tokens |
|---|---|---|---|---|---|
| `.k6-cookies.txt` | 58,599 B | 26 Sep | no (ignored) | no | 100 |
| `.k6-candidate-cookies.txt` | 60,489 B | 5 Oct | no (ignored) | no | 100 |
| `.k6-company-cookies.txt` | 2,929 B | 5 Oct | no (ignored) | no | 5 |

### Contents

- Each file is one line of **raw Auth.js v5 session tokens**: 5-segment JWEs, header `{"alg":"dir","enc":"A256CBC-HS512","kid":…}`.
- No email addresses or URLs are stored alongside them.
- Payloads were **not** decrypted and the tokens were **not** used.

### Which environment issued them

Auth.js sets the `kid` header to a thumbprint of a key derived (HKDF-SHA256) from the server secret, salted with the cookie name (`node_modules/@auth/core/jwt.js`). Only these public thumbprints were compared with ones derived from the local `.env` secrets. Result:

| Secret + cookie name | Matching tokens |
|---|---|
| `AUTH_SECRET` + `authjs.session-token` | 0 |
| `AUTH_SECRET` + `__Secure-authjs.session-token` | 0 |
| `NEXTAUTH_SECRET` + `authjs.session-token` | 0 |
| **`NEXTAUTH_SECRET` + `__Secure-authjs.session-token`** | **205 / 205** |

Interpretation:

1. **They were issued over HTTPS by a deployed server, not by a local `http://localhost` dev server.** Auth.js uses the `__Secure-` name only for secure origins.
2. **That server signed sessions with the value of the local `NEXTAUTH_SECRET`.** The local app itself would sign with `AUTH_SECRET` (`lib/auth.ts`: `AUTH_SECRET ?? NEXTAUTH_SECRET`), which matches none of them.
3. **The deployment was production.** The committed k6 scripts and README of that period target `https://cxjobs-last-verision.vercel.app`. That host is listed as production in `tests/k6/lib/target-guard.mjs`. The local `results.json` (157 MB) contains 512,928 requests, all to that host and no other.

Expiry:
- The JWE expiry is fixed at issue time (`maxAge` 30 days), so tokens from 26 Sep and 5 Oct should have expired around 26 Oct and 4 Nov.
- `updateAge` (24 h) only re-issues tokens that are actively used. Copies refreshed during later k6 runs are not in these files.
- **The tokens are probably dead. The secret that made them is not.**

**What repository evidence cannot establish:** whether production **still** uses that secret today. Only the Vercel environment settings can show this (§7, step C3).

### 3.1 Session-revocation procedure (prepared, not executed)

The code deployed in production today is HEAD `6e77684`. It has **no per-account revocation** (`sessionVersion` appears 0 times at HEAD). The only revocation mechanism available now is rotating the signing secret.

| Step | Action | Effect | Who / where |
|---|---|---|---|
| R1 | In Vercel → Production env, check which of `AUTH_SECRET` / `NEXTAUTH_SECRET` is set. Compare it **by fingerprint** (`printf %s "$VALUE" \| sha256sum \| cut -c1-12`) with the local `NEXTAUTH_SECRET`; never paste the value anywhere. | Establishes whether G0-2 is live | Owner with Vercel access |
| R2 | If they match, **or** cannot be proven different: set a **new** `AUTH_SECRET` (`openssl rand -base64 32`) in Vercel Production, **remove** `NEXTAUTH_SECRET` there, and redeploy. | Every existing session (k6 or real) becomes invalid; users sign in again. Closes session forgery | Owner, low-traffic window; announce a re-login |
| R3 | Preview/staging environments get their **own**, different secrets. | No cross-environment session reuse | Owner |
| R4 | After the release (migration M1 + new code): bump `sessionVersion` for seeded and test accounts (B5 in the release plan). | Per-account revocation from then on | DB owner, with approval |
| R5 | Delete the cookie files (§7, step C1). | Removes local copies | Developer |

Rotating the secret also invalidates email-verification and other JWT-based flows that are in progress. Reset and verification tokens are DB-hashed and unaffected.

## 4. Git hygiene (C)

### 4.1 Overview

| Kind | Count |
|---|---:|
| Modified tracked | 100 |
| Deleted tracked | 41 |
| Untracked | 57 |
| Staged | 0 |

### 4.2 Classification

| Category | Paths | Action |
|---|---|---|
| **Sensitive (local, ignored)** | `.env` (production credentials); `.k6-cookies.txt`, `.k6-candidate-cookies.txt`, `.k6-company-cookies.txt` (session tokens); `tmp-idor-setup.ts` (shared test password literal), `tmp-idor-test.ts` (CSRF/session handling scaffolding) | Move or delete (§7). Never commit |
| **Sensitive (in pushed history)** | Shared test password in `prisma/seed.ts` and `prisma/run-seed.js` @ `9cf094e` (`origin/main`), and in `prisma/seed.ts` @ `1ed9450` / `6e77684` (`origin/hardening/production-readiness`) | Treat the password as public. Disable or rotate every account that uses it (B5). History rewrite is optional and does not replace rotation |
| **Generated artefacts** | `.next/`, `tsconfig.tsbuildinfo`, `tsconfig.verifytest.tsbuildinfo` (ignored); `next-env.d.ts` (tracked, regenerated by Next 16; commit it) | Leave ignored; commit `next-env.d.ts` |
| **Temporary** | `results.json` (157 MB k6 output, no secrets, production URLs only), `playwright-report/`, empty directory `-p`, `tmp-idor-testdata.json` | Safe to delete (§7) |
| **Required new source (untracked)** | `app/(dashboard)/dashboard/company/(onboarded)/**`, `app/(public)/jobs/[slug]/preview/`, `app/api/{application/[id]/cv,auth/invitation,notifications,profile/cv}/`, `app/{error,global-error,not-found,opengraph-image}.tsx`, `app/{robots,sitemap}.ts`, `app/{forgot-password,reset-password,verify-email}/`, loading pages, `components/{auth/company-invitation,auth/token-flow-forms,dashboard/notification-bell,job-preview-hint,ui/page-loading}.tsx`, `instrumentation.ts`, `lib/{ai-errors,application-status,auth-callbacks,candidate-profile-completeness}.ts`, `lib/{cv,email,security,seo}/`, `lib/server/*.ts` (11 files), 3 migrations, `prisma/seed-guard.ts`, `public/brand/`, `scripts/ops/`, `tests/{helpers,integration,security,k6/lib}/`, `.github/workflows/ci.yml`, `vercel.json`, `.nvmrc`, `CLAUDE.md`, `docs/` | Commit (release plan §1.4) |
| **Ignored but needed** (G0-6) | `prisma/seed-k6.ts`, `tests/k6/generate-company-sessions.js`, `tests/k6/production-full-app.js` | Decide: track them (remove the ignore lines) or drop the test's dependency on them. Until then, CI fails |

### 4.3 The nine moved pages

Old path `app/(dashboard)/dashboard/company/<x>` is now `app/(dashboard)/dashboard/company/(onboarded)/<x>`. Every new copy exists, so Git will record renames once both sides are staged together.

| `<x>` | Change vs HEAD | Similarity |
|---|---|---|
| `page.tsx` | +1 / −1 | 100% |
| `analytics/page.tsx` | identical | 100% |
| `analytics/company-analytics-client-v2.tsx` | +4 / −4 | 99% |
| `jobs/page.tsx` | +3 / −4 | 99% |
| `jobs/company-jobs-client.tsx` | +12 / −10 | 98% |
| `jobs/[jobId]/applications/page.tsx` | identical | 100% |
| `jobs/[jobId]/applications/types.ts` | identical | 100% |
| `jobs/[jobId]/applications/job-applications-client.tsx` | +9 / −2 | 99% |
| `jobs/[jobId]/applications/candidate-review-modal.tsx` | +9 / −6 | 99% |

### 4.4 The two deleted unused files with lost uncommitted edits

| File | Facts |
|---|---|
| `components/dashboard/ai-autofill-modal.tsx` | Unreferenced. Had uncommitted edits, which are now lost: not in any stash, VS Code Local History, `../cxjobs-dirty.diff` (Sept) or any doc. Only the HEAD version can be restored (`git restore -- <path>`) |
| `components/landing/index.ts` | Barrel file for deleted landing components; same situation |

No action is required for runtime. The owner decides whether to accept the loss (release plan, row R4).

### 4.5 `.gitignore` gaps (G0-5)

`git check-ignore` reports these as **not ignored**: `.env.staging`, `.env.production`, `.env.development`, `.env.test`, `.env.k6`. The ignored patterns are `.env`, `.env.local`, `.env.*.local`, and some explicit names.

## 5. Secret scan (D)

**Tool:** no scanner (gitleaks, trufflehog, detect-secrets) is installed, so a local Python scanner was used. Nothing was transmitted.

**Scope**
- The working tree (tracked, untracked and ignored files), excluding `node_modules`, `.next`, `app/generated`, `.git` and binaries. `.env` was excluded as a scan target.
- The added lines of every commit on every ref (`git log --all -p`).

**Rules**
- Postgres URLs with a password.
- JWT/JWE tokens.
- OpenAI (`sk-`), Google OAuth (`GOCSPX-`), Google API (`AIza`), Resend (`re_`) and AWS (`AKIA`) keys.
- Private-key blocks and chat webhooks.
- Secret/token/password assignments and password literals.
- **Exact-value matching** of each real `.env` value (searched by variable name), including the password part of every DB URL.

`results.json` (157 MB) was stream-scanned separately: 0 tokens, 0 cookie headers, 0 passwords, 0 emails.

### Results (values redacted)

| Finding | Location | Type | Verdict |
|---|---|---|---|
| Exact match of a real `.env` value | 12 places in docs/tests (working tree); `CompaniesPageClient.tsx`, `JobsPageClient.tsx` (commit `ee1f382`); `pdf-download-button.tsx` (`c3db4d3`) | `NEXT_PUBLIC_SUPABASE_URL` (`http…`, len 40) | **Not a secret**: public by design (shipped to browsers) |
| Exact match of any **secret** value (DB passwords, service-role key, `AUTH_SECRET`, `NEXTAUTH_SECRET`, Google secret, Upstash token, invitation key) | — | — | **None found** in the tree or history |
| Shared test password literal | `prisma/seed.ts` (`9cf094e`, `1ed9450`, `6e77684`), `prisma/run-seed.js` (`9cf094e`), `tmp-idor-setup.ts:10` (local) | password literal (redacted; all instances share one SHA-256 fingerprint) | **Real, pushed** (G0-4). Removed from the working-tree seeds |
| JWE session tokens | `.k6-*.txt` (3 files, 205 tokens) | Auth.js session JWE | **Real, production-issued** (G0-2/3) |
| Postgres URLs with a password | `.env.example:11-12`, `.github/workflows/ci.yml:25-26,104-105`, `perf-ci.yml:30-31`, `plans/pre-frontend-checklist.md:66`, `tests/security/{env-validation,launch-plan}.test.ts` | DB URL | Placeholders: `localhost`, `127.0.0.1:9`, the CI service container, test fixtures |
| OpenAI-shaped string | `tests/security/ai-timeout.test.ts:84` (`sk-p…`, len 23) | test fixture embedded in a fake upstream error message | Not a credential |
| ~110 secret/token/password "assignments" | `lib/`, `app/api/`, `components/auth/`, tests, `postman_collection.json`, `plans/`, `middleware.ts` (history) | identifiers (`token…`, `rawT…`, `pass…`, `secr…`) | Variable names, `process.env` reads or `{{placeholders}}`, not values |

## 6. Production credential exposure: assessment

| Credential | Where it sits | Exposed beyond this machine? | Required response |
|---|---|---|---|
| DB passwords (3 URLs), service-role key, Upstash token, Google client secret, invitation key | Local `.env` only | Not in Git (verified). Exposure is to anyone or anything with access to this machine, including tools and agents run in this checkout | Move out of the repository (C2). **Rotation is recommended** because the file was readable by automated tooling during this work; the owner decides |
| Session secret (`NEXTAUTH_SECRET`) | Local `.env`; production as of 5 Oct | Same as above; plus 205 tokens derived from it are stored locally | **R1–R2:** verify, then rotate in production |
| Shared test password | Pushed Git history (2 remote branches) | **Yes**, to anyone with repository access | Disable or rotate the seeded accounts (B5) |

## 7. Exact recommended cleanup commands (for the owner; NOT executed)

Run them from the repository root in Git Bash, **in this order**. Nothing below contacts a database or service.

**C1: remove local session tokens and stale secret-bearing scratch files**

```bash
rm -- .k6-cookies.txt .k6-candidate-cookies.txt .k6-company-cookies.txt
rm -- tmp-idor-setup.ts tmp-idor-test.ts tmp-idor-testdata.json
```

**C2: move production credentials out of the repository** (keep them, encrypted at rest)

```bash
mkdir -p "$HOME/.secrets/cxjobs" && chmod 700 "$HOME/.secrets/cxjobs"
mv -- .env "$HOME/.secrets/cxjobs/production.env" && chmod 600 "$HOME/.secrets/cxjobs/production.env"
# then create a NEW development-only .env from §2.4 (no production values)
```

**C3: verify the production session secret** (Vercel dashboard; R1). Fingerprint locally without displaying the value:

```bash
grep -E '^NEXTAUTH_SECRET=' "$HOME/.secrets/cxjobs/production.env" | cut -d= -f2- | tr -d '"' | tr -d '\n' | sha256sum | cut -c1-12
# compare with the same fingerprint computed for the Vercel value; if equal (or unknown) → R2 (rotate)
```

**C4: close the `.gitignore` gaps.** Edit `.gitignore`, then confirm with `git check-ignore -v .env.staging .env.production .env.test`:

```gitignore
# all env files except the example
.env*
!.env.example
```

**C5: remove temporary artefacts**

```bash
rm -f -- results.json tsconfig.tsbuildinfo tsconfig.verifytest.tsbuildinfo
rm -rf -- playwright-report
rmdir -- ./-p
```

**C6: G0-6 (choose one):**
- **(a)** track the k6 seed and generator: delete the three lines `/prisma/seed-k6.ts`, `/tests/k6/production-full-app.js`, `/tests/k6/generate-company-sessions.js` from `.gitignore`. Review `tests/k6/production-full-app.js` first; it has not been reviewed for this gate.
- **(b)** keep them ignored and change the N1 test to skip files that don't exist (code change, needs approval).

**C7: decide on the two lost-edit files** (§4.4). Restoring the HEAD versions would be `git restore -- components/dashboard/ai-autofill-modal.tsx components/landing/index.ts`. Not recommended: they are unused.

## 8. Exact commands to verify development database isolation (offline)

None of these connect to anything. They print only host names and a verdict, never values.

**V1: no production values remain in any env file inside the repository** (expect no output)

```bash
grep -lE 'hvbbactmgfhecqbetlhg|pooler\.supabase\.com|upstash\.io|GOCSPX-' .env .env.* 2>/dev/null | grep -v '^\.env\.example$'
```

**V2: what Next.js would load** (`.env`, `.env.local`, `.env.development`, …)

```bash
node -e "const {loadEnvConfig}=require('@next/env');const {combinedEnv:e}=loadEnvConfig(process.cwd(),true,{info(){},error(){}});for(const k of ['DATABASE_URL','DIRECT_DATABASE_URL','DIRECT_URL','NEXT_PUBLIC_SUPABASE_URL','UPSTASH_REDIS_REST_URL']){const v=e[k]||'';let h='(unset)';try{h=new URL(v).hostname}catch{};console.log(k.padEnd(26),h.padEnd(40),/hvbbactmgfhecqbetlhg|supabase\.com|upstash\.io/.test(v)?'REMOTE/PRODUCTION  <-- FAIL':'ok')}"
```

**V3: what the Prisma CLI would use** (`prisma.config.ts` → `dotenv/config` → `.env`)

```bash
node -e "require('dotenv').config({quiet:true});const v=process.env.DIRECT_DATABASE_URL||process.env.DIRECT_URL||'';let h='(unset: migrate commands will refuse)';try{h=new URL(v).hostname}catch{};console.log('Prisma CLI target:',h,['localhost','127.0.0.1'].includes(h)||h.startsWith('(unset')?'ok':'NOT LOCAL  <-- FAIL')"
```

**V4: the seed guard refuses production** (pure function, no connection)

```bash
npx tsx -e "import {assertSeedTargetAllowed} from './prisma/seed-guard'; try{assertSeedTargetAllowed('postgresql://u:p@db.hvbbactmgfhecqbetlhg.supabase.co:5432/postgres',{});console.log('FAIL')}catch(e){console.log('ok: refused')}"
```

**V5: no env file is committable** (expect every line to show an ignore rule)

```bash
git check-ignore -v .env .env.local .env.staging .env.production .env.test .env.k6
git status --porcelain --ignored | grep -E '\.env' # .env.example only as tracked; everything else '!!'
```

**V6: the tokens are gone**

```bash
ls .k6-*-cookies.txt 2>/dev/null && echo FAIL || echo ok
```

**Gate 0 passes only when all of the following are recorded as evidence:**
- V1–V6 show `ok` (or no output for V1);
- C3 is answered, followed by R2 if needed;
- C6 is decided.

## 9. Not done in this gate (by restriction)

- No database connection, Prisma command, production query or external service call.
- No token revocation or secret rotation (only prepared: §3.1, §7).
- No file deleted, moved or modified, except creating this report.
- No Git staging, commit or push.

---

## 10. Approved cleanup: execution record (11 Nov 2026)

The release owner approved the local Gate 0 cleanup. Everything below was done locally:
- No database connection, Prisma command, Vercel, Supabase or Upstash access.
- No secret rotation or session revocation.
- No staging, commit, push or deploy.

### 10.1 Files changed

| File | Change |
|---|---|
| `.env` | **Replaced** by a development-only file: local Postgres URLs, a freshly generated local `AUTH_SECRET` (fingerprint differs from both production secrets), the documented zero placeholder for the invitation key, `EMAIL_PROVIDER=disabled`. Supabase, Upstash, Google and OpenAI are left **empty and documented as required**: no development credentials exist and none were invented. Ignored by Git |
| `.gitignore` | Secrets section rewritten: `.env`, `.env.*`, `.env*.local` with `!.env.example`; keys/certificates (`*.pem`, `*.key`, `*.p12`, `*.pfx`, `.secrets/`, `secrets/`, `*.secret`, `*.secrets.json`); database dumps (`backups/`, `*.dump`, `*.dump.age`, `*.sql.gz`). Load and security-test artifacts: `.k6-*`, `*cookies*.txt`, `*.cookies`, `*session-token*`, `k6-sessions*/`, `results*.json`, `summary.json`, `*-idor*`, `.auth/`, `storageState*.json` |
| `lib/security/production-db-guard.ts` | **New.** `assertNotProductionDatabase()` refuses the production project from any non-Vercel process unless `CXJOBS_ALLOW_PRODUCTION_DATABASE=I_UNDERSTAND_THIS_IS_PRODUCTION` is set. The error names variables, never values |
| `lib/prisma.ts` | Calls the guard on `DATABASE_URL` before creating the pool, covering `next dev`, a local `next build`/`next start` and scripts. No effect on Vercel (`VERCEL=1`) |
| `prisma.config.ts` | Inlined copy of the guard (no imports) for `DIRECT_DATABASE_URL`, `DIRECT_URL` and `DATABASE_URL`, so every Prisma CLI command (migrate, db push, studio, seed) refuses production without the explicit override. Sole exemption (2026-11-12, `docs/VERCEL-PRISMA-GENERATE-FIX.md`): offline `prisma generate` (CLI entrypoint, first positional `generate`, no `--sql`), which also receives no datasource URL |
| `tests/helpers/seed-credential-scan.ts` | **New.** Pure credential-hygiene rules: hard-coded password, fallback password literal, real mail domain |
| `tests/security/launch-plan.test.ts` | The N1 test was refactored onto synthetic fixtures plus the **tracked** seed and generator only (G0-6 fixed) |
| `tests/security/production-db-guard.test.ts` | **New.** 3 tests: URL detection, runtime guard (local refused; Vercel and override allowed; value never echoed), and Prisma config refusal for each of the 3 variables, with a dotenv path that cannot read the local `.env` |
| `docs/FINAL-RELEASE-EXECUTION-PLAN.md` | §2.4 and §2.5: the production `migrate deploy` / `status` steps now set the one-command override; staging needs none |
| `docs/RELEASE-GATE-0-SECURITY-REVIEW.md` | This record |

**Moved (not deleted):** the production `.env` → `%USERPROFILE%\.secrets\cxjobs\production.env`.
- Moved byte-identical (2,643 bytes).
- Windows ACLs set: inheritance removed; only the user account `tun` has access (file: read/write; directory: full).

### 10.2 Files deleted (exact paths; contents never printed)

| File | Why |
|---|---|
| `.k6-cookies.txt` | 100 production-issued Auth.js session tokens (untracked) |
| `.k6-candidate-cookies.txt` | 100 production-issued session tokens (untracked) |
| `.k6-company-cookies.txt` | 5 production-issued session tokens (untracked) |
| `tmp-idor-setup.ts` | Manual IDOR set-up script. It held the shared seed password as a literal (same SHA-256 fingerprint as the pushed seed password) and **upserted test accounts into whatever `DATABASE_URL` pointed to, which was production**. The useful evidence was kept (below) |
| `tmp-idor-test.ts` | Manual IDOR probe harness (logged in against `localhost:3000`). No credential literal. Superseded by the integration suite |

**Deliberately kept:**
- `tmp-idor-testdata.json`: record IDs created by the IDOR set-up, non-sensitive UUIDs; ignored by Git. It is evidence for the production data check below.
- `results.json`: 157 MB of k6 output with no tokens, passwords or emails; ignored. It is the evidence that the load tests ran against the production host.

**Preserved evidence (production may contain IDOR test data).** The deleted set-up created the accounts `user1@test.com`, `user2@test.com`, `company1@test.com` and `company2@test.com`, plus companies with slugs `company-a-idor` and `company-b-idor`, all with the shared test password. Read-only check for the B5 step of the release plan (**not executed**):

```sql
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
select role, count(*) n, count(*) filter (where "isActive") active
from users where email in ('user1@test.com','user2@test.com','company1@test.com','company2@test.com') group by role;
select count(*) from companies where slug in ('company-a-idor','company-b-idor');
```

### 10.3 Environment isolation results (§8 commands, run 11 Nov)

| Check | Result |
|---|---|
| V0: production env outside the repository | **ok**: `/c/Users/tun/.secrets/cxjobs/production.env` |
| V1: no production values in any env file in the repository | **ok** (no output) |
| V2: what Next.js would load | **ok**: `DATABASE_URL` and `DIRECT_DATABASE_URL` → `localhost`; `DIRECT_URL`, Supabase and Upstash unset |
| V3: Prisma CLI target | **ok**: `localhost` |
| V4: seed guard refuses production | **ok**: refused |
| V5: env files ignored | **ok**: `.env`, `.env.local`, `.env.staging`, `.env.production`, `.env.test`, `.env.k6` all ignored; `.env.example` not ignored |
| V6: k6 cookie files absent | **ok** |
| Token sweep of the working tree (excl. `node_modules`, `.next`, `.git`) | **ok**: no JWE session tokens and no JWT-shaped strings |
| Dev `AUTH_SECRET` vs production `AUTH_SECRET` / `NEXTAUTH_SECRET` (fingerprints) | **ok**: different from both |
| Production DB guard | **ok**: Prisma config refuses each of the 3 variables with a production URL; allows a local URL, no URL, or the explicit override |

### 10.4 Git ignore verification

- `git check-ignore` confirmed **ignored**: `.env`, `.env.local`, `.env.staging`, `.env.production`, `.env.development`, `.env.test`, `.env.k6`, `.env.staging.local`, `.k6-cookies.txt`, `.k6-candidate-cookies.txt`, `x/candidate-cookies.txt`, `authjs.session-token.txt`, `results.json`, `results-run2.json`, `tmp-idor-testdata.json`, `backups/db.dump`, `prod.dump.age`, `.secrets/x`, `server.key`.
- Confirmed **trackable**: `.env.example` and every new source, test, script and doc file checked (`prisma/seed-guard.ts`, `lib/security/production-db-guard.ts`, `tests/security/launch-plan.test.ts`, `app/api/notifications/route.ts`, `scripts/ops/backup-db.sh`, `lib/server/session-revocation.ts`, this report).
- The untracked-path count is unchanged (57), so no required file was hidden by the new rules.
- Informational: these are **already tracked** although they match ignore rules: `WORK_LOG.md`, `plans/*.md`, `playwright-report/data/*` (2 files), `postman_collection.json`. Ignore rules don't affect tracked files. Untracking `playwright-report/` needs `git rm --cached -r playwright-report`, which is a staging action: **not done; needs approval**.
- **Staged files: 0.**

### 10.5 CI test results

| Run | Result |
|---|---|
| `npx tsx --test tests/security/launch-plan.test.ts tests/security/production-db-guard.test.ts` | **17/17 pass** |
| Negative control: the checker on the old committed `prisma/seed.ts` and `tests/k6/generate-candidate-sessions.js` (HEAD) | flags `hard-coded-password` + `real-mail-domain`, and `fallback-password-literal` + `real-mail-domain`, so the test is not vacuous |
| `npm run test:security` | **206/206 pass**, 0 skipped (the F-33 timing test also passed this run) |
| `npm run test:integration` | **270/270 pass**, 0 skipped |
| `npx tsc --noEmit` | 0 errors |
| `npm run lint:ci` | 0 errors, 34 warnings (unchanged) |

- The N1 test no longer reads any gitignored file.
- The gitignored load-test files (`prisma/seed-k6.ts`, `tests/k6/generate-company-sessions.js`, `tests/k6/production-full-app.js`) stay untracked, as instructed.
- `package.json` `seed:perf` still points at the ignored `prisma/seed-k6.ts`, so on a fresh clone it fails with "file not found". Cosmetic; no secret involved.

### 10.6 Authentication secret: rotation procedure (prepared; NOT executed)

- **Active variable:** `lib/auth.ts` uses `process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET`. `AUTH_SECRET` wins whenever it is set; `NEXTAUTH_SECRET` is only the fallback. `lib/env.ts` validates the same pair.
- **Evidence:** the production k6 sessions were signed with the value of the local `NEXTAUTH_SECRET`. Production therefore either had only `NEXTAUTH_SECRET` set, or `AUTH_SECRET` set to that same value (as of 5 Oct).

| Step | Action | Verification |
|---|---|---|
| 1. Identify | In Vercel → Project → Settings → Environment Variables (**Production**), note which of `AUTH_SECRET` / `NEXTAUTH_SECRET` exist. Fingerprint each value without displaying it (e.g. `read -rs V; printf %s "$V" \| sha256sum \| cut -c1-12`). Compare with the fingerprint of `NEXTAUTH_SECRET` in `%USERPROFILE%\.secrets\cxjobs\production.env`. | A written note of which variable is active and whether it matches |
| 2. Generate | `openssl rand -base64 32` (or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) on the operator's machine. Never in a shared terminal, chat, ticket or file inside the repository. | 44-character base64 value |
| 3. Update | Set **`AUTH_SECRET`** (Production scope) to the new value. **Delete** `NEXTAUTH_SECRET` from Production, so that no stale fallback can ever be used. Preview and Development scopes get their own **different** values. | The Vercel UI shows `AUTH_SECRET` only, per scope |
| 4. Redeploy | Redeploy production. Environment changes apply only to new deployments. | The deployment completes; `/api/health` returns 200 |
| 5. Old sessions rejected | A browser that was signed in before step 4 (or any old cookie) is treated as signed out on its next request. `GET /api/auth/session` returns an empty session. | Screenshot or response |
| 6. New login works | Sign in with a test candidate and a test company (credentials **and** Google); reach the dashboards. | Screenshot |

**Side effects to announce:** every user is signed out once. No database data changes. Password-reset and verification tokens are DB-hashed and unaffected.

**Also rotate, unless exposure can be ruled out.** The local file held these production credentials and was readable by local tooling; none were found in Git:

| Credential | How | Caveat |
|---|---|---|
| Supabase database password | Supabase → Database → reset the password; update `DATABASE_URL` / `DIRECT_DATABASE_URL` in Vercel and the secure local file; redeploy | Coordinate with the migration window (B2) |
| Supabase service-role key (JWT secret) | Supabase → API → roll the JWT secret / service key; update `SUPABASE_SERVICE_ROLE_KEY` in Vercel; redeploy | Rolling the JWT secret also invalidates the anon key and Supabase-auth sessions (the app uses Auth.js, but check other consumers) |
| Upstash Redis token | Upstash console → reset the token; update `UPSTASH_REDIS_REST_TOKEN`; redeploy | Rate-limit counters and revocation keys survive |
| Google OAuth client secret | Google Cloud Console → Credentials → reset the secret; update `GOOGLE_CLIENT_SECRET`; redeploy | Brief Google sign-in failure if not updated in time |
| `INVITATION_TOKEN_ENCRYPTION_KEY` | New 32-byte base64 key in Vercel | **Breaks pending invitation links** (re-issue them from the admin Tokens page) |

### 10.7 Remaining security risks

| Risk | Severity | Status |
|---|---|---|
| The production session secret (`NEXTAUTH_SECRET` value) may still be active: session forgery for any account | **Critical** | Open: §10.6 needs Vercel access and approval |
| The shared test password is public via pushed Git history; seeded k6 accounts (`user1–100@gmail.com`, `company1–5@cxjobs.test`) and IDOR accounts (`user1/2@test.com`, `company1/2@test.com`) may exist in production with it | High | Open: release plan B5 + the §10.2 query (approval needed) |
| Supabase DB password, service-role key, Upstash token, Google secret and invitation key sat in a local plain-text file | High | Contained locally (moved, ACL-restricted); rotation recommended (§10.6) |
| The moved production file is still a plain-text secret on this disk | Medium | Prefer a password manager or encrypted vault; delete the file once the values are stored there |
| `playwright-report/` is tracked in Git | Low | Untrack it with approval (§10.4) |
| `seed:perf` script points at an ignored file | Low | Cosmetic |

### 10.8 Actions requiring manual approval

1. **Production session-secret rotation** (§10.6, steps 1–6): owner with Vercel access.
2. **Rotation of the other production credentials** (§10.6 table): owner decision.
3. **Read-only production queries** for seed, k6 and IDOR test accounts (§10.2; release plan §3.3), then an approved deactivation, password rotation or `sessionVersion` bump (needs migration M1 and the new code).
4. **Untracking `playwright-report/`** (`git rm --cached -r playwright-report`), then the commits in release plan §1.4.
5. **Moving `production.env` into a password manager**, then deleting the local copy.

### 10.9 Verdict: **CONDITIONAL PASS**

**Passed.** Everything Gate 0 can achieve locally is done and verified:
- production credentials are out of the repository;
- the development configuration holds no production value;
- the Prisma CLI and the runtime client refuse production by default;
- the session-token files are gone and no token remains in the working tree;
- env and credential files can no longer be committed;
- the CI test no longer depends on ignored files;
- all local suites are green.

**Condition before any production operation (migration or deploy):** decision and evidence on §10.8 item 1, the session-secret rotation. Until then, treat the production session secret as compromised.

**Stopped here, awaiting approval.** No commit, push, migration or deploy has been made.

---

## 11. Gate 0.1: post-remediation security closeout (11 Nov 2026)

**Approved by the release owner:**
1. rotation of the production authentication secret;
2. coordinated rotation of the other exposed credentials;
3. the documented read-only production SQL checks;
4. untracking `playwright-report/`;
5. moving the production credentials into a password manager before the local copy is deleted.

**Done locally, without:** production access, Vercel, Supabase, Upstash or Google access, Prisma commands, rotations, commits, pushes or deploys.

### 11.0 New critical finding (corrects §5)

**G0.1-1 (Critical): a real-looking admin credential is in pushed Git history.**

**Where**
- Commit `ee1f382` (21 Sep, on `origin/hardening/production-readiness`) adds the same email (`ad…@cxjobs.com`, the company's real domain) and the same 10-character password to:
  - `prisma/seed.ts`;
  - seven `tests/e2e/*.spec.ts` files (`page.fill("#password", …)` / `loginUser(page, …)`);
  - the Playwright error-context file `playwright-report/data/fdf6…f869.md`.
- The same email address alone (no password) also appears in earlier `prisma/seed.ts` commits (`c3db4d3`, `b0f941e`).
- The password fingerprint is `d3fc50c8f714`. It is **not** the shared seed password (`ef797c8118f0`).
- That seed creates this user with **role COMPANY** as the owner of the company with slug **`cxjobs`**. Because the developer `.env` pointed at production, **this account may exist in production with a password readable by anyone with repository access.**

**A second test password** (fingerprint `fc61771ae62b`) is in the same commit's e2e specs. It belongs to `ca…@email.com`, a candidate account on a **real public mail provider domain**.

**Correction:** the §5 scan missed both. Its rules did not cover `page.fill(…)`, login-helper arguments or this seed's syntax. A widened scan (literal passwords passed to form fills, `password:` object fields, login helpers and `*PASSWORD* =` constants; history and working tree; values compared by fingerprint only) found these two and nothing else new. The remaining hits are synthetic test fixtures, a wrong-password test value, and the dummy bcrypt hash `DUMMY_PASSWORD_HASH` in `lib/auth.ts` that equalizes login timing.

**Historical note:** the same old seed (`ee1f382`) runs `prisma.user.deleteMany({ where: { role: "CANDIDATE" } })`. If it ever ran against production, every candidate account was deleted at that time. The current seed does not do this, and it refuses production.

**Untracking does not remove history.** `git rm --cached` keeps the files out of future commits, but `ee1f382` remains on the remote. The credentials must be treated as exposed, and **rotation (§11.6) is the remedy**. A history rewrite (`git filter-repo` plus a force-push) is optional and needs a separate decision, because it rewrites shared branches.

### 11.1 Completed in this gate (repository side)

| # | Action | Evidence |
|---|---|---|
| 1 | Verified the production database hard block is intact: `prisma.config.ts` (inlined guard, 3 variables) and `lib/prisma.ts` (`assertNotProductionDatabase`) | Lines present; guard tests pass |
| 2 | **Closed two hard-block gaps** found during verification: `scripts/get-job-ids.ts` (direct `pg` client) now calls `assertNotProductionDatabase`; `prisma/seed-performance-jobs.ts` now calls `assertSeedTargetAllowed` | Both refuse a synthetic production URL **before** creating a connection (run locally; nothing contacted) |
| 3 | **New regression test:** every tracked file that opens a database connection (`new Client`/`new Pool`/`new PrismaPg`) must call a production guard | `tests/security/production-db-guard.test.ts` 4/4. Negative control: the committed (HEAD) versions of both scripts are flagged |
| 4 | Verified `.env.example` is the only tracked env file | `git ls-files` |
| 5 | Verified `playwright-report/` holds generated artifacts only: HTML reporter bundle, error-context `.md`, screenshot `.png`; no source | `file` types + Playwright signatures. The `.md` embeds the test source with the credential (G0.1-1) |
| 6 | **`git rm -r --cached -- playwright-report`** executed (approved). Local directory kept. It is now ignored by `.gitignore` | 3 staged deletions (see 11.5). `git ls-files playwright-report` → 0 |
| 7 | Audited every SQL block in both release documents for write/DDL keywords and side-effecting functions (§11.4) | 8 blocks read-only, 1 write block (migration window), clearly bannered |
| 8 | Added a per-block `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` guard to every read-only block in `docs/FINAL-RELEASE-EXECUTION-PLAN.md` §2.5–§3.5, a **WRITE** banner on the §2.5 index pre-creation, and a **WRITE / DESTRUCTIVE** label on the §2.6 emergency SQL | Re-audit: all 8 read-only blocks guarded |
| 9 | Re-confirmed auth configuration: `lib/auth.ts` → `process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET`. **`AUTH_SECRET` takes precedence; `NEXTAUTH_SECRET` is the fallback.** Production sessions were signed with the old local `NEXTAUTH_SECRET` (205/205 tokens, `__Secure-` cookie; §3) | Code + §3 evidence |

**Files changed in this gate:**
- `scripts/get-job-ids.ts`
- `prisma/seed-performance-jobs.ts`
- `tests/security/production-db-guard.test.ts` (+1 test)
- `docs/FINAL-RELEASE-EXECUTION-PLAN.md` (SQL guards and banners)
- `docs/RELEASE-GATE-0-SECURITY-REVIEW.md` (this section)
- Index only: the 3 `playwright-report/` files are untracked.

**Nothing deleted.**

### 11.2 Part B: production session-secret rotation (manual; Vercel access)

**Order:** do this **first**, before the other rotations. It is the only credential that lets an attacker act **as any user** through the live site.

| Step | Action (operator, Vercel dashboard) | Verification | Recovery |
|---|---|---|---|
| B1 | Project → Settings → Environment Variables → filter **Production**. Record which of `AUTH_SECRET` / `NEXTAUTH_SECRET` exist. Fingerprint each value locally without displaying it (`read -rs V; printf %s "$V" \| sha256sum \| cut -c1-12; unset V`). Compare with the fingerprint of `NEXTAUTH_SECRET` from the password-manager copy (§11.3). | A written note: active variable, and match yes/no | — |
| B2 | Generate a new value on the operator's machine: `openssl rand -base64 32`. Store it **only** in the password manager entry "CXJobs Production / AUTH_SECRET". | 44-char base64 value stored | — |
| B3 | Set **`AUTH_SECRET`** (Production) to the new value. **Delete `NEXTAUTH_SECRET`** from Production. Preview/Development: set their own **different** `AUTH_SECRET` and delete `NEXTAUTH_SECRET` there too. | Only `AUTH_SECRET` is listed, per environment | Restoring the previous value means restoring a compromised secret. **Don't.** Fix forward with a new value |
| B4 | Deployments → **Redeploy** the current production deployment (environment changes apply only to new deployments). | Deployment "Ready"; `GET /api/health` → 200 | Vercel Instant Rollback restores code, **not** environment values. If the new deployment fails for an unrelated reason, roll back the code and keep the new secret |
| B5 | **Old sessions fail:** in a browser signed in before B4, reload any dashboard page; `GET /api/auth/session` returns an empty session and the dashboard redirects to `/login`. | Screenshot / response | If old sessions still work, the deployment did not pick up the variable: check its scope and redeploy |
| B6 | **New login works:** sign in as a test candidate and a test company (credentials **and** Google) and reach the dashboards. | Screenshots | If login fails with a configuration error: check `AUTH_SECRET` is set for Production, and see the deployment logs ("Environment configuration warning" names variables only) |

**Effects to announce:** every user is signed out once. No data changes. Password-reset and verification tokens are DB-hashed and unaffected.

### 11.3 Password manager move (manual; before deleting the local copy)

1. Create a vault item per environment ("CXJobs Production", later "CXJobs Staging"), with one field per variable from `%USERPROFILE%\.secrets\cxjobs\production.env`. Use the variable **names** as labels. Never use screenshots, and never paste values into chat or tickets.
2. Verify each field by fingerprint against the file: `grep '^NAME=' production.env | cut -d= -f2- | tr -d '"\n' | sha256sum | cut -c1-12`, compared with the same computed from the vault value.
3. Rotations (§11.2, §11.6) update the **vault** entry, never the file.
4. When the vault is verified, delete the local copy: `rm -- "$HOME/.secrets/cxjobs/production.env"` (and empty the recycle bin if it was moved there). For the approved migration step, create a temporary env file from the vault, use it for one command, then delete it.

### 11.4 Part D: read-only production SQL (manual; authorized release owner)

**Audit result.** Every ` ```sql ` block in `docs/FINAL-RELEASE-EXECUTION-PLAN.md` and this report was scanned (comments and string literals stripped) for `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, `GRANT`, `REVOKE`, `COPY`, `CALL`, `DO`, `VACUUM`, `REINDEX`, `CLUSTER`, `LOCK`, `MERGE`, `FOR UPDATE/SHARE`, and side-effecting functions (`pg_terminate_backend`, `pg_cancel_backend`, `nextval`, `setval`, `set_config`, `pg_advisory*`, `dblink*`, `lo_*`). No Prisma or migration command appears inside an SQL block.

| Block | Result |
|---|---|
| Plan §2.3 (schema verification, after migrating) | READ-ONLY, guarded |
| Plan §2.5 step 3 (long transactions) | READ-ONLY, guarded |
| Plan §3.1 (migration state, pre-flight) | READ-ONLY, guarded |
| Plan §3.2 (duplicate emails) | READ-ONLY, guarded |
| Plan §3.3 (seed / test accounts) | READ-ONLY, guarded |
| Plan §3.4 (CV storage, bucket) | READ-ONLY, guarded |
| Plan §3.5 (new-table integrity) | READ-ONLY, guarded |
| This report §10.2 (IDOR test accounts) | READ-ONLY, guarded |
| Plan §2.5 step 2 (`CREATE INDEX CONCURRENTLY`) | **WRITE.** Part of the approved migration window, **not** of the read-only checks; bannered |
| Plan §2.6 emergency SQL (inline text, `DROP …`) | **WRITE / DESTRUCTIVE.** Labelled; DB-owner decision only |

The `prisma migrate status` / `migrate diff` commands in the plan are CLI steps, not SQL. They read the schema and need the Gate 0 override for production.

**Additional read-only checks for G0.1-1** (to run together with plan §3.3; no email addresses are returned):

```sql
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;  -- every statement below is read-only
-- The owner account of the company "cxjobs" created by the old seed
select u.id, u.role, u."isActive", u."createdAt", u."updatedAt", (u."passwordHash" is not null) as has_password
from users u join companies c on c."userId" = u.id
where c.slug = 'cxjobs';
-- Candidate accounts on the public mail domain used by the old e2e tests
select role, count(*) n, count(*) filter (where "isActive") active from users
where email ilike '%@email.com' group by role;
-- Any other administrator accounts (to confirm which accounts hold admin rights)
select id, "isActive", "createdAt", "updatedAt" from users where role = 'ADMIN';
```

**How to run (release owner):**
1. Use the Supabase dashboard → SQL editor of the **production** project, signed in with your own account. Or use a read-only database role, never the application's credentials.
2. Paste **one block at a time**. Its first line makes the session read-only, so any accidental write fails with "cannot execute … in a read-only transaction".
3. Run the **count** queries first. Run listing queries only when a count is non-zero and someone is assigned to act on it.
4. Record row counts (not personal data) in the release matrix. Store any export containing personal data only in the access-controlled location the team uses for incidents, and delete it after use.
5. Any remediation is a **separate, approved write**, never part of this step: deactivate test accounts, reset passwords, unpublish `k6-test-*` jobs.

### 11.5 Final verification (Part E, run 11 Nov)

| Check | Result |
|---|---|
| No k6 session cookies remain | **ok**: 0 files matching `.k6-*` / `*cookies*.txt` |
| No production `.env` inside the repository | **ok**: no repo env file contains production markers; the production file is only at `%USERPROFILE%\.secrets\cxjobs\production.env` |
| Production database hard block intact | **ok**: `prisma.config.ts` + `lib/prisma.ts` + the 2 newly guarded scripts; `production-db-guard.test.ts` 4/4 |
| `.gitignore` protects env files and generated reports | **ok**: `.env.production`, `.env.staging` ignored; `playwright-report/`, `test-results/` ignored; `.env.example` trackable |
| `.env.example` is the only tracked env template | **ok** |
| `playwright-report/` no longer tracked | **ok**: 0 files in the index; local copy kept |
| Staged changes | Exactly 3, all **deletions**: `D playwright-report/data/78485ad2…png`, `D playwright-report/data/fdf68161…md`, `D playwright-report/index.html`. Added-line scan of the staged diff: 0 suspicious lines. **No sensitive file staged. Nothing committed** |
| Security suite | **207/207 pass** |
| TypeScript / ESLint | 0 errors / 0 errors, 34 warnings |

### 11.6 Part C: rotation checklist for the other credentials (manual)

**Order:**
1. **Session secret** (§11.2), first.
2. **Admin / test account passwords** (G0.1-1, below): needs only the app, and the exposure is in pushed history.
3. **Google OAuth secret**: can overlap, no downtime.
4. **Supabase service-role key**: brief window, uploads only.
5. **Upstash token**: brief login fail-closed window.
6. **Database password**: last, in the migration window, because it briefly breaks everything.

Keep the vault updated after each step. Change one credential at a time and verify it before moving to the next.

#### C0: exposed account passwords (G0.1-1)

| | |
|---|---|
| Dependent services | The app only |
| Variables | None |
| Rotation | Sign in to the production app as an administrator (or use the password-reset email once F2 works) and set a new, unique password for the `cxjobs` company owner account. Deactivate the `@email.com` test candidate(s) and all seeded or IDOR test accounts found by §11.4 / plan §3.3 / §10.2. After the release (migration M1 + new code), a password reset also revokes that account's sessions; before it, session revocation relies on the §11.2 secret rotation |
| Verification | The old password fails at `/login` (expect the generic error); the new one works; deactivated accounts cannot sign in |
| Recovery | An admin can reactivate an account via `/dashboard/admin/users` if one was deactivated by mistake |

#### C1: Google OAuth client secret

| | |
|---|---|
| Dependent services | Google sign-in only (`lib/auth.ts` Google provider) |
| Variables | `GOOGLE_CLIENT_SECRET` (and `GOOGLE_CLIENT_ID`, unchanged) in Vercel Production (and Preview if it shares the client; it should not) |
| Rotation | Google Cloud Console → APIs & Services → Credentials → the OAuth client → **Add secret** (the old one stays valid) → set `GOOGLE_CLIENT_SECRET` in Vercel to the new secret → redeploy → verify → **disable, then delete** the old secret |
| Verification | "Continue with Google" completes sign-in on production; deployment logs show no `OAuthCallbackError` |
| Recovery | While the old secret is only disabled (not deleted), re-enable it and restore the variable |

#### C2: Supabase service-role key

| | |
|---|---|
| Dependent services | Server-side storage only (`lib/supabase.ts`: CV uploads and signed CV links, image uploads). No anon key is used anywhere in the code. Also check for other consumers outside this repository (scripts, other apps) |
| Variables | `SUPABASE_SERVICE_ROLE_KEY` (Vercel Production); `NEXT_PUBLIC_SUPABASE_URL` unchanged |
| Rotation (preferred) | If the project offers the **new API keys** (Project Settings → API Keys, `sb_secret_…`): create a new **secret key**, set it as `SUPABASE_SERVICE_ROLE_KEY` in Vercel, redeploy, verify, then **disable the legacy JWT-based `service_role` key**. **Confirm on staging first** that the installed `@supabase/supabase-js` (`^2.97.0`) accepts the new key format for Storage. |
| Rotation (fallback) | Roll the **legacy JWT secret** (Settings → API → JWT). This invalidates **both** the anon and service-role keys at once. Update the variable immediately and redeploy; uploads fail until then |
| Verification | Upload a CV and an image (test account); open "View CV" (signed URL works); `/api/health` → Supabase healthy |
| Recovery | New keys: re-enable the legacy key until fixed. JWT roll: no rollback to the old secret, so fix forward by copying the new service key from the dashboard into Vercel |

#### C3: Upstash Redis token

| | |
|---|---|
| Dependent services | Rate limiting (login, register, reset, AI, uploads, views, health), the daily AI quota, session-revocation keys (`lib/redis.ts`, `lib/rate-limit.ts`, `lib/server/session-revocation.ts`) |
| Variables | `UPSTASH_REDIS_REST_TOKEN` (and `UPSTASH_REDIS_REST_URL`, unchanged) in Vercel Production |
| Rotation | Upstash console → the database → **Reset credentials / rotate token** → update `UPSTASH_REDIS_REST_TOKEN` in Vercel → redeploy. **Between reset and redeploy, sensitive limiters fail closed:** login, registration, password reset and AI return "try again later". Do it in a quiet window and keep the gap to a few minutes |
| Verification | Sign in succeeds; deployment logs show no `Rate limiter backend error`; `/api/health` → Redis healthy; 6 rapid failed logins to a test account produce the rate-limit message |
| Recovery | No rollback to the old token after a reset. Fix forward by re-copying the new token from the console. Data (counters, revocation keys) is unaffected |

#### C4: Database password

| | |
|---|---|
| Dependent services | The app runtime (`DATABASE_URL`, Supabase pooler, port 6543); migrations (`DIRECT_DATABASE_URL`, 5432) run from the operator's machine; any backup job (use its own **read-only role**, `BACKUP_DATABASE_URL`, not this password). `scripts/get-job-ids.ts` is local-only |
| Variables | `DATABASE_URL` and `DIRECT_DATABASE_URL` (Vercel Production holds `DATABASE_URL`; the direct URL lives only in the vault and temporary env files) |
| Rotation | In the migration window: Supabase → Project Settings → Database → **Reset database password** → build both connection strings from the dashboard's connection-string panel → update `DATABASE_URL` in Vercel → redeploy at once → update the vault. **Between reset and redeploy, new database connections fail** (site errors), so keep the window to minutes and announce maintenance |
| Verification | `/api/health` → database healthy; `/jobs` loads (uncached request); sign in and open a dashboard; the next `prisma migrate status` from the vault-loaded env (with the Gate 0 override) succeeds |
| Recovery | No rollback to the old password. Fix forward with another reset if the new value was lost; the vault entry is the source of truth. Do not combine with the migration in the same minute: rotate, verify, **then** migrate |

#### Not rotated: `INVITATION_TOKEN_ENCRYPTION_KEY`

Kept as instructed. Exposure is not established beyond the local file, and rotating it **breaks every pending invitation link**. Before any future rotation:
1. Count the pending invitations (read-only: `select count(*) from company_invitations where status = 'PENDING' and "revokedAt" is null and "expiresAt" > now();`).
2. Plan to re-issue those links from `/dashboard/admin/tokens`.

### 11.7 Actions requiring manual access (NOT done here)

| # | Action | Access needed | Section |
|---|---|---|---|
| M1 | Production session-secret rotation (B1–B6) | Vercel | §11.2 |
| M2 | Reset the exposed `cxjobs` company-owner password; deactivate `@email.com`, seeded and IDOR test accounts | Production app / admin, after the read-only checks | §11.6 C0, §11.4 |
| M3 | Google OAuth secret rotation | Google Cloud Console + Vercel | §11.6 C1 |
| M4 | Supabase service-role key rotation | Supabase + Vercel | §11.6 C2 |
| M5 | Upstash token rotation | Upstash + Vercel | §11.6 C3 |
| M6 | Database password rotation (migration window) | Supabase + Vercel + vault | §11.6 C4 |
| M7 | Read-only production SQL | Production DB (read-only) | §11.4, plan §3 |
| M8 | Move credentials to the password manager, verify by fingerprint, delete the local file | Password manager | §11.3 |
| M9 | Delete the local `playwright-report/` (it still holds the exposed credential) **after** M2 | Local | — |
| M10 | Optional: rewrite Git history to purge `ee1f382`'s credentials (force-push to shared branches) | GitHub + team agreement | §11.0 |
| M11 | Commit the staged `playwright-report/` untracking together with the release commits | Git | release plan §1.4 |

### 11.8 Verdict: **CONDITIONAL PASS** (unchanged)

**Repository side complete and verified:**
- the hard block is extended to every tracked database entry point and covered by a regression test;
- reports are untracked;
- the SQL is audited and guarded;
- secrets are not in the working tree;
- the only staged change is the 3-file report untracking.

**Conditions before any production migration or deploy:**
- **M1** (session secret) and **M2** (exposed admin/test passwords) done, with evidence;
- **M7** run.

Until M1 and M2 are done, treat any production session, and the `cxjobs` company-owner login, as compromised.

**Stopped here, awaiting approval.** No commit, push, migration, deploy or production access has been made.

# CXJobs: final release execution plan

| | |
|---|---|
| **Prepared** | 11 Nov 2026, from the repository state only. No command in this plan has been run against staging or production. |
| **Branch / HEAD** | `hardening/production-readiness` @ `6e77684` (same as `origin`). Nothing staged, committed or pushed. |
| **Inputs** | `docs/PRODUCTION-READINESS-REPORT.md`, `docs/PRODUCTION-READINESS-REMEDIATION.md`, `docs/OPERATIONS.md`, `docs/PHASE-4B-AUDIT.md` §8, `docs/security/PRODUCTION_READINESS.md` |
| **Local quality state** | tsc 0 errors · ESLint 0 errors / 34 warnings · security 201/202 (one known timing flake, F-33) · integration 270/270 · build passes |
| **Verdict until §6 is complete** | **NO-GO** |

**Conventions**
- `[RUN]` marks a step for a person to run, with approval, in the stated environment.
- `[EVIDENCE]` marks what must be kept: a screenshot, an output paste or a link.
- Nothing is "done" without its evidence.

---

## 1. Git safety

### 1.1 Working tree inventory (read-only, taken 11 Nov)

| Kind | Count | Notes |
|---|---:|---|
| Modified tracked files (`M`) | 100 | All hardening phases. Includes **dependency upgrades** in `package.json` / `package-lock.json`: e.g. `next` 16.1.6 → 16.4.5, `pdfjs-dist` 2.x → 6.x, Prisma 7.8 → 7.10, `next-auth` beta.30 → beta.32 |
| Deleted tracked files (`D`) | 41 | Breakdown below |
| Untracked paths (`??`) | 57 | New code, tests, migrations, docs, CI workflow. **None are gitignored.** All are needed |

**Deleted files, by reason**

| Group | Files | Status |
|---|---|---|
| Moved into the `(onboarded)` route group | 9 under `app/(dashboard)/dashboard/company/{page,analytics/*,jobs/*}` | New copies exist under `app/(dashboard)/dashboard/company/(onboarded)/…` (untracked). Not data loss |
| Dead code removed (earlier phases) | `components/landing/{featured-section,header,trusted-strip}.tsx`, `components/ui/sidebar.tsx`, `lib/pdfjs-dist.d.ts`, the stray file `false))` | Intentional |
| Dead code removed (11 Nov) | 18 unused components, `lib/validations/{job-alert,notifications}.ts`, `CheckboxRow.tsx`, `components/about/stats-section.tsx` | Intentional; every one was unreferenced (dead-module scan + basename search) |
| Stale scripts removed (11 Nov) | `tmp-dbcheck.ts`, `verify_seed.ts` (it contained the shared seed password), `inspect_trgm.js`, `tmp-verify/*.ts`, `summary.json` | Intentional |

### 1.2 The two deleted files that held earlier uncommitted work

| File | State before 11 Nov | Now | Recoverable? |
|---|---|---|---|
| `components/dashboard/ai-autofill-modal.tsx` | Modified, uncommitted (`M` in the session-start snapshot) | Deleted (unreferenced anywhere) | **Only the HEAD version.** The uncommitted edits are gone: no stash, VS Code Local History has no entry, the Sept patch `../cxjobs-dirty.diff` does not contain them, and no doc describes them |
| `components/landing/index.ts` | Modified, uncommitted | Deleted (barrel of deleted components) | Same: HEAD version only |

**Decision for the owner:**
- Both files were dead code, so nothing in the app depends on them.
- If the lost edits mattered, they must be redone by hand.
- To bring back the HEAD versions, run `git restore -- <path>`. **Not done automatically.**

### 1.3 Temporary and local files

| Path | Git | Size | Content (no values were printed) | Recommendation |
|---|---|---|---|---|
| `.k6-cookies.txt`, `.k6-candidate-cookies.txt`, `.k6-company-cookies.txt` | ignored | 59 KB / 60 KB / 3 KB | **Raw Auth.js session tokens**: about 100 token values in each of the two larger files | **Sensitive.** Delete them. Sessions last 30 days and the files date from 26 Sep and 5 Oct, so the tokens should have expired. If they were generated against production, also do the B5 rotation (§6), which bumps `sessionVersion` |
| `tmp-idor-setup.ts`, `tmp-idor-test.ts`, `tmp-idor-testdata.json` | ignored | 16 KB / 49 KB / 1 KB | One-off IDOR test scaffolding; 10 and 58 lines mention password/token/session | Safe to delete once someone has confirmed nothing in them is still needed. Treat them as sensitive until then |
| `results.json` | ignored | **157 MB** | k6 result dump | Safe to delete |
| `tsconfig.tsbuildinfo`, `tsconfig.verifytest.tsbuildinfo` | ignored | 224 KB / 193 KB | Compiler caches | Safe to delete |
| `-p` (empty directory) | not tracked | 0 | Accidental `mkdir -p` artefact | Safe to delete. In a shell, use `rmdir -- ./-p` |
| `playwright-report/` | not tracked | 525 KB | Old report; Playwright is not installed | Safe to delete |
| `postman_collection.json` | **tracked** | 14 KB | `{{placeholder}}` variables only; no JWT or bearer values | Keep or delete; no secret exposure |
| `next-env.d.ts` | tracked, modified | — | Next.js regenerated it (adds the `root-params.d.ts` import) | Commit it with the build-related changes |
| `.env` | ignored | — | **Production database URLs** (audit F-09/N2) | Move it out of the checkout before running any Prisma command (§2.5 step 0) |

**Deletions are left to the owner. Nothing above was deleted.**

### 1.4 Recommended commit structure

Run these on a new branch from the current one, so `hardening/production-readiness` remains a reference. Create one commit per group, **in this order**. Each commit must pass `npm run typecheck` on its own: the groups are ordered by dependency.

| # | Commit | Paths |
|---|---|---|
| 1 | `chore(deps): upgrade next, prisma, next-auth, pdfjs; drop unused deps` | `package.json`, `package-lock.json`, `.nvmrc`, `next-env.d.ts` |
| 2 | `feat(db): sessionVersion, trigram indexes, slug redirects, status history, notifications` | `prisma/schema.prisma`, `prisma/migrations/20261109120000_*`, `prisma/migrations/20261109130000_*`, `prisma/migrations/20261111090000_*`, `prisma.config.ts` |
| 3 | `feat(security): auth, sessions, tokens, rate limits, SSRF, URL validation, CV access` | `lib/auth*.ts`, `lib/security/**`, `lib/server/**`, `lib/rate-limit.ts`, `lib/redis.ts`, `lib/logger.ts`, `lib/env.ts`, `lib/email/**`, `lib/cv/**`, `lib/cv-parser.ts`, `lib/ai-*.ts`, `lib/job-scraper.ts`, `lib/supabase.ts`, `lib/utils.ts`, `lib/cache.ts`, `lib/validations/**`, `lib/application-status.ts`, `lib/candidate-profile-completeness.ts`, `lib/job-offers-utils.ts`, `lib/seo/**`, `instrumentation.ts`, `next.config.ts` |
| 4 | `feat(api): authorization, eligibility, status workflow, notifications, expiry cron` | `app/api/**`, `vercel.json` |
| 5 | `feat(ui): public caching, preview route, apply states, admin stats, a11y, contrast, SEO` | `app/(public)/**`, `app/(dashboard)/**` (including the moves into `(onboarded)` and the deletions), `app/*.tsx`, `app/sitemap.ts`, `app/robots.ts`, `app/{forgot-password,reset-password,verify-email,login,onboarding}/**`, `app/globals.css`, `components/**`, `hooks/**`, `public/brand/**` |
| 6 | `chore: remove dead code and stale scripts` | All remaining `D` entries (`tmp-dbcheck.ts`, `verify_seed.ts`, `inspect_trgm.js`, `tmp-verify/`, `summary.json`, `false))`, unused components) |
| 7 | `test: security, integration and journey tests; k6 target guard; seed guard` | `tests/**`, `prisma/seed.ts`, `prisma/seed-k6.ts`, `prisma/seed-guard.ts`, `eslint.config.mjs`, `lighthouserc.json` |
| 8 | `ci: quality gate and migration replay` | `.github/workflows/**` |
| 9 | `docs: readiness reports, operations runbook, README, CLAUDE.md` | `docs/**`, `README.md`, `CLAUDE.md`, `.env.example`, `.gitignore`, `scripts/ops/**`, `WORK_LOG.md` |

**Before committing:**
1. `git status --porcelain` must be empty after the last commit; no path should be forgotten.
2. Run `git diff --cached | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@|sk-[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{20,}|re_[A-Za-z0-9]{20,}"`. It must print nothing except the CI placeholder URLs (`placeholder:placeholder@127.0.0.1:9`, `ci:ci-only-password@127.0.0.1:5432`).
3. Re-run the full local gate on the final commit (README §6).

---

## 2. Migration review (nothing executed)

### 2.1 The three pending migrations

| # | Migration | SQL | Objects touched | Locks taken | Destructive? | Code dependency |
|---|---|---|---|---|---|---|
| M1 | `20261109120000_add_user_session_version` | `ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;` | `users` | Brief ACCESS EXCLUSIVE on `users`. A constant default is metadata-only on PG ≥ 11 (no table rewrite), **but the lock waits behind any long transaction and blocks queries meanwhile** | No | **Hard.** `lib/auth-user-record.ts` selects the column on every authenticated request: code deployed without M1 = total login outage |
| M2 | `20261109130000_restore_trigram_search_indexes` | `CREATE EXTENSION IF NOT EXISTS pg_trgm;` plus 5 × `CREATE INDEX IF NOT EXISTS … USING GIN (… gin_trgm_ops)` | `job_offers` (title, description, customLocation), `companies` (name, location) | **SHARE lock: blocks INSERT/UPDATE/DELETE** on `job_offers` and `companies` for each index build (not `CONCURRENTLY`). Reads continue | No (IF NOT EXISTS) | Soft: search works without it, just with sequential scans |
| M3 | `20261111090000_slug_redirects_status_history_notifications` | `CREATE TYPE "NotificationType"`; `CREATE TABLE` ×3 (`company_slug_redirects`, `application_status_history`, `notifications`); 4 indexes; 4 foreign keys | New tables only, plus FKs → `companies`, `applications`, `users` | Indexes on empty new tables: instant. `ADD CONSTRAINT … FOREIGN KEY` takes SHARE ROW EXCLUSIVE on the **referenced** tables (`users`, `applications`, `companies`) briefly; validation is instant (empty tables) | No | **Hard.** Application submit and status changes, the notifications API, and company saves (slug redirects) query these tables |

**Order:** Prisma applies by name, so M1 → M2 → M3. Each is independent of the others; M3 only needs base tables that existed long before.

**Statically verified (local):**
- The schema matches: `prisma validate` passes.
- M3 was generated by `prisma migrate diff` from the previous schema to the current one.
- `tests/security/launch-plan.test.ts` asserts M3 has no DROP, data rewrite or ALTER of existing tables, and that it is the last migration.
- `tests/security/migrations.test.ts` asserts that the 5 trigram indexes exist after a static replay of all migrations.

**Not verified:** M1–M3 (and the whole history) have **never been applied to a real PostgreSQL**.

**Supabase-specific risk for M2:** on Supabase, `pg_trgm` is often installed in the `extensions` schema. `CREATE EXTENSION IF NOT EXISTS` is then a no-op, and `gin_trgm_ops` resolves only if the migrating role's `search_path` includes `extensions`. Check this with the query in §3.1 before running M2.

### 2.2 Can migration replay run in CI against a disposable PostgreSQL?

**Yes, as written, but it has never run.** `.github/workflows/ci.yml` has a `migrations` job that:
1. starts a `postgres:16` service container (no secrets; loopback only; `pg_trgm` ships in the official image's contrib);
2. runs `prisma migrate deploy` on the empty database (the whole history of 30 migrations);
3. runs `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` (fails on drift);
4. asserts that at least 5 `*_trgm` indexes exist.

**Preconditions:**
- `ci.yml` is **untracked** today. It runs only after commit 8 (§1.4) is pushed (`push` on `hardening/**`, or a PR to `main`).
- CI-safety tests allow `migrate deploy` only against that loopback container.

**What it proves, and what it doesn't:**
- It proves the migration history replays cleanly and matches the schema.
- It does **not** prove production can apply M1–M3: production may have drifted. History shows earlier `db push` use, and the 27 historical migrations contain drops, renames and type changes. That is what the staging rehearsal and the §3.1 pre-checks are for.

**Possible failure on first run:** a historical migration that only ever worked on a database shaped by `db push`. If it fails, do not edit applied migrations. Record the failure and decide with the DB owner (baseline or `migrate resolve`).

### 2.3 Expected schema after M1–M3 (verification queries, read-only)

```sql
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;  -- every statement below is read-only
-- Run after migrate deploy (staging first). All SELECTs.
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;

-- M1
select column_name, data_type, is_nullable, column_default
from information_schema.columns where table_name='users' and column_name='sessionVersion';
-- expect: integer | NO | 0

-- M2
select indexname from pg_indexes
where indexname in ('idx_job_offers_title_trgm','idx_job_offers_description_trgm',
  'idx_job_offers_custom_location_trgm','idx_companies_name_trgm','idx_companies_location_trgm');
-- expect: 5 rows
select indexrelid::regclass, indisvalid from pg_index
where indexrelid::regclass::text like '%_trgm';
-- expect: all indisvalid = true

-- M3
select table_name from information_schema.tables
where table_name in ('company_slug_redirects','application_status_history','notifications');
-- expect: 3 rows
select enum_range(null::"NotificationType");
-- expect: {NEW_APPLICATION,APPLICATION_STATUS_CHANGED}
select conname, confdeltype from pg_constraint
where conrelid in ('company_slug_redirects'::regclass,'application_status_history'::regclass,'notifications'::regclass)
  and contype='f';
-- expect 4 rows: companyId c(ascade), applicationId c, changedById n (set null), userId c

-- History bookkeeping
select migration_name, finished_at, rolled_back_at, logs is not null as has_error
from "_prisma_migrations" order by started_at desc limit 5;
-- expect: the 3 new ones finished, not rolled back, no error
```

Then run: `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`. Exit 0 means no drift.

### 2.4 Staging migration procedure

**Preconditions**
- A staging database that is a **restored copy of production** (`scripts/ops/restore-test.sh`, A9), or at least the same migration history. An empty database only proves what CI proves.
- A separate env file, e.g. `.env.staging`, **outside** the repository.

**Steps**
0. `[RUN]` Move the production `.env` out of the checkout (§1.3). Then load only the staging file:
   ```bash
   set -a; . /secure/path/.env.staging; set +a
   node -e 'console.log(new URL(process.env.DIRECT_DATABASE_URL).host)'   # must print the STAGING host
   ```
   **Stop** if it prints the production host (`…hvbbactmgfhecqbetlhg…`).
1. `[RUN]` Pre-checks: §3.1 (migration state, column absent, extension schema, table sizes, long transactions).
2. `[RUN]` `npx prisma migrate status` must list exactly M1, M2 and M3 as pending. Staging is a different Supabase project, so the Gate 0 production guard does not apply and no override is needed. If the guard fires here, the loaded file is the production file: **stop**.
3. `[RUN]` `npx prisma migrate deploy`. Time it.
   - `[EVIDENCE]` the full output, and the duration per migration.
4. `[RUN]` Run the §2.3 verification queries and the drift diff.
   - `[EVIDENCE]` the outputs.
5. Deploy the release commit to the staging/preview environment (with staging credentials only). Run the §5 QA plan.
6. Record the timings. If M2 took more than a few seconds, plan for production to pre-create the indexes `CONCURRENTLY` (§2.5).

### 2.5 Production migration procedure

These steps need the release owner's **explicit approval**, in a low-traffic window.

1. Re-run §3.1 on production (read-only).
2. If `job_offers`/`companies` are large (staging M2 took longer than about 5 s), pre-create the trigram indexes outside Prisma.
   > ⚠️ **WRITE OPERATION: migration window only.** This is not one of the read-only checks in §3; it needs the release owner's explicit approval for the production migration window.
   ```sql
   CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_offers_title_trgm" ON "job_offers" USING GIN ("title" gin_trgm_ops);
   -- repeat for the other four; M2 then becomes a no-op
   ```
   Check `indisvalid` afterwards (§2.3). Drop and redo any invalid index.
3. Check for long transactions just before deploying:
   ```sql
   SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;  -- every statement below is read-only
   select pid, now()-xact_start as age, state from pg_stat_activity
   where datname = current_database() and xact_start < now() - interval '30 seconds';
   ```
   They must be absent, so M1's lock can't queue behind them.
4. `npx prisma migrate deploy` with the explicitly loaded production env file (same host-print guard as §2.4 step 0). Since Gate 0, `prisma.config.ts` **refuses the production database** unless the override is set **for that one command**:
   ```bash
   CXJOBS_ALLOW_PRODUCTION_DATABASE=I_UNDERSTAND_THIS_IS_PRODUCTION npx prisma migrate deploy
   ```
   Never export it in a shell profile or put it in any env file. The same override applies to the read-only `npx prisma migrate status` against production.
5. Run §2.3 on production.
6. **Then** deploy the code (Vercel). Never deploy the code first.
7. Run the smoke test (`PRODUCTION-READINESS-REPORT.md` §8).

### 2.6 Rollback and recovery plan

| Situation | Action |
|---|---|
| A migration fails mid-way | Prisma marks it failed and stops; later migrations don't run. Each migration file is sent as one multi-statement script, which PostgreSQL runs as one implicit transaction, so the failed file should leave no partial objects. **Confirm this on staging** by checking §2.3 after any failure. Fix the cause, then `npx prisma migrate resolve --rolled-back <name>` and re-run `deploy`. **Do not deploy the code.** |
| Code problem after deploy | **Vercel Instant Rollback (code only).** The old code ignores the new column and tables, so rollback is safe with the migrations left in place. |
| Must the migrations be reverted? | **Normally never.** All three are additive, and old code runs fine on the new schema. Revert only on a DB owner decision, **after** rolling back the code, in reverse order. ⚠️ **Emergency SQL: WRITE / DESTRUCTIVE**, only on the DB owner's decision. M3 `DROP TABLE notifications, application_status_history, company_slug_redirects; DROP TYPE "NotificationType";` (this **deletes** notifications, status history and slug redirects created since the deploy); M2 `DROP INDEX` ×5 (safe); M1 `ALTER TABLE users DROP COLUMN "sessionVersion"` (**only if no deployed code reads it**; otherwise it causes a login outage). Then `prisma migrate resolve --rolled-back <name>` for each. |
| Data damaged | Restore from the most recent **tested** backup (A9). This is why B7 must be done before the release. |

---

## 3. Production data checks (read-only SQL; not executed)

**Rules**
- Run only with the data owner's authorization, ideally as a read-only role, starting each session with `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;`.
- Run the **count** queries first. Run listing queries (which return personal data) only if a count is non-zero and someone is assigned to act on the result.

### 3.1 Migration state and pre-flight (B2)

```sql
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;  -- every statement below is read-only
select migration_name, finished_at, rolled_back_at from "_prisma_migrations" order by started_at desc limit 10;
select count(*) as applied from "_prisma_migrations" where finished_at is not null and rolled_back_at is null;
-- expect 27 applied (the 27 committed migrations; the repo has 30 including M1–M3); any mismatch = drift → stop and investigate

select count(*) from information_schema.columns where table_name='users' and column_name='sessionVersion';
-- expect 0 (if 1: the column was added by hand/db push; M1 would FAIL → resolve with the DB owner first)

select to_regclass('public.notifications'), to_regclass('public.company_slug_redirects'), to_regclass('public.application_status_history');
-- expect all NULL

select e.extname, n.nspname as schema from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname='pg_trgm';
show search_path;   -- as the role that will run migrate deploy; must include pg_trgm's schema

select indexname from pg_indexes where indexname like '%_trgm';

select relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) as size
from pg_stat_user_tables where relname in ('users','job_offers','companies','applications');
```

### 3.2 Duplicate emails ignoring case (B4 / A5)

```sql
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;  -- every statement below is read-only
-- counts only
select count(*) as duplicate_groups, coalesce(sum(n),0) as rows_involved
from (select lower(btrim(email)) k, count(*) n from users group by 1 having count(*) > 1) d;   -- expect 0

select count(*) filter (where email <> lower(email)) as mixed_case_rows,
       count(*) filter (where email <> btrim(email)) as whitespace_rows
from users;

-- listing (personal data; only if the first count > 0)
select lower(btrim(email)) as email_key, count(*) n,
       array_agg(id order by "createdAt") ids, array_agg(role::text order by "createdAt") roles,
       array_agg(("passwordHash" is not null) order by "createdAt") has_password
from users group by 1 having count(*) > 1;
```

The application refuses to guess between such accounts, so affected users cannot log in or reset their password until a person resolves each group. **Never merge accounts automatically.**

### 3.3 Existing test / seed accounts (B5 / N1)

```sql
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;  -- every statement below is read-only
-- old seed (real-looking gmail addresses) AND new seed (reserved .test domain)
select case when email ~ '@gmail\.com$' then 'old-gmail' else 'cxjobs.test' end as kind,
       role, count(*) n, count(*) filter (where "isActive") active,
       min("createdAt") first_created, max("createdAt") last_created
from users
where email ~ '^user([1-9]|[1-9][0-9]|100)@gmail\.com$'
   or email ~ '^(candidate([1-9]|[1-9][0-9]|100)|company[1-5])@cxjobs\.test$'
group by 1, 2;   -- expect 0 rows in production

select status, count(*) from job_offers where slug like 'k6-test-job-%' group by status;  -- expect 0
select count(*) from companies where slug like 'k6-test-company-%';                         -- expect 0
select count(*) from applications a join candidates c on c.id = a."candidateId"
join users u on u.id = c."userId" where u.email ~ '^user([0-9]+)@gmail\.com$';           -- expect 0
```

- A `userN@gmail.com` row **may belong to a real person**. Compare its `createdAt` with the seed run dates before acting.
- Remediation is a separate, approved write: deactivate the accounts, bump `sessionVersion`, and unpublish the `k6-test-*` jobs. It is **not part of this plan's execution.**

### 3.4 CV storage objects and bucket configuration (B3 / S6)

```sql
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;  -- every statement below is read-only
select id, name, public, file_size_limit, allowed_mime_types from storage.buckets order by id;
-- expect: cv.public = false; avatars/logos/covers/culture-images/blog-images public = true

select relrowsecurity from pg_class where oid = 'storage.objects'::regclass;   -- expect true

select policyname, roles, cmd, qual, with_check from pg_policies
where schemaname = 'storage' and tablename = 'objects';
-- expect: NO policy granting anon/authenticated SELECT on bucket 'cv'
-- (the app reaches CVs only through the service role + 60 s signed URLs)

select count(*) as cv_objects, pg_size_pretty(sum((metadata->>'size')::bigint)) as total_size,
       min(created_at), max(created_at)
from storage.objects where bucket_id = 'cv';

-- objects whose first path segment is not a user id (legacy/unexpected layout)
select count(*) from storage.objects
where bucket_id = 'cv' and split_part(name, '/', 1) !~ '^[0-9a-f-]{36}$';

-- DB rows still holding a full URL instead of an object path (legacy)
select count(*) filter (where "resumeUrl" ~ '^https?://') as candidate_url_rows from candidates;
select count(*) filter (where "cvUrl" ~ '^https?://')     as application_url_rows from applications;
select count(*) filter (where "cvUrl" ~ '/object/public/cv/') as public_cv_links from applications;  -- expect 0
```

**External probe (no SQL).** Take one existing object path and request `https://<project>.supabase.co/storage/v1/object/public/cv/<path>` from a logged-out browser. It must return **400/404, never the file**. `[EVIDENCE]` the HTTP status (not the file).

### 3.5 Integrity of the new tables (run after M3, and again after a day of traffic)

```sql
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;  -- every statement below is read-only
-- Every application has at least its initial history row (only for applications created AFTER deploy;
-- older ones legitimately have none)
select count(*) from applications a
where a."createdAt" > '<deploy-timestamp>'
  and not exists (select 1 from application_status_history h where h."applicationId" = a.id);   -- expect 0

-- History is consistent with the current status
select count(*) from applications a
join lateral (select "toStatus" from application_status_history h
              where h."applicationId" = a.id order by h."createdAt" desc limit 1) last on true
where last."toStatus" <> a.status;   -- expect 0

-- No forbidden transition recorded
select count(*) from application_status_history
where ("fromStatus" = 'REFUSE' and "toStatus" in ('EMBAUCHES','ENTRETIEN'))
   or ("fromStatus" = 'NOUVEAU' and "toStatus" = 'EMBAUCHES')
   or ("toStatus" = 'NOUVEAU' and "fromStatus" is not null);   -- expect 0

-- Slug redirects never shadow a live slug, and never point to a deleted company
select count(*) from company_slug_redirects r join companies c on c.slug = r.slug;   -- expect 0
select count(*) from company_slug_redirects r join companies c on c.id = r."companyId"
where c."deletedAt" is not null;   -- informational

-- Notifications only for existing users; unread backlog per type (no content selected)
select type, count(*) total, count(*) filter (where "readAt" is null) unread from notifications group by type;
```

---

## 4. External services: verification instructions

Every item uses staging first. Production only after the staging evidence exists.

### 4.1 Email delivery and password reset (B6 / F2 / A8)

1. **Resend:** add the sending domain and publish the SPF and DKIM records. The Resend dashboard must show the domain as **Verified**. `[EVIDENCE]` a screenshot.
2. Staging environment variables: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` (staging key), `EMAIL_FROM` (on the verified domain), `APP_URL=https://<staging host>`. The startup log must show **no** "Environment configuration warning" for these names.
3. Forgot password for a staging test account → the email arrives.
   - The link host equals `APP_URL`, and the token is in the **fragment** (`#token=…`).
   - `[EVIDENCE]` the link host and path only, never the token.
4. Follow the link and set a new password. The new password works, the old one fails, and reusing the link fails. A session open in a second browser is signed out on its next request.
5. Register a new address, receive the verification email, confirm it. `users."emailVerified"` gets set (check it read-only).
6. Search the Vercel logs for `token=` over the test window: **0 hits**.
7. Keep `REQUIRE_EMAIL_VERIFICATION=false` in production until steps 1–6 pass and there is a plan for existing unverified users.

### 4.2 Vercel `CRON_SECRET` and the scheduled run (B8 / A2)

1. Vercel → Project → Settings → Environment Variables: add `CRON_SECRET` (random, ≥32 characters, e.g. `openssl rand -base64 32`), scoped to **Production** (and Preview only if crons should run there). Redeploy.
2. Vercel → Settings → **Cron Jobs** must list `/api/job-offers/expire` with schedule `0 2 * * *`. Crons run only on **production** deployments.
3. On staging/preview, without the header: `curl -i https://<host>/api/job-offers/expire` must return **401** (or 503 if `CRON_SECRET` is unset there).
4. Use the **Run** button in the Cron Jobs page, or wait for 02:00 UTC. The function log must show `200` with `{"data":{"closedCount":N}}`.
   - `[EVIDENCE]` the log line and timestamp.
5. Functional check on staging: create a published job with an expiry date in the past (staging only). After the run, its status is `CLOSED` and it has disappeared from `/jobs` and the company page.
6. Alerting: a failure logs `Auto-close expired offers failed`, and an unset secret logs `Scheduled job expiry is disabled`. Both must match a log alert rule (4.5).

### 4.3 Off-site backup configuration (B7 / A9)

1. Create a **read-only** database role for backups; store its URL only in the backup runner's secret store.
2. Create a private bucket at a second provider with versioning or object lock and a lifecycle rule (e.g. 30 daily, 12 monthly). Keep an `age` key pair, with the private key offline.
3. Schedule `scripts/ops/backup-db.sh` (daily) and `scripts/ops/backup-storage.sh` (daily; the `cv` bucket must be copied into an encrypted destination).
4. `[EVIDENCE]` the first successful run: a listing of the backup objects in the off-site bucket (names, sizes, dates), and the script output showing "uploaded to off-site storage" and **no** "NOT off-site" warning.

### 4.4 Restore test (B7)

1. Create a disposable PostgreSQL (local Docker or a throwaway Supabase project), **never production**.
2. `RESTORE_DATABASE_URL=<disposable> RESTORE_CONFIRM_HOST=<its host> AGE_IDENTITY_FILE=<key> scripts/ops/restore-test.sh <latest dump>`.
3. Compare the printed counts (users, companies, job_offers, applications, migrations) with the production counts taken read-only at the dump time. A small drift is expected from traffic after the dump.
4. `[EVIDENCE]` the date, the dump name and both sets of counts, recorded in `docs/OPERATIONS.md` §1.3. Then destroy the disposable database (it contains personal data).

### 4.5 Uptime monitoring and alert delivery (B7)

1. Create an external monitor on `GET https://<prod host>/api/health` at a 1–5 min interval. Alert on non-200 or a timeout. The endpoint allows 30 requests/min per IP, which is enough for one monitor.
2. Route alerts to at least two people (email and chat).
3. **Alert test:** point a second, temporary monitor at a URL that returns 404 (e.g. `/api/health-does-not-exist`), or use the provider's "send test alert". Confirm both people received it, then delete the temporary monitor. `[EVIDENCE]` the received alert.
4. **Error hook:**
   1. Set `ERROR_ALERT_WEBHOOK_URL` (an https chat webhook) on a **throwaway preview** with an intentionally unreachable `DATABASE_URL`.
   2. Open `/companies/<any-slug>` (renders a 500).
   3. Expect one message "CXJobs server error: … on GET /companies/[slug]" with no personal data.
   4. Delete the preview.
   5. Then set the variable on production.
5. **Log drain (recommended):** Vercel → a log service, with alert rules on: `Unhandled server error`, `Rate limiter backend error`, `Database pool error`, `Auto-close expired offers failed`, `Scheduled job expiry is disabled`.

---

## 5. Manual QA test plan

Use a **staging** environment only, with staging credentials and staging test accounts (seeded with `SEED_TEST_PASSWORD`, never the old shared password).

**Devices**
- **D1:** desktop Chrome, 1440×900.
- **D2:** desktop Firefox or Safari.
- **M1:** a real phone (iOS Safari or Android Chrome, ~390 px wide).
- Every case runs on D1 and M1; cases marked ★ also run on D2.

**Recording:** pass/fail, device, date, tester; attach a screenshot for every fail.

| ID | Area | Steps | Expected result |
|---|---|---|---|
| **C1** ★ | Candidate registration | Register with `Mixed.Case@<test-domain>` and a strong password | Generic success message; account stored lowercase; verification email arrives (once email works) |
| C2 | Duplicate registration | Register again with `mixed.case@…` | Same generic response; no second account; an "account exists" email arrives |
| C3 ★ | Login | Log in using a different letter case; then use a wrong password 3× | Login succeeds. Wrong password gives a generic error; repeated failures are eventually rate-limited (message, not a crash) |
| C4 | Google sign-in | Sign in with a Google test account | Becomes a CANDIDATE; lands on onboarding or the dashboard |
| C5 | Session revocation | Reset the password in browser A while signed in on browser B | Browser B is signed out on its next action |
| **K1** ★ | Company invitation | Admin creates an invitation (Tokens page) and copies the link; open it logged out | Registration form pre-filled for the company. Used, revoked or expired links are refused |
| K2 | Company registration | Complete registration from the link, then onboarding | Lands on the company dashboard; the role is COMPANY |
| K3 | Invite-only enforcement | Use `/register` normally | Only a candidate account can be created; there is no company option |
| **P1** ★ | Company profile | Change only the logo, save; reload; then change only the description | Every other field (website, location, size, benefits) unchanged after each save |
| P2 | Profile image hosts | Try to save a logo URL from another site (via devtools) | Rejected with a message; nothing saved |
| P3 | Slug change | Change the company page address; open the old `/companies/<old>` | Permanently redirects to the new address. Another company cannot take the old slug |
| P4 | Public refresh | After P1, open the public company page and one of its job pages | The new logo and description show immediately (no 5–10 min delay) |
| **J1** ★ | Job creation | Create an INTERNAL job (salary min > max first, then valid); publish | The invalid salary is refused; the valid job publishes and appears on `/jobs` |
| J2 | External job | Create an EXTERNAL job without a URL, then with a URL | Refused without a URL. With one, the job page shows the external link and no internal apply |
| J3 | Edit / close | Edit the title; then close the job | The title changes on the public page at once; the closed job disappears from `/jobs` and the company page at once |
| J4 | Benefits | Attach a benefit to a job, then save the company profile twice | The job still shows the benefit |
| **S1** ★ | Listing and search | On `/jobs`: keyword "sales" + city "Tunis"; apply filters; copy the URL into a new window | Only Tunis sales jobs. The shared URL reproduces the results. Removing a filter chip updates the URL |
| S2 | Homepage search | Search from the homepage hero; click the "Remote" tile | Lands on `/jobs` with the filters applied |
| S3 | Hidden jobs | Open the URL of a draft, an expired and a deleted job while logged out | Branded 404 for each |
| **V1** | Preview authorization | Logged in as the owning company, open `/jobs/<draft-slug>/preview` | The draft is shown, without apply actions |
| V2 | Preview: other company | As another company, open the same preview URL | Redirected to the public page, which is a 404 |
| V3 | Preview: applicant | As a candidate who applied, after the job is closed, open the job from "My applications" | Read-only view; no apply button |
| V4 | Preview: anonymous | Logged out, open a preview URL | Sent to login, then back to the preview after signing in |
| **A1** ★ | Apply | Candidate with a complete profile applies with a cover letter | Success screen; the application is listed under "My applications" |
| A2 | Incomplete profile | Candidate without a phone number opens Apply | "Complete your profile" screen naming the missing fields; the API also refuses (devtools POST returns 400 `PROFILE_INCOMPLETE`) |
| A3 | Login from apply | Logged out, click Apply | Login page, then back to the **same** job's apply page |
| **A4** ★ | Duplicate prevention | Re-open Apply for the same job; also re-send the POST from devtools | Page loads straight into "You already applied". The API returns 409 `DUPLICATE_APPLICATION`; there is no second row |
| A5 | Closed job | Apply page open → the company closes the job → submit | Inline message "no longer accepting applications"; the form stays on screen |
| **T1** ★ | Status transitions | Company: New → In Review → Interview → Hired | Each step saves; the status dropdown only offers allowed moves |
| T2 | Forbidden transition | Set an application to Rejected; try Hired (devtools PUT) | The UI does not offer it; the API returns 409 `INVALID_STATUS_TRANSITION` |
| T3 | Concurrent edits | Two company tabs change the same application at the same moment | One succeeds; the other shows "updated by someone else" |
| T4 | Notes privacy | The company writes notes; the candidate opens the application (check the network tab) | No `notes` field anywhere in the candidate's responses |
| **N1** | Notifications: company | The candidate applies | The company bell shows an unread count; the item links to the job's applications |
| N2 | Notifications: candidate | The company changes the status | The candidate bell shows "Application update…"; "Mark all as read" clears the count |
| N3 | Notifications: isolation | Candidate B checks the bell | Sees none of candidate A's notifications |
| **F1** ★ | CV upload | Upload a PDF, a DOCX, a renamed `.exe→.pdf`, an SVG and a >5 MB file | PDF and DOCX are accepted; the other three are rejected with a message |
| F2 | CV download: owner | The candidate clicks "View CV" | Opens. The same signed link fails after about 60 s |
| F3 | CV download: company | The applied-to company downloads the CV; another company tries `/api/application/<id>/cv` | Applied-to company: works. Other company: 404 |
| F4 | CV download: anonymous | Paste a CV link in a logged-out browser | Does not open (401 or expired) |
| **D1** | Admin statistics | Admin → Statistics | Live counts. Spot-check two numbers against read-only SQL. No placeholder text |
| D2 | Admin access | A candidate or company opens `/dashboard/admin/stats` | Redirected away |
| **I1** | AI quota | Staging `AI_DAILY_QUOTA=2`: generate a job description 3 times (company) | The 3rd attempt shows the daily-limit message (429). The next day it works again |
| I2 | AI failure | On a throwaway preview with an invalid `OPENAI_API_KEY`: generate once, then fix the key | A clean error message, no crash. The failed attempt did not use up the quota |
| I3 | AI timeout | (If a slow provider can be simulated) | Fails cleanly in under 30 s with "took too long" |
| I4 | CV parse quota | Exhaust the quota, then upload a CV during onboarding | The CV is still parsed (basic mode); onboarding continues |
| **L1** | Layout: mobile | On M1, walk through `/`, `/jobs` (filters), a job page, Apply, both dashboards and the notification bell | No horizontal scroll; menus and filters usable; buttons reachable; bell menu fits the screen |
| L2 ★ | Layout: desktop | On D1/D2, the same pages | No overlap; long titles wrap |
| L3 | Keyboard and screen reader | Tab through the filters, Apply and the bell; use VoiceOver or NVDA on the filters and icon buttons | Visible focus. Every icon button and filter is announced by name; the results count is announced |
| L4 | Errors and loading | Open an unknown URL; throttle the network to "Slow 3G" | Branded 404; branded loading state; no raw error text |

**Exit criterion:** every case passes on D1 and M1, plus the ★ cases on D2. Any failure → fix → re-test that case and its neighbours.

---

## 6. Final release matrix

**Owners** are roles to be named by the team; no names are known from the repository.

**Status values**
- *Not started*: the action has not been done.
- *Pending evidence*: the action may have been done, but no evidence is on file.
- *Done*: evidence is attached and linked.

None is Done.

| ID | Blocker | Owner (assign) | Required action | Evidence required | Environment | Risk if skipped | Status | Blocks deploy? |
|---|---|---|---|---|---|---|---|---|
| B0 | Production credentials in the developer `.env` | Release owner | Move them out of the checkout; use an explicitly loaded env file per environment (§2.4 step 0) | `.env` no longer contains production hosts (host-print check) | Developer machines | Accidental `migrate dev` / `db push` / seed against production (data loss) | Not started | **Yes**: precondition for B2 |
| B1 | Work is uncommitted | Release owner | Commit per §1.4, push the branch, open a PR, CI green (`quality` **and** `migrations` jobs) | PR link with green checks; secret scan of the staged diff is clean | GitHub | Deploying from Git ships none of the fixes | Not started | **Yes** |
| B2 | M1–M3 not applied | DB owner | §3.1 pre-checks → staging rehearsal (§2.4) → production (§2.5), migrations **before** code | `migrate status` "up to date" (staging and production); §2.3 outputs; timings | Staging, then production | M1 missing = total login outage; M3 missing = apply, status changes and notifications fail | Not started | **Yes** |
| B3 | CV bucket privacy unverified | DB/storage owner | Run §3.4; if `cv` is public or policies leak, make it private (separately approved change) | `cv.public=false`; no permissive policy; public-URL probe returns 400/404 | Production (read-only) | Every candidate CV publicly downloadable (GDPR-class incident) | Not started | **Yes** |
| B4 | Possible duplicate emails | DB owner + support | Run §3.2; resolve groups manually | Count = 0, or every group has a documented resolution | Production (read-only, then approved fixes) | Affected users locked out (login and reset) | Not started | **Yes** (if count > 0) |
| B5 | Seed or test accounts with the old shared password | DB owner | Run §3.3; deactivate the accounts, bump `sessionVersion`, unpublish `k6-test-*` (approved write) | Counts = 0 or all inactive; k6 cookie files deleted | Production | Known password = account takeover; fake jobs visible | Not started | **Yes** (if count > 0) |
| B6 | Email not delivered | Infra owner | §4.1 on staging, then set production variables | Domain verified; reset and verify emails received; link uses `#token=` on the right host; no token in logs | Staging → production | Password reset and verification impossible; support load | Not started | **Yes** (account recovery is a launch requirement) |
| B7 | No backups, restore test or alerting | Infra owner | §4.3, §4.4, §4.5 | Off-site backup listing; restore-test output recorded; test alert received; health monitor active | Production + disposable DB | Unrecoverable data loss; outages unnoticed | Not started | **Yes** (backup + restore); monitoring could follow within 24 h only by explicit owner decision |
| B8 | Nightly expiry not scheduled | Infra owner | §4.2 | Cron listed; a successful run logged; 401 without the header | Production | Expired jobs keep status PUBLISHED (hidden by the date filter, but counts are wrong) | Not started | No (readers already hide expired jobs); must be done in the deploy window |
| B9 | Manual QA | QA owner | §5 on staging | Signed checklist with device, date and tester; fails linked to fixes | Staging | Broken journeys reach users | Not started | **Yes** |
| D1 | Company sign-up policy (F1) | Product owner | Decide invite-only vs open | A written decision | — | — | Open decision | No (invite-only is the safe default and is what ships) |
| R1 | Full CSP is Report-Only (A3) | Engineering | Check the staging console for CSP violations during §5; enforce afterwards | Zero violations across the QA run | Staging | Weaker XSS defence-in-depth | Not started | No |
| R2 | `lower(email)` unique index (A5) | DB owner | After B4 = 0, add the index in a new migration | Migration applied | Production | New duplicates are already prevented by code; legacy only | Not started | No |
| R3 | F-33 flaky timing test | Engineering | Make the PDF-worker responsiveness test load-tolerant | 10 consecutive green CI runs | CI | CI noise | Not started | No |
| R4 | Lost edits in the 2 deleted files (§1.2) | Release owner | Decide: accept the loss, or restore the HEAD versions | A written decision | — | None for runtime (dead code) | Open decision | No |

**GO criterion:** every row with "Blocks deploy? = Yes" is *Done*, with its evidence linked here.

**Then:** deploy, run the smoke test (report §8), and watch the logs for 30 minutes.

---

*This plan changed no code, configuration, data or infrastructure. It was prepared without committing, pushing, deploying, migrating or deleting anything.*

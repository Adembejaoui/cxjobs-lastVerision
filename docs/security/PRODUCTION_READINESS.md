# CXJobs — Production readiness checklist (security)

Everything here is **read-only verification** or **configuration you apply
yourself**. Nothing in this document has been executed against production.

---

## 1. Database migration (required BEFORE deploying this code)

The session-revocation fix adds one column. The migration is additive and
backward compatible (old code ignores the column; existing rows get `0`, which
matches every existing session token).

```
prisma/migrations/20261109120000_add_user_session_version/migration.sql
  ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
```

Order:

1. Apply to a staging/branch database first: `npm run db:migrate:deploy`
   (with `DATABASE_URL` / `DIRECT_DATABASE_URL` pointing at staging).
2. Deploy the code to staging and run the smoke tests in §6.
3. Apply to production, **then** deploy the code. Deploying the code before
   the column exists makes every authenticated request fail (the user lookup
   selects `sessionVersion`).

### Rollback procedure

Roll back **code**, never the column.

| Situation | Safe action |
|---|---|
| New code misbehaves after deploy | Vercel → Deployments → previous deployment → *Instant Rollback*. The old code never reads `sessionVersion`, so it runs unchanged against the migrated table. Leave the column in place. |
| Migration applied, code not yet deployed | Nothing to do. The column is inert for the old code. |
| You must remove the column (e.g. abandoning the feature) | 1) Roll the code back first and confirm no deployment that reads `sessionVersion` is serving traffic (production **and** preview aliases pointing at this DB). 2) Only then run `ALTER TABLE "users" DROP COLUMN "sessionVersion";` and delete the migration folder in a follow-up commit (or add a new down-migration), so `prisma migrate` history stays consistent. |

Why the column must not be dropped while the new code is live:

- `lib/auth-user-record.ts` selects `sessionVersion` on every authenticated
  request and inside the Auth.js jwt callback. If the column disappears, every
  query fails: Auth.js treats the failure as an invalid session and clears the
  cookie (everyone is signed out) and API routes return 500. It fails closed,
  but it is a full outage.
- Re-adding the column later resets every user to `0`. Tokens minted with a
  higher `sv` then mismatch the DB value and are rejected (another mass
  sign-out). Again safe, but disruptive.
- The Redis keys `session-version:<userId>` hold versions > 0 for revoked
  users; after a drop + re-add, those keys reject fresh logins (sv = 0 < published)
  until they expire (≤ 30 days). If you ever drop and re-add, also delete
  `session-version:*` keys in that Upstash database.

Verification query after applying (staging and production):

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name = 'users' and column_name = 'sessionVersion';
-- EXPECT: sessionVersion | integer | NO | 0
```

---

## 2. CV bucket privacy — SQL to run in the Supabase SQL Editor

Run in the **production** project (Dashboard → SQL Editor → New query). All
statements are `SELECT`s; they change nothing and print no secrets or CV
contents (only counts and policy definitions).

```sql
-- 2.1 The CV bucket must exist and must NOT be public.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'cv';
-- EXPECT: exactly one row, public = false.

-- 2.2 Row-level security must be enabled on storage.objects.
select relrowsecurity as rls_enabled
from pg_class
where oid = 'storage.objects'::regclass;
-- EXPECT: true.

-- 2.3 No storage policy may grant anon/authenticated access to CV objects.
-- The app reads CVs only with the service-role key (bypasses RLS) and hands
-- out 60-second signed URLs after its own authorization check, so the
-- correct result here is ZERO rows mentioning the cv bucket.
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename  = 'objects'
  and (coalesce(qual, '') ilike '%''cv''%' or coalesce(with_check, '') ilike '%''cv''%'
       or qual is null);
-- EXPECT: no row referencing bucket_id = 'cv'. Rows with qual IS NULL apply
-- to ALL buckets — inspect them carefully (they should not exist either).

-- 2.4 How CV references are stored (counts only, no values).
select
  count(*) filter (where "resumeUrl" is null)                              as no_cv,
  count(*) filter (where "resumeUrl" like '%/object/public/cv/%')          as public_url_refs,  -- EXPECT 0
  count(*) filter (where "resumeUrl" like '%/object/sign/cv/%')            as legacy_signed_url_refs,
  count(*) filter (where "resumeUrl" is not null and "resumeUrl" not like 'http%') as object_path_refs
from candidates;

select
  count(*) filter (where "cvUrl" like '%/object/public/cv/%')              as public_url_refs,  -- EXPECT 0
  count(*) filter (where "cvUrl" like '%/object/sign/cv/%')                as legacy_signed_url_refs,
  count(*) filter (where "cvUrl" is not null and "cvUrl" not like 'http%') as object_path_refs
from applications;
```

Interpretation:

| Result | Meaning | Action |
|---|---|---|
| `public = true` in 2.1 | Every CV is world-readable by URL | **Stop.** Make the bucket private (Storage → cv → Edit → uncheck *Public*). Requires your approval; app code already works with a private bucket. |
| Policy rows in 2.3 for `cv` | Logged-in or anonymous Supabase clients can list/read CVs directly | Drop those policies after review. |
| `public_url_refs > 0` in 2.4 | Old rows stored public URLs | Still served correctly (the app re-derives the object path and signs it); the stored value itself is no longer a working link once the bucket is private. |
| `legacy_signed_url_refs > 0` | Old rows stored 1-hour signed URLs (long expired) | Compatible: the app parses them back to the object path. No action needed. |

Verified in the connected **cxjobs-test** project: `cv` bucket `public = false`.
The production project referenced by the local `.env` was **not** queried.

---

## 3. Vercel environment variables

Set per environment (Production / Preview). Names only — never paste values
into tickets or chat. Variable names are the ones the code actually reads
(note: the code uses `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`,
not `REDIS_URL` / `REDIS_TOKEN`).

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL`, `DIRECT_DATABASE_URL` | yes | Separate Preview DB (never production data in Preview). |
| `AUTH_SECRET` | yes | `openssl rand -base64 32`. Distinct per environment. Rotating it signs everyone out. |
| `NEXT_PUBLIC_APP_URL` | yes | `https://…` canonical origin. |
| `APP_URL` | recommended | Base for emailed links; https. Falls back to `NEXT_PUBLIC_APP_URL`. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | **yes in production** | Without them the app refuses to start (`NODE_ENV=production`). Use a separate Upstash DB for Preview. |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | yes | Service-role key is server-only; never prefix it with `NEXT_PUBLIC_`. |
| `INVITATION_TOKEN_ENCRYPTION_KEY` | yes | 32 bytes base64. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | if Google login enabled | Redirect URI `https://<domain>/api/auth/callback/google`. |
| `OPENAI_API_KEY` | if AI features enabled | |
| `EMAIL_PROVIDER` | yes for email | `resend` to send; default `disabled` sends nothing. |
| `RESEND_API_KEY` | if `EMAIL_PROVIDER=resend` | Sending-only API key, restricted to the CXJobs domain. |
| `EMAIL_FROM` | if `EMAIL_PROVIDER=resend` | Sender on a domain verified in Resend (SPF + DKIM set). |
| `REQUIRE_EMAIL_VERIFICATION` | no (default `false`) | Turn on only after email delivery is verified in production. |
| `VERCEL` | set by Vercel | Enables trusted `x-real-ip` for rate-limit keys. Do not set manually elsewhere. |

### Redis behaviour summary

| Situation | Behaviour |
|---|---|
| Production, Upstash env missing | Process refuses to start (no silent bypass). |
| Development, Upstash env missing | Per-process in-memory limiter (real limits, not shared). |
| Redis reachable | Atomic fixed window: one `EVAL` (INCR + first-hit PEXPIRE + PTTL) per key. |
| Redis error / 5xx / wrong token | Request **rejected** (fail closed) with 429. |
| Redis hanging | Bounded to 1.5 s, then fail closed. |
| Session-revocation lookup fails | Treated as "unknown"; DB re-read (≤15 min) still enforces revocation. |

Limits in force: login 30/15 min per IP + 10/15 min per account; forgot-password
3/min per IP + 5/h per email; verification resend 3/min per IP + 5/h per email;
reset 5/min per IP; scrape 5/min per user + 10/min per IP; AI generate 5/min per
user + 10/min per IP; CV parse 5/min per user + 10/min per IP; CV download
60/min per user.

A one-off check against a **dedicated test** Upstash database is recommended
(the integration tests use the real `@upstash/redis` client against a local
fake of the REST API; they do not execute the Lua script inside real Redis).

---

## 4. Email delivery (Resend)

1. Create a Resend account, add and verify the sending domain (SPF, DKIM,
   ideally DMARC `p=quarantine`).
2. Create a **sending-only** API key restricted to that domain.
3. Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` in
   **Preview** first; trigger forgot-password for a test inbox you control.
4. Confirm the link host is your domain, the link works once, and a second
   use fails.
5. Only then set the same in Production.
6. **Before** ever setting `REQUIRE_EMAIL_VERIFICATION=true`: every account
   created before this release has `emailVerified = NULL` (registration never
   set it). Enabling the flag signs all of them out and blocks their login.
   Decide first: backfill (`UPDATE users SET "emailVerified" = now() WHERE
   "passwordHash" IS NOT NULL AND "emailVerified" IS NULL AND "createdAt" < <release time>`)
   or a verification campaign. Check the count first:
   `select count(*) from users where "emailVerified" is null;`

Properties: links are built only from configuration (Host-header injection
cannot redirect them); the token is carried in the URL **fragment**
(`/reset-password#token=…`), which browsers never send to the server, so it
cannot appear in Vercel/CDN access logs or Referer headers — the page reads
it client-side and POSTs it in the body (legacy `?token=` links still work);
registration answers identically for new and existing addresses and emails
the existing owner a token-free "account already exists" notice (5/h per
address); tokens are 256-bit, stored as SHA-256, single use;
reset links expire in 1 h, verification links in 24 h; account-dependent work
and the provider call run after the response (`after()`), so neither body nor
timing reveals whether an account exists; provider errors are logged by
status/class only.

---

## 5. Session revocation

`users.sessionVersion` is incremented (inside the same transaction) on password
reset, admin suspension and admin email change, then published to Redis.
Each server render does one bounded Redis GET (deduplicated per request with
React `cache`); a newer published version rejects the token immediately.
Publishing is an atomic Lua compare-and-set (`PUBLISH_MAX_LUA`), so concurrent
revocations can never leave a lower version in Redis. If Redis is unavailable, the jwt callback's DB re-read
(every 15 minutes, previously 60 and effectively never — see report) rejects it.
No role-change or account-deletion endpoint exists today; any future one must
call `bumpSessionVersion(tx, userId)` + `publishSessionVersion(...)`.

---

## 6. Known infrastructure issue — CV watermark points into the `cv` bucket

`components/cv/pdf-download-button.tsx` loads its watermark from
`https://hvbbactmgfhecqbetlhg.supabase.co/storage/v1/object/public/cv/logo%20cxjob.png`.
A `/object/public/` URL only works if the **production `cv` bucket is public**.
Run §2.1 against production:

- If `public = true`: CVs are world-readable by URL today. Copy the logo to a
  public image bucket (e.g. `logos`), update that constant, **then** make `cv`
  private (Storage → cv → uncheck *Public*). Requires approval.
- If `public = false`: the watermark is already broken; move the logo the same
  way.

## 7. Post-deploy smoke tests (staging first)

- Log in as candidate / company / admin.
- Upload a CV, view it from the profile, open it as the recruiter (link must
  302 to a `…/object/sign/cv/…` URL and expire after 60 s).
- Forgot-password → email → link has `#token=` (not `?token=`) → reset → old session signed out.
- Register with an already-registered address → same response as a new one; owner receives the notice.
- CV parse with a real multi-page PDF (exercises the pdf.js worker thread on Node 22).
- Suspend a test user as admin → that user's next request is signed out.
- Hit login with wrong passwords 11× → `rate_limited`.

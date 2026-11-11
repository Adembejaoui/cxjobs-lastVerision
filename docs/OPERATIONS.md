# CXJobs operations runbook

Launch plan item **A9** (backups, monitoring, alerting, server hygiene), adapted to the hosting this repository actually uses.

> **Hosting reality check (11 Nov).** The launch plan says "we now self-host on a VPS (PR #9)". This repository has no PR #9: `git ls-remote` shows no pull-request refs at all, and there is no `deploy/` directory, Dockerfile or server config. The code deploys to **Vercel** (commit `60004c0 deploy vercel`). It uses **Supabase** for Postgres and file storage (`lib/supabase.ts`) and **Upstash** for Redis.
>
> This runbook covers that stack. If the team really moved to a VPS in another repository, the VPS checklist in section 5 applies there, and this repository's storage code would need porting first.

Everything below marked **[TODO-OWNER]** needs an account, a credential or an infrastructure change that cannot be made from the repository. Nothing here has been run against production.

---

## 1. Backups

### 1.1 Database (daily, off-site)

Supabase's own daily backups live in the same provider account. They do not count as "off-site".

- **Script:** `scripts/ops/backup-db.sh`.
- **What it does:**
  1. `pg_dump --format=custom` through a read-only role.
  2. Checks that the archive is readable.
  3. Encrypts it with `age` (optional).
  4. Uploads it with `rclone` to storage at another provider.
  5. Prunes local copies.
- **Schedule:** run it daily from a machine you control, or from a scheduled CI job that holds `BACKUP_DATABASE_URL` as a secret. That needs an explicit decision: the CI workflows deliberately hold **no** production secrets today (tests in `tests/security/ci-workflows.test.ts` enforce this).
- **[TODO-OWNER]** Set up the backups:
  1. Create a read-only Postgres role.
  2. Create a private bucket at a second provider (e.g. Backblaze B2 or AWS S3), with a lifecycle rule (e.g. 30 daily + 12 monthly).
  3. Generate an `age` key pair, and keep the private key offline (password manager or hardware).
  4. Schedule the script.

### 1.2 Files (CVs and images)

- **Script:** `scripts/ops/backup-storage.sh`. It runs `rclone sync` from Supabase's S3-compatible endpoint into a dated, versioned copy at the second provider.
- **The `cv` bucket holds personal data.** The destination must be private and encrypted (rclone `crypt` remote, or server-side encryption).
- **[TODO-OWNER]** Create Supabase S3 access keys (Storage → S3 connection) and the rclone remotes, then schedule the script daily.

### 1.3 Restore test (the plan's "done when")

- **Script:** `scripts/ops/restore-test.sh <dump>`.
- It restores into an **empty, disposable** database, then prints row counts for the core tables and the migration history.
- **Guards:** it always refuses the production project, and it requires `RESTORE_CONFIRM_HOST` to equal the target host. Both refusals are verified locally.
- **[TODO-OWNER]** Run it once a month against a scratch Postgres (local Docker, or a throwaway Supabase project). Record the date and the counts in this file.
- **Status: never executed.** No restore has been tested. A9 stays open until one is.

## 2. Monitoring and alerting

| Signal | How | Status |
|---|---|---|
| Uptime | External monitor (e.g. UptimeRobot, Better Stack) polling `GET /api/health` every 1–5 min. Alert on non-200 or no answer. The endpoint returns 503 when the DB or Redis is down. It is rate-limited per IP (30/min, fail-open), so one monitor fits well within the limit. | **[TODO-OWNER]** create the monitor |
| Unhandled server errors | `instrumentation.ts` `onRequestError` logs **one** line per unhandled error: `"Unhandled server error"` with name, digest, method, route, and path without query. Set `ERROR_ALERT_WEBHOOK_URL` (https) to also receive it in Slack, Discord or an incident tool. | Code done and type-checked. **[TODO-OWNER]** set the webhook or a log drain |
| Log retention and search | Vercel log drain → a log service (Better Stack, Axiom, Datadog). Alert rules: `"Unhandled server error"`, `"Rate limiter backend error"` (Redis down, so login fails closed), `"Database pool error"`, `"Auto-close expired offers failed"`, `"Scheduled job expiry is disabled"`. | **[TODO-OWNER]** |
| Nightly job expiry (A2) | Vercel Cron → `GET /api/job-offers/expire` at 02:00 UTC (`vercel.json`), authenticated by `CRON_SECRET`. Failures log at error level (alert rule above). The Vercel dashboard (Settings → Cron Jobs) shows each run. | Code done. **[TODO-OWNER]** set `CRON_SECRET` in Vercel Production |
| Error tracking SaaS (Sentry etc.) | Not added: it needs a new dependency and an account. The webhook + log drain above covers alerting without one. | Decision for the team |

## 3. Secrets and environment

- All variable names, with explanations: `.env.example`.
- At startup, `lib/env.ts` validates the environment by name only (values are never logged). In production it is fatal when a runtime requirement is missing, and it warns otherwise.
- **The local `.env` of the main developer checkout points at the production Supabase database** (audit N2/F-09). Any `prisma migrate dev`, `db push` or seed run from that checkout would act on production.
  - The seeds now refuse production outright (`prisma/seed-guard.ts`).
  - The Prisma CLI does not have such a guard.
  - **[TODO-OWNER]** Move production credentials out of the default `.env`. Keep a separate file that is loaded explicitly, and only for `prisma migrate deploy` / `migrate status`.

## 4. Release procedure (database first)

1. **Read-only** checks on production: `npx prisma migrate status`, plus the duplicate-email query in `docs/PRODUCTION-READINESS-REMEDIATION.md` (A5).
2. Apply migrations **before** deploying code: `npx prisma migrate deploy`, using an explicitly loaded production env file. Three migrations are pending from the hardening work:
   - `20261109120000_add_user_session_version`: required, or every session fails;
   - `20261109130000_restore_trigram_search_indexes`;
   - `20261111090000_slug_redirects_status_history_notifications`.

   All three are additive.
3. Set the new environment variables in Vercel Production: `CRON_SECRET`, optionally `AI_DAILY_QUOTA` and `ERROR_ALERT_WEBHOOK_URL`.
4. Deploy, then smoke-test (`docs/PRODUCTION-READINESS-REPORT.md` §8).
5. Rollback: Vercel Instant Rollback (code only). Never drop the new columns or tables while any deployed version uses them. Old code ignores them, so a code rollback is safe.

## 5. Server hygiene (applies only to a self-hosted VPS)

On Vercel and Supabase, the providers handle these items. If a VPS is used anywhere:

- automatic security updates (`unattended-upgrades`);
- firewall that allows only 22, 80 and 443 (`ufw`);
- SSH keys only (`PasswordAuthentication no`, `PermitRootLogin no`);
- `fail2ban`;
- the app running as a non-root service user;
- TLS through a reverse proxy;
- the same backup, monitoring and restore steps as above.

None of this can be verified from the repository.

## 6. Account and access hygiene

- Vercel, Supabase, Upstash, Google Cloud, Resend and GitHub: two-factor authentication for every member, and least-privilege roles. **[TODO-OWNER]**
- Rotate credentials that may have been exposed: anything that was ever in a committed file, and the shared seed password (audit N1) on every environment where seeded accounts exist. **[TODO-OWNER]**

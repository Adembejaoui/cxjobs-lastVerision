# CXJobs

A job board for the customer-experience industry (call centers, BPOs, multilingual roles). Candidates build a profile and apply to jobs. Companies post jobs and process applications. Administrators invite companies and moderate accounts.

**Stack**
- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4.
- Prisma 7 with `@prisma/adapter-pg` on PostgreSQL (Supabase).
- Auth.js v5 (credentials + Google), with JWT sessions revocable through `users.sessionVersion`.
- Supabase Storage: a private `cv` bucket and public image buckets.
- Upstash Redis: rate limits, the AI quota and session revocation.
- Resend: transactional email.
- OpenAI: job generation, job import from a URL, CV parsing.
- Hosting: Vercel, with a nightly cron in `vercel.json`.

> **Company sign-up is invite-only.** An administrator creates an invitation (`/dashboard/admin/tokens`), and the company registers through the link. Open company sign-up is a business decision that hasn't been taken (launch plan F1). Candidates sign up freely.

---

## 1. Prerequisites

- Node.js **22.x** (`.nvmrc`; CI uses 22). Node 24 works locally.
- npm 10+.
- PostgreSQL 15+ with the `pg_trgm` extension, for a local database.
- Optional for local development: Redis (Upstash) and Supabase. Without Redis, an in-process limiter is used outside production.

## 2. Install

```bash
npm ci            # also runs `prisma generate` (offline, needs no database)
cp .env.example .env.local
```

## 3. Configure

Every variable is listed and explained in **`.env.example`**. The minimum for local development is:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | App connection (pooled in production, any URL locally) |
| `DIRECT_DATABASE_URL` | Direct connection, used **only** by the Prisma CLI (migrate). `DIRECT_URL` is accepted as a legacy alias (`prisma.config.ts`). |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL`, `APP_URL` | Base URL for links, sitemap and Open Graph. **Set them at build time too.** |
| `INVITATION_TOKEN_ENCRYPTION_KEY` | Base64 of 32 bytes (the all-zero placeholder in `.env.example` is fine locally) |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | File uploads (CVs, images) |

Production additionally requires:
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Without them, login, password reset and AI **fail closed**.
- `CRON_SECRET`, for the nightly job expiry.
- `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and `EMAIL_FROM`, for reset and verification mail.
- Optionally `OPENAI_API_KEY`, `AI_DAILY_QUOTA` and `ERROR_ALERT_WEBHOOK_URL`.

At startup, `instrumentation.ts` validates the environment **by name** (values are never logged).

> ⚠️ **Never put production credentials in `.env` or `.env.local`.** Next.js loads them for `dev` and `build`, and `prisma.config.ts` loads `.env` for every Prisma CLI command. A routine `prisma migrate dev` would then act on production.

## 4. Database

```bash
npx prisma migrate deploy    # apply all migrations to YOUR local database
npx prisma migrate status    # check the state
```

- Migrations live in `prisma/migrations`. They are forward-only, so never edit an applied one.
- For a schema change, edit `prisma/schema.prisma`, then run `npx prisma migrate dev --name <change>` **against a local database only**.
- Test data: `SEED_TEST_PASSWORD=<12+ chars> npx tsx prisma/seed.ts`. The seed:
  - refuses the production database;
  - refuses any non-local database unless `SEED_ALLOW_DATABASE_HOST` names it;
  - creates `candidateN@cxjobs.test` and `companyN@cxjobs.test` accounts.

## 5. Run

```bash
npm run dev       # http://localhost:3000
npm run build && npm run start
```

## 6. Quality checks (the same as CI)

```bash
npm run typecheck          # tsc --noEmit
npm run lint:ci            # ESLint; fails on any error or on more than 35 warnings
npm run test:security      # unit / security tests (node:test + tsx)
npm run test:integration   # real route handlers against an in-memory database
npm run build
npm audit --omit=dev
```

- The tests need no database, network, Redis, email or AI: they mock those boundaries (see `tests/integration/harness.ts`). Run them with `NODE_ENV=test`.
- CI (`.github/workflows/ci.yml`) runs all of the above on every push and pull request. It also runs a **migrations** job that replays every migration on a throwaway Postgres container and fails on schema drift.

## 7. Project layout

```
app/                 Next.js routes
  (public)/          public pages (cached; never read the session on the server)
  (dashboard)/       signed-in areas (candidate, company, admin)
  api/               route handlers: each one authenticates and authorizes itself
lib/                 domain and security code
  security/          URL validation, CV access, tokens, visibility rules, AI quota …
  server/            server-only helpers (notifications, slug redirects, job expiry …)
  validations/       zod schemas for every write
prisma/              schema, migrations, seeds (+ seed guard)
tests/security       unit tests      tests/integration   route tests
scripts/ops/         backup / restore-test scripts (see docs/OPERATIONS.md)
docs/                audits, remediation ledger, readiness report, operations runbook
```

## 8. Operations

See **`docs/OPERATIONS.md`** for the release order (migrations first), backups, the restore test, monitoring and alerting. The current readiness status is in **`docs/PRODUCTION-READINESS-REPORT.md`**.

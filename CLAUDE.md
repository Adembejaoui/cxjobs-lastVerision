# CLAUDE.md: rules for working in this repository

CXJobs: Next.js 16 App Router + Prisma 7 (Postgres on Supabase) + Auth.js v5 + Supabase Storage + Upstash Redis, deployed on Vercel. Read `README.md` for setup and `docs/OPERATIONS.md` for releases.

## Hard safety rules

- **The developer `.env` may point at the PRODUCTION database.** Never run `prisma migrate dev`, `migrate reset`, `db push`, seeds or `next dev`/`next build` with it loaded. For local checks, override every variable with unroutable placeholders (copy the `env:` block of `.github/workflows/ci.yml`). Process env wins over `.env`.
- Never run a destructive database command, and never apply migrations to a remote database without an explicit instruction.
- Never print, log or commit secrets. Log env variables by **name** only. Never log tokens, passwords, CV paths, emails in URLs, or request query strings.
- Do not commit, push or deploy unless asked.

## Architecture rules

- **Every API route authorizes itself** (there is no middleware). Use `getAuthenticatedUser` / `requireAdmin` from `lib/auth-helpers.ts`, which read role and status from the DB, and check object ownership in the query (`where: { id, companyId }`), not only the role.
- **Never trust ids from the client** for scoping (`companyId`, `userId`, `candidateId`). Derive them from the session and the DB (`lib/security/job-offer-scope.ts`, `lib/server/company-guard.ts`).
- **Public job visibility has ONE rule:** `publicJobWhere()` / `activeCompanyWhere()` in `lib/security/company-activity.ts` (published, not deleted, not expired, active company). Use it in every public read: lists, pages, sitemap, counts, apply.
- **Candidate-facing application data** goes through explicit selects / `lib/security/application-fields.ts`. Recruiter `notes` must never reach a candidate.
- **Every write is validated with zod** (`lib/validations/*`).
  - URLs: `safeUrlSchema` / `optionalSafeUrlSchema` (http/https only).
  - Images: `optionalStorageImageUrlSchema` (this app's storage only).
  - Map validated fields explicitly to Prisma data. Never spread request bodies.
  - **Partial updates:** an omitted field stays unchanged (`!== undefined` checks); `null` clears it.
- **Application status changes** must go through `lib/application-status.ts` (`canTransitionApplication`). Record `ApplicationStatusHistory`, notify through `lib/server/notifications.ts`, and do both inside the same transaction as the change.
- **Rate limits / quotas:** `checkRateLimitAsync` (fail-closed by default; `failOpen` only for cheap public reads). Paid AI calls also need `consumeAIQuota` (and refund on failure). AI calls must stay under `AI_ROUTE_DEADLINE_MS` (28 s).
- **Errors:** return generic messages plus a `code`, and log details server-side with `logger` (pino with redaction). Never return `error.message` from an unexpected error.
- **Caching:** public pages must not read the session on the server (A10). Use `useUser()` on the client, or the session-aware `/jobs/[slug]/preview`. After any write that changes public data, call `revalidateJobOffers()` / `revalidateCompanies()` (`lib/cache.ts`), which expire immediately.
- **Route files** (`route.ts`, `page.tsx`) may export only what Next allows. Put shared logic in `lib/`.
- **Builds must not touch the database:** use `generateStaticParams` returning `[]` for ISR, and `connection()` for request-time data.

## Database

- Migrations are forward-only. Generate SQL offline with `npx prisma migrate diff --from-schema <old> --to-schema prisma/schema.prisma --script`, then review it.
- Prefer additive changes. Document deploy order (migrate **before** code) in the migration header.
- Keep the trigram indexes declared in the schema (see `tests/security/migrations.test.ts`).

## Testing

- `npm run typecheck`, `npm run lint:ci` (0 errors, warnings ratchet ≤ 35), `NODE_ENV=test npm run test:security`, `NODE_ENV=test npm run test:integration`, `npm run build`. All must pass.
- Route tests use `tests/integration/harness.ts`. It runs the real handlers against an in-memory Prisma fake (`fake-prisma.ts`; add new models to its `RELATIONS`), with network access blocked.
- Every security or business-rule fix needs a regression test, plus a **negative control**: break the fix and see the test fail.

## Conventions

- Status and progress per launch-plan item: `docs/PRODUCTION-READINESS-REMEDIATION.md`. Update it when you change something it tracks.
- Brand colors: use the Tailwind tokens in `app/globals.css` (`brand-navy`, `brand-green-strong`, `brand-green-text`, `brand-muted`). `brand-green` (#47d79d) fails contrast on white: never use it for text or behind white text.
- Icon-only buttons need an `aria-label`. Form fields need a label (`<label htmlFor>` or `aria-label`).

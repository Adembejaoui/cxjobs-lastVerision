# Phase 6A: F-04 company suspension enforcement

Companion to `docs/PHASE-5-PRODUCTION-READINESS-AUDIT.md` (finding **F-04**).

**Scope and safety.**
- Local code and test changes only, all uncommitted on `hardening/production-readiness`.
- No commit, push, deploy, branch change, stash or reset. No migration or other Prisma DB command, and **no schema change**.
- No database, Supabase Storage, Redis, email, OAuth or AI service was contacted. No dependency changed. Every pre-existing working-tree change is preserved.

## 1. Executive summary

Suspending a company (an admin sets its owner account `isActive = false`) previously only signed the account out. Its jobs stayed in the public catalogue, on job pages, on the company page and in the company list, and **candidates could still apply and attach CVs**.

The existing suspension model is now enforced server-side everywhere a company or its jobs become public, and on every company-side write:
- One central definition (`lib/security/company-activity.ts`).
- Applied as a database `where` condition on public reads.
- Checked from the DB at the moment of every application and company write.
- Targeted cache invalidation when an admin suspends or reactivates a company.

Existing applications are untouched and stay visible to their candidates, read-only. Reactivation restores visibility only for jobs that are themselves still eligible.

Tests: **26 new regression tests**, each verified by negative controls. Full verification is in §12. **F-04 status: FIXED AND LOCALLY VERIFIED** (see §13 for the remaining CDN propagation delay and external checks).

## 2. Existing suspension model (as discovered)

| Question | Finding (evidence) |
|---|---|
| How are companies represented? | `model companies` (`prisma/schema.prisma:345`), with `deletedAt DateTime?` |
| User ↔ company | Exactly one owner: `companies.userId String @unique`, relation `companies.users` (`schema.prisma:347,369`). A company can't have several users |
| How does an admin suspend? | `PATCH /api/admin/users/[id]` with `{ isActive: false }` (`app/api/admin/users/[id]/route.ts`): `requireAdmin()`, admin accounts can't be modified, `isActive` is allow-listed, `bumpSessionVersion` runs in the same transaction, then `publishSessionVersion` |
| UI | The admin users page edits `isActive` (`app/(dashboard)/dashboard/admin/users/page.tsx:172,271`); the companies page shows it as a badge |
| Representation | **User-level `users.isActive`**. There's no company-level status. `companies.deletedAt` exists but **nothing in the code sets it** (repo-wide search) |
| Suspension vs deletion | Distinct: suspension is `users.isActive=false` (reversible); deletion would be `companies.deletedAt` (no flow exists) |
| Jobs ↔ company | Direct: `JobOffer.companyId → companies.id` |
| Sessions | Suspension bumps `sessionVersion`, so all sessions are revoked (immediately with Redis, ≤ 15 minutes without). Credentials login refuses inactive users. **A suspended company normally can't be signed in at all** |
| Reactivation | **Supported**: the same endpoint with `{ isActive: true }` |
| Central helper | None existed for company activity. Public visibility was re-implemented per route (`liveJobsWhere`, inline `status/deletedAt/expiresAt` filters) |

**Definition adopted (no new state):** a company is *active* when `companies.deletedAt IS NULL` **and** its owner `users.isActive = true`.

## 3. Root cause

Public visibility was defined per job (`status`, `deletedAt`, `expiresAt`) in each route. The owner account's activity, which is the only representation of suspension, was never part of any public query or of the application gate (`app/api/application/route.ts` `rejectionFor`). Company-side writes authorized from the JWT role claim, so they relied entirely on session revocation, with no DB check of the company's state.

## 4. Files changed

**Created**
| File | Purpose |
|---|---|
| `lib/security/company-activity.ts` | `activeCompanyWhere()`, `publicJobWhere(now)`, `isCompanyActive()`, `COMPANY_ACTIVITY_SELECT` |
| `lib/server/company-guard.ts` | `companySuspendedResponse()`: uniform 403 `COMPANY_SUSPENDED` for company-side writes |
| `tests/integration/company-suspension.test.ts` | 26 regression tests |
| `docs/PHASE-6A-F04-CHANGES.md` | This report |

**Modified**
| File | Change |
|---|---|
| `app/api/job-offers/route.ts` | Public catalogue: `company: activeCompanyWhere()`. POST: refuses when the company is suspended |
| `app/api/job-offers/[jobId]/route.ts` | Public cached detail: `findFirst` with `publicJobWhere()`. Non-owner company view: same rule (DB count). PUT: suspension check inside the ownership transaction |
| `app/api/job-offers/by-slug/[slug]/route.ts` | Public cached detail (used by the apply page): `publicJobWhere()` |
| `app/api/job-offers/[jobId]/views/route.ts` | Views counted only for active companies' jobs |
| `app/api/application/route.ts` | The application gate loads the company's activity state (pre-check **and** inside the insert transaction) and rejects with the existing generic `NOT_FOUND` |
| `app/api/application/[id]/route.ts` | PUT (status and notes): refused for a suspended company |
| `app/api/dashboard/company/route.ts` | PUT: refused for a suspended company |
| `app/api/dashboard/candidate/route.ts` | Recommended jobs use `publicJobWhere()` (also drops expired jobs, which were previously recommended) |
| `app/api/companies/[slug]/route.ts` | 404 for suspended or deleted companies |
| `app/api/profile/allCompanies/route.ts` | Lists only active companies |
| `app/api/admin/users/[id]/route.ts` | After commit: `revalidateJobOffers()` + `revalidateCompanies()` when a COMPANY's `isActive` actually changes |
| `app/(public)/jobs/[slug]/page.tsx` | Cached public fetch uses `publicJobWhere()`; another company's view applies the same rule; unused `JobOfferStatus` import removed |
| `app/(public)/jobs/[slug]/job-detail-client.tsx` | Apply actions only when `status === PUBLISHED && !isHistorical`, so a job reached through the candidate's own history is read-only. The `isHistorical` prop was previously passed but never used (the lint warning that is now gone) |
| `app/(public)/companies/[slug]/page.tsx` | `findFirst` with `activeCompanyWhere()`, so a suspended company gets the existing `notFound()` |
| `app/(public)/page.tsx` | Featured companies: active only |
| `tests/integration/fake-prisma.ts` | `companies.users` relation (the schema's real name) |
| `tests/integration/harness.ts` | `next/cache` mock records `revalidateTag`/`revalidatePath` (`cache.revalidated`), reset per test |
| `docs/PRODUCTION-READINESS-AUDIT.md` | F-04 status |

No file was moved or deleted.

## 5. Centralized enforcement design

```ts
// lib/security/company-activity.ts
activeCompanyWhere()   → { deletedAt: null, users: { isActive: true } }        // companies
publicJobWhere(now)    → { status: "PUBLISHED", deletedAt: null,
                           AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
                           company: activeCompanyWhere() }                         // job_offers
isCompanyActive(row)   → same rule for an already-loaded row
COMPANY_ACTIVITY_SELECT → { deletedAt: true, users: { select: { isActive: true } } }
```

- **Public reads** filter **in the database**. The suspension state is never selected into a public response; a suspended company's content is simply "not found".
- **Company-side writes** add `COMPANY_ACTIVITY_SELECT` to the company lookup they already perform (no extra query) and refuse with `companySuspendedResponse()`.
- **Nothing is taken from the client.** Company and activity state are always re-read from the DB at the time of the operation (a test sends forged `companyActive`, `isActive`, `company.users` and `companyId` fields).
- **No N+1.** The condition is part of the existing queries. Only the "another company views a published job" branches add one `count` query.
- **Index note:** the relation filter joins `companies` (PK) and `users` (PK) per job row; both are primary-key lookups. Not measured at scale.

## 6. Public listing and detail changes

| Surface | Before | After |
|---|---|---|
| `GET /api/job-offers` (public scope: anonymous, candidates, other companies, a forged `companyId`) | published, not deleted, not expired | **+ active company**. A top-level `company` key: the filter builder only appends to `AND`, so search, location, language, activity, salary, sort and pagination can't remove it (tested with 14 query variants) |
| `GET /api/job-offers/[jobId]` (public) | published, not deleted (**expired still returned**) | `publicJobWhere`: also not expired, active company |
| Same, as another COMPANY | published | published + `publicJobWhere` |
| `GET /api/job-offers/by-slug/[slug]` (public) | published, not deleted | `publicJobWhere` |
| `/jobs/[slug]` page (public cache) | published, not deleted | `publicJobWhere` (404 page for suspended, deleted-company or expired jobs) |
| `/jobs/[slug]` as another company | published | `publicJobWhere` |
| `/jobs/[slug]` for a candidate **with an application** | historical view | unchanged; now rendered with `isHistorical = true` and **no apply actions**, even if the status is still PUBLISHED |
| Owner company / admin views | any status | unchanged (owners keep access to their own records; admins see everything) |
| `POST /api/job-offers/[jobId]/views` | live jobs | live jobs of active companies |
| Candidate dashboard recommendations | published, not deleted (**expired included**) | `publicJobWhere` |
| `GET /api/companies/[slug]` and `/companies/[slug]` page | not deleted | active company, otherwise 404 / `notFound()` |
| `GET /api/profile/allCompanies` | not deleted | active companies |
| Home page featured companies | not deleted | active companies |

Public responses never include `userId`, `emailCompany`, `deletedAt`, `users` or `isActive` (asserted).

## 7. Application submission protection

`POST /api/application` (`app/api/application/route.ts`), in order:
1. Rate limit.
2. Authentication.
3. CANDIDATE role.
4. Candidate profile.
5. Validation.
6. **Pre-check:** the job is loaded with `JOB_AVAILABILITY_SELECT`, which includes `company.deletedAt` and `company.users.isActive`. `rejectionFor` refuses when the job isn't published, is deleted or expired, **or the company isn't active**, and EXTERNAL jobs are refused as before.
7. Duplicate check (unchanged).
8. **Inside the transaction, immediately before the insert:** the same select and `rejectionFor` again. Then the insert; the `[candidateId, jobOfferId]` unique key stays the final duplicate guard.

The refusal is the existing `404 NOT_FOUND` "Job offer not found or no longer available": it reveals no suspension, and the apply page already shows it (`app/(public)/jobs/[slug]/apply/page.tsx:208`). Earlier, the apply page couldn't load the job at all (by-slug now returns 404), so candidates see the existing "This job listing may have been removed" state.

**Race window:** the in-transaction re-check runs under READ COMMITTED with no row lock. A suspension committed in the milliseconds between that re-check and the insert can still let one application through. A `SELECT … FOR SHARE` on the owner's user row would close it, but needs raw SQL the test fake can't model. Left as documented residual risk (§13).

## 8. Company-side operation protection

| Operation | Protection |
|---|---|
| Create job (`POST /api/job-offers`, any status including PUBLISHED) | 403 `COMPANY_SUSPENDED` |
| Edit, publish or change the status of a job (`PUT /api/job-offers/[jobId]`) | 403 `COMPANY_SUSPENDED`, checked **inside** the ownership transaction |
| Process applications (`PUT /api/application/[id]`: status, notes, saved) | 403 `COMPANY_SUSPENDED` |
| Edit the public profile (`PUT /api/dashboard/company`) | 403 `COMPANY_SUSPENDED` |
| Edit the public profile (`POST /api/profile`), upload logo or cover (`/api/upload`), CV parse | Already refused: `getAuthenticatedUser({ requireActive: true })`, a DB check (403 `ACCOUNT_DISABLED`) |
| **Read** access (dashboard, own jobs, applications list, export, benefits) | **Unchanged** (historical information is not removed) |
| Delete own job (`DELETE /api/job-offers/[jobId]`) | Unchanged: deleting only takes content further offline |
| Admin acting on a suspended company's jobs | Unchanged (allowed, e.g. closing them) |

In production these guards are defence in depth: a suspended account's sessions are revoked, and it can't sign in again. They make the database state authoritative even while a JWT is still accepted (Redis unavailable, ≤ 15 minutes). The tests deliberately keep the session alive to prove this.

**No dedicated "account suspended" UI exists.** A suspended user is signed out, and login fails with the generic message. No new support UI was invented.

## 9. Admin suspension and reactivation

- **Only admins:** `requireAdmin()` (DB role and active). Tested: COMPANY and CANDIDATE sessions get 403 on themselves and on others; admin accounts can't be modified (existing).
- **No self-service path:** `isActive`, `deletedAt` and `users` are not accepted by `POST /api/profile` or `PUT /api/dashboard/company` (zod strips them). Tested both ways: an active company can't suspend itself, and a suspended one can't reactivate itself.
- **Sessions:** unchanged (`bumpSessionVersion` on suspension; tested). No extra invalidation was added.
- **Reactivation:** supported and tested.
  - Only jobs that are still `PUBLISHED`, not deleted and not expired reappear.
  - Drafts stay drafts.
  - The company page and listing come back, and applications are accepted again.

## 10. Cache invalidation behaviour

| Cache | Before | After suspension / reactivation |
|---|---|---|
| `unstable_cache` "public-job-offers" (tag `job-offers`, 60 s) | — | `revalidateTag("job-offers")` |
| `unstable_cache` "public-job-offer" / "published-job-detail" (tag `job-offer`, 60 s / 600 s) | — | `revalidateTag("job-offer")` |
| `/companies/[slug]` and `/companies` pages (ISR 600 s) | — | `revalidatePath(…, "page")` (inside `revalidateJobOffers`) |
| `companies` tag, `/api/profile/allCompanies` path | — | `revalidateCompanies()` |

- Invalidation runs **after** the transaction commits.
- It runs only when a **COMPANY** account's `isActive` **actually changes** (tested: name-only edits, no-op updates and candidate suspensions trigger nothing).
- The reused helpers are the ones job writes already call, so nothing broader was added.

**Remaining propagation delay (NOT VERIFIED on Vercel).** Some **anonymous** API responses carry CDN headers: the catalogue `public, s-maxage=300, stale-while-revalidate=60`; job detail, by-slug, company and company list `s-maxage=60, stale-while-revalidate=30`. Tag and path revalidation is not expected to purge CDN copies of Route Handler responses. Previously cached anonymous JSON can therefore be served for up to about **6 minutes** (catalogue) or about **90 seconds** (others) after a suspension. **Applications are not affected**: `POST /api/application` is uncached and checks the DB at request time, and the apply page's job fetch is refused once its CDN copy expires. Signed-in responses are `private, no-store`.

## 11. Tests added: `tests/integration/company-suspension.test.ts` (26)

These drive the real handlers, the real admin suspension route and the real `/jobs/[slug]` page (only the presentational client component is stubbed) over the in-memory DB.

| Group | Tests |
|---|---|
| A. Listings (3) | Active visible; suspended hidden for anonymous, candidate and other company, and `total` decreases; 14 query variants (search, location, `companyId`, status, contract, employment, activity, sort, pages 1–5 with limit 1) never return a suspended company's job; a deleted company's jobs hidden, and expired/draft jobs still hidden |
| B. Detail (6) | Job API: active 200, suspended 404 for anonymous, candidate and other company with no company data and no "suspend" text, admin 200, deleted company 404; expired job 404 on the API, by-slug and page; by-slug 404 for 4 personas; page: anonymous and other company `notFound`, **an applicant gets a read-only historical view** (`isHistorical: true`), a non-applicant `notFound`; views not counted; candidate recommendations (non-vacuous baseline) exclude suspended and expired |
| C. Company profiles (1) | Profile API 200 and then 404; company list excludes the suspended company and its total matches; no private fields |
| D. Applications (6) | Active accepted (201); suspended refused with a generic 404 and nothing created; forged client state ignored; deleted company, expired and draft refused; duplicate behaviour unchanged; existing applications unchanged by suspension and still listed and readable by the candidate |
| E. Company operations (4) | Active creates and publishes (201); a suspended company with a live session can't create, publish, edit, process applications, or change its profile (`PUT /api/dashboard/company` 403, `POST /api/profile` 403), and nothing changes in the DB; ownership 403 unchanged; admin can still close the job |
| F. Admin (3) | Suspension sets `isActive=false` and bumps `sessionVersion`; reactivation; company and candidate can't suspend anyone; profile routes can't write suspension state in either direction |
| G. Cache (3) | Suspension and reactivation trigger the `job-offers`, `job-offer` and `companies` tags; no invalidation for no-op, name-only or candidate changes; reactivation restores only eligible jobs (expired and deleted stay hidden, the draft stays a draft) and applications work again |

**Negative controls.** Each change below was reverted in turn; the suite failed each time, and every file was restored byte-identical (SHA-1):

| Reverted | Failing tests |
|---|---|
| `activeCompanyWhere` ignores `users.isActive` | 8 |
| Company check removed from `rejectionFor` (apply) | 3 |
| Suspension check removed from job PUT | 1 |
| Admin cache invalidation removed | 1 |
| Job page public filter reverted | 2 |

## 12. Verification results

All checks ran locally (Windows 10, Node v24.14.1). No external service was contacted.

| Check | Command | Result |
|---|---|---|
| Targeted suite | `node --experimental-test-module-mocks --import tsx --test tests/integration/company-suspension.test.ts` | **26/26 pass** (run after the final edit) |
| Negative controls | 5 reverts (§11) | All detected; files restored identical |
| Integration suite (includes existing company, job, application, admin and redirect tests) | `npm run test:integration` | **246/246 pass**, 0 skipped (220 before + 26 new) |
| Security suite | `npm run test:security` | **188/189**. The one failure is the known load-sensitive `M6 … main thread stays responsive` timing test (Phase 5 **F-33**), unrelated to this change. `npx tsx --test tests/security/cv-parser.test.ts` alone: 9/9 |
| TypeScript | `npx tsc --noEmit --incremental false` | **0 errors**. The first run caught 2 typing errors in the new test file, which were fixed and the check re-run |
| ESLint | `npm run lint:ci` | **0 errors, 34 warnings** (was 35). The removed warning is `'isHistorical' is assigned a value but never used` in `job-detail-client.tsx`: the prop is now used. New files alone: 0 warnings |
| Production build | `next build` with all 16 local `.env` keys overridden by unroutable placeholders | **Pass**: exit 0, 63/63 pages, 0 DB-connection errors |
| Browser | — | **Not performed** |

## 13. Remaining limitations

- **CDN propagation** of already-cached anonymous API responses: ≤ about 6 minutes for the catalogue, ≤ about 90 seconds otherwise (§10). Not verified on Vercel.
- **Apply race:** a suspension committed in the milliseconds between the in-transaction re-check and the insert can admit one application (§7).
- **The fake DB, not Postgres:** relation filters (`company.users.isActive`) were checked against the fake's semantics and `tsc` (Prisma types), not against real SQL or query plans.
- **Out of scope, unchanged:**
  - Admin overview metrics (`lib/analytics-queries.ts` "activeJobListings") still count jobs of suspended companies. That's admin reporting, not public exposure.
  - Admins can still edit or publish a suspended company's jobs; they stay non-public while the company is suspended.
- **No "account suspended" UI** for company users (they're signed out); the login error stays generic.
- **No company-deletion flow exists**; `companies.deletedAt` is honoured if one is added.

## 14. Requires browser or external verification

- Browser: the `/jobs/[slug]` and `/companies/[slug]` 404 pages for a suspended company; the apply page message; a candidate's historical job view with no apply button; the admin suspend and reactivate toggle. **No browser test was performed.**
- Vercel: CDN behaviour after `revalidateTag`/`revalidatePath` (§10); ISR revalidation of `/companies/[slug]`.
- Real Postgres: query plans for the added relation filter on large `job_offers`.

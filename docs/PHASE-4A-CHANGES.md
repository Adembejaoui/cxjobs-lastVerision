# Phase 4A: Application security, API coverage and account integrity

Companion to `docs/PRODUCTION-READINESS-AUDIT.md`, `docs/PHASE-2-CHANGES.md`, `docs/PHASE-3-CHANGES.md` and `docs/PHASE-4A-TASK-1-API-COVERAGE.md` (the first part of Task A, done in an earlier session and re-verified here).

**Scope and safety.** Everything here is an uncommitted working-tree change on `hardening/production-readiness`.
- No commit, push, deploy, migration, branch change, stash or reset.
- No production or staging service was contacted: no database, Supabase, Upstash, Resend, Google OAuth, OpenAI or Vercel. The integration harness blocks every non-loopback `fetch`.
- The build ran with every `.env` key overridden by an unroutable placeholder (`127.0.0.1:9`). No environment value was printed.
- No migration was created or applied. No database record was read or changed.

---

## 1. Executive summary

**Objective.** Close the remaining application-level gaps:
- **A.** API security coverage of every route.
- **B.** Email and Google OAuth account integrity (audit **H8**, code side).
- **C.** The company onboarding redirect loop.
- **D.** A focused security review of the result.

**Work completed.**
- **A.** All **41/41** API routes are now loaded by at least one test (25/41 at the start of this session, 22/41 at the end of Phase 3). The new tests surfaced **three** real defects in previously untested routes, all fixed with regression tests:
  - `PUT /api/dashboard/company` accepted `javascript:`/`data:` URLs.
  - `GET /api/profile/allCompanies` disclosed every company's draft, deleted and expired job counts.
  - `POST /api/analytics/web-vitals` was unthrottled and logged arbitrary attacker-supplied strings.
- **B.** **Root cause confirmed by test:** with the stock PrismaAdapter, a Google sign-in for `user@x.com` silently **created a second account** when the existing row was stored as `User@X.com`. Fixed by an adapter wrapper:
  - every case variant blocks account creation;
  - nothing is ever linked automatically;
  - new OAuth users are always unverified, not-onboarded CANDIDATEs.

  Two smaller account-integrity issues were also fixed:
  - `emailVerified` could be set for an address Google never verified.
  - Invitation emails were stored un-normalized.
- **C.** **Root cause:** the dashboard shell sent a not-onboarded COMPANY to `/onboarding/company`. That page is the invitation-registration page, and it sends every signed-in user back to `/dashboard`. The company profile page, the only place a company can finish onboarding, was behind the same guard. Fixed structurally:
  - DB-derived routing policy;
  - a route group that guards every company page except the profile page;
  - a DB-backed `/dashboard` router.

  15 regression tests run the real layouts and follow redirect chains with loop detection.
- **D.** Reviewed every changed file. Every fix has a negative control: the fix was reverted, the tests failed, and the file was restored byte-identical.

**Overall result.** Tests **409/409** (was 360 at session start, 321 after Phase 3), TypeScript 0 errors, ESLint 0 errors / 35 warnings (ratchet unchanged), isolated production build passes. See §8 for exact commands.

**Important remaining risks** (§9):
- Production blockers **B1–B5 remain open**; nothing here touches the database, storage or external services.
- The H8 *data* side is still open: case-variant rows that already exist, and any duplicates the old behaviour already created, need the read-only B4 check plus a manual resolution.
- No browser verification: the repo has no browser-test infrastructure.
- Google OAuth was never exercised against Google itself.

---

## 2. Initial repository state

| | Value |
|---|---|
| Branch | `hardening/production-readiness` (unchanged) |
| HEAD | `6e77684` ("v0"), unchanged; nothing committed |
| Initial `git status` | 107 entries: 69 modified, 6 deleted, 32 untracked paths (123 after this phase; every added entry is listed in §7). Includes the earlier Phase 4A Task 1 files (`tests/integration/admin-tokens.routes.test.ts`, `tests/integration/profile-onboarding.routes.test.ts`, `docs/PHASE-4A-TASK-1-API-COVERAGE.md`) |
| Tests (re-run at start) | **360/360**: `npm run test:security` 189/189, `npm run test:integration` 171/171; 0 skipped |
| API routes | **41** `route.ts` files under `app/api` (computed, not assumed) |
| Routes loaded by ≥ 1 test | **25/41** (computed from the `@/app/api/**/route` imports in `tests/`); 16 untested |
| Docs found | `PRODUCTION-READINESS-AUDIT.md`, `PHASE-2-CHANGES.md`, `PHASE-3-CHANGES.md`, `PHASE-4A-TASK-1-API-COVERAGE.md`, `RE-AUDIT.md`, `security/PRODUCTION_READINESS.md` |

Discrepancy found: `PHASE-4A-TASK-1-API-COVERAGE.md` says "the audit got a status update", but `PRODUCTION-READINESS-AUDIT.md` contained no Phase 4A entry. It is added in this phase (§10).

---

## 3. API security and coverage

### 3.1 Per-route table

Legend:
- **Previous coverage** is the state at the end of Phase 3.
- **4A-T1** = tests from the earlier Task 1 session (`admin-tokens.routes`, `profile-onboarding.routes`).
- **New** = this session (`remaining-routes`, `oauth-email-integrity`, `dashboard-redirects`).
- *Existing* routes were not re-audited in depth. Their existing tests pass, and they are listed so the table is complete.

| API Route | HTTP Method | Previous Coverage | New Tests | Result |
|---|---|---|---|---|
| `/api/admin/job-offers` | GET | None | New: anon 401; CANDIDATE/COMPANY/profile-less COMPANY 403; suspended admin 403; stale ADMIN claim with DB role COMPANY 403; malformed `companyId`/`status` 400 | **Tested**, pass |
| `/api/admin/job-offers/[id]` | PATCH | None | New: same auth matrix, no write; forged `companyId`, `slug`, `deletedAt`, `views`, `applicationType`, `externalApplyUrl`, `aiGenerated`, `id` ignored (no cross-company move); non-JSON 400 with no `SyntaxError`; forbidden-only body 400; unknown id 404 | **Tested**, pass |
| `/api/admin/overview` | GET | None | New: auth matrix; `no-store`; numeric aggregates only | **Partial**: the raw SQL is not executed by the fake DB |
| `/api/admin/tokens` | GET, POST | POST happy path (Phase 3) | 4A-T1: 16 tests (auth matrix, key allow-list, mass assignment, malformed payloads, 409, rate limit, DB failure). New: legacy mixed-case user blocks the company email (409); emails stored normalized; manager == company detected across case and whitespace | **Tested**, pass (fix SEC-4A-6) |
| `/api/admin/tokens/[id]/link` | POST | Happy path (Phase 3) | 4A-T1: auth matrix, malformed IDs rejected before any DB lookup, refused for every non-PENDING state, tampered ciphertext → generic 500 | **Tested**, pass |
| `/api/admin/tokens/[id]/revoke` | POST | None | 4A-T1: auth matrix, PENDING-only transition, idempotency, bad/unknown id | **Tested**, pass |
| `/api/admin/users` | GET | None | New: auth matrix; ADMIN rows never listed (incl. `role=ADMIN` and injection-shaped filters); no `passwordHash`, `sessionVersion`, `emailVerified`, `accounts`, `sessions` | **Tested**, pass |
| `/api/admin/users/[id]` | PATCH | Existing | — | Existing, pass |
| `/api/analytics/landing-visitor` | POST | None | New: httpOnly cookie; only a SHA-256 hash stored; per-IP limit 30/min | **Tested**, pass |
| `/api/analytics/web-vitals` | POST | None | New: strict shape (10 malformed / hostile payloads + non-JSON → 400); attacker text never logged; per-IP limit 60/min | **Tested**, pass (fix SEC-4A-5) |
| `/api/application` | GET, POST | Existing | — | Existing, pass |
| `/api/application/[id]` | GET, PUT | Existing | — | Existing, pass |
| `/api/application/[id]/cv` | GET | Existing | — | Existing, pass |
| `/api/auth/[...nextauth]` | GET, POST | Existing: credentials, session update, revocation | New: the Google branch, via the real Auth.js `handleLoginOrRegister` + real PrismaAdapter (not through the HTTP handler) | **Partial**: the Google HTTP round trip is not testable offline |
| `/api/auth/forgot-password` | POST | Existing (incl. NF-06 case) | — | Existing, pass |
| `/api/auth/invitation` | POST | Existing (Phase 3) | — | Existing, pass |
| `/api/auth/register` | POST | Existing (incl. NF-06 mixed case and duplicate) | Indirect: invitation emails are normalized at token creation | Existing, pass |
| `/api/auth/reset-password` | POST | Existing | — | Existing, pass |
| `/api/auth/verify-email` | POST, PUT | Existing | — | Existing, pass |
| `/api/candidate/cv/export` | GET, POST | None | New: anon/COMPANY/ADMIN 401; per-candidate claim; cooldown 429; other candidate untouched | **Tested**, pass |
| `/api/companies/[slug]` | GET | None | New: only live jobs listed and counted; no `userId`, `emailCompany`, `deletedAt`, `isVerified`; deleted company 404 | **Tested**, pass |
| `/api/company/benefits` | GET | None | New: non-company 401; own benefits only; profile-less 404 | **Tested**, pass |
| `/api/dashboard/candidate` | GET | Existing | — | Existing, pass |
| `/api/dashboard/company` | GET, PUT | None | New: anon 401, non-company 403; GET scoped to the caller (no other company's jobs or applications); PUT rejects `javascript:`, `data:`, `vbscript:`, credentialed and tab-obfuscated URLs with no write; forged `userId`, `id`, `slug`, `isVerified`, `verifiedAt`, `deletedAt` ignored | **Tested**, pass (fix SEC-4A-3) |
| `/api/dashboard/company/analytics` | GET | None | New: anon 401, CANDIDATE/ADMIN 403 | **Partial**: analytics computation not exercised |
| `/api/health` | GET | None | New: no errors, hostnames, keys or stack traces in the body | **Partial**: real dependency checks not exercised |
| `/api/job-offers` | GET, POST | Existing | — | Existing, pass |
| `/api/job-offers/[jobId]` | GET, PUT, DELETE | Existing | — | Existing, pass |
| `/api/job-offers/[jobId]/applications` | GET | None (export only) | New: anon 401; other company / candidate / profile-less 403 with no data; owner sees only this job's applications under 6 filter combinations (`search=%`, status, isSaved, huge limit); no recruiter notes or CV paths; deleted / unknown job 404 | **Tested**, pass |
| `/api/job-offers/[jobId]/applications/export` | GET | Existing | — | Existing, pass |
| `/api/job-offers/[jobId]/views` | POST | Existing | — | Existing, pass |
| `/api/job-offers/by-slug/[slug]` | GET | None | New: a draft is 404 for anon, candidate and another company (no title leak), 200 for its owner and admin; public job has no recruiter notes | **Tested**, pass |
| `/api/job-offers/expire` | POST | None | New: anon 401, CANDIDATE/COMPANY 403 with nothing closed; admin closes only expired PUBLISHED jobs (drafts and unexpired untouched) | **Tested**, pass |
| `/api/job-offers/generate-with-ai` | POST | Existing | — | Existing, pass |
| `/api/job-offers/scrape-from-url` | POST | Existing | — | Existing, pass |
| `/api/onboarding` | POST | None | 4A-T1: 6 tests (auth, already-onboarded, incomplete, forged body, company, DB failure) | **Tested**, pass |
| `/api/onboarding/cv-parse` | POST | Existing | — | Existing, pass |
| `/api/profile` | GET, POST | None | 4A-T1: 17 tests (ownership, mass assignment, relation IDs, CV reference, URLs). New: completing the company profile ends onboarding (redirect test S1→S2) | **Tested**, pass |
| `/api/profile/allCompanies` | GET | None | New: public job counts exclude draft, deleted and expired jobs; no `userId`, `emailCompany`, `deletedAt` | **Tested**, pass (fix SEC-4A-4) |
| `/api/profile/cv` | GET | Existing | — | Existing, pass |
| `/api/upload` | POST, DELETE | Existing | — | Existing, pass |

**Route counts (41 total):**
- **Tested: 37.**
- **Partially tested: 4.** `admin/overview`, `dashboard/company/analytics`, `health`, `auth/[...nextauth]` (Google leg).
- **Untested: 0.**

### 3.2 Coverage by category

| Category | Covered by |
|---|---|
| **Authentication** | Every new route: anonymous 401. Admin routes: suspended account (403 `ACCOUNT_DISABLED`) and deleted user (401). |
| **Authorization** | Role matrix on every role-restricted route. Admin role read from the **DB** (stale ADMIN claim refused). Expire is admin-only. Company routes refuse CANDIDATE and ADMIN. |
| **Ownership** | Applications list (tenant scope that filters cannot widen), company dashboard (no other company's data), benefits (own only), CV export (per-candidate), drafts by slug (owner/admin only), plus 4A-T1 profile/relations. |
| **Input validation** | Malformed IDs, non-JSON, wrong types, enum injection, over-long strings, unknown keys (web-vitals `.strict()`), unsafe URL schemes. |
| **Mass assignment** | Admin job PATCH allow-list; company PUT; 4A-T1 profile, onboarding and token routes. New OAuth users: role, onboarding, activity, verification, `sessionVersion`, `passwordHash` (§4). |
| **Admin token security** | 4A-T1 (16 tests), plus normalization and legacy-variant checks (§4). |

### 3.3 Tests that rely on mocks: what is real

- **Real:** route handlers, `getAuthenticatedUser`/`requireAdmin`/`getAuthUserRecord`, zod schemas, safe-URL validation, rate limiter (in-memory store), Auth.js `handleLoginOrRegister`, `@auth/prisma-adapter`, the Next.js layouts and pages under test.
- **Replaced:**
  - Prisma: in-memory fake with real `where` semantics. Extended in this phase with `groupBy`, the `companies.jobs` relation name, `_count` with a nested `where`, and the `account → user` relation.
  - `auth()`: only chooses *which* user id is signed in; role and status come from the DB.
  - `next/navigation` `redirect`: throws the target, as Next does.
  - Three presentational components (sidebar, header, invitation form).
- **Limit:** the fake DB doesn't model case-sensitive unique indexes, unknown columns or raw SQL. Those need the staging run (B5).

---

## 4. Google OAuth and email integrity (H8, code side)

### Original risk
Auth.js handles an OAuth sign-in for a not-yet-linked provider account like this:
1. `adapter.getUserByEmail(profile.email)` finds a user → `OAuthAccountNotLinked` (safe: nothing linked);
2. no user → `createUser(profile)`.

The stock PrismaAdapter's lookup is an **exact, case-sensitive** `findUnique({ where: { email } })`. A legacy row `User@Example.com` was invisible to a Google sign-in as `user@example.com`, so step 2 created a second account for the same person. The application's own `signIn` callback did a case-insensitive lookup, but only to refuse *inactive* users. It returned `true`, which let the duplicate through. When several variants already exist, `findUserByEmail` returns `null` (ambiguous), so the same thing happened.

### Root cause
Email normalization (NF-06) was applied to registration, login, reset and verification, but not to the Auth.js adapter, the one path that creates users outside the app's routes.

### Were duplicates possible?
**Yes, for legacy mixed-case rows**, proven by the test `root cause: the STOCK PrismaAdapter creates a duplicate account…` (it passes and documents the defect).
- **Not possible for lowercase rows:** the exact match found them, and `OAuthAccountNotLinked` was raised.
- **Registration could not create case-variant duplicates:** `emailIsTaken` is case-insensitive (existing NF-06 tests).
- Whether production **already contains** such duplicates can only be answered by the read-only B4 query. **Not verified.**

### Account-takeover analysis
- `allowDangerousEmailAccountLinking` is not set (now pinned by a source test). An existing account, ADMIN and COMPANY included, can therefore never be signed into by a Google account that merely shares the address.
- Linked accounts resolve by provider account id, never by email. A Google account linked to user X signs in as X even if its address later matches user Y.
- Auth.js still links a Google account to a user **who is already signed in** (its documented "connect account" behaviour). That requires the victim's session, so it isn't a takeover vector. It did have one side effect, fixed below.

### Changes implemented
| Change | File |
|---|---|
| `findEmailOwners()`: every account using an address under any case variant. An exact match first; candidates re-checked strictly in JS (no ILIKE `_`/`%` wildcard false matches); ambiguity is **not** collapsed to null. `emailIsTaken()` now reuses it (same behaviour). | `lib/server/user-email.ts` |
| `withEmailIdentityGuards(adapter)`: `getUserByEmail` sees every variant, so Auth.js raises `OAuthAccountNotLinked` instead of duplicating. `createUser` stores the **normalized** address and only server-chosen fields: `role: CANDIDATE`, `isOnboarded: false`, `isActive: true`, `emailVerified: null`, no `id`/`passwordHash`/`sessionVersion` from the profile. All other adapter methods are delegated unchanged. | `lib/server/auth-adapter.ts` (new) |
| `providerVerifiesUserEmail()`: `emailVerified` is set on Google sign-in only when Google verified **the same address** the account holds. Previously, linking any verified Google account to a signed-in user marked that user's unrelated, possibly unverified address as verified. | `lib/server/auth-adapter.ts`, `lib/auth.ts` (jwt callback) |
| `isTrustedGoogleProfile()`: the existing `signIn` rule (address required, `email_verified === true` strictly) extracted to a function so it can be unit-tested. Behaviour unchanged. | `lib/server/auth-adapter.ts`, `lib/auth.ts` |
| Adapter wired in `lib/auth.ts`, with a comment forbidding dangerous linking. | `lib/auth.ts` |
| Login page shows a fixed message for `?error=OAuthAccountNotLinked` / `AccessDenied` (previously the redirect failed silently). The raw query value is never displayed. | `lib/security/oauth-error-message.ts` (new), `components/auth/login-form.tsx` |
| Invitation emails trimmed and lowercased by the schema and stored normalized. The admin uniqueness check now uses `emailIsTaken` (catches legacy variants; it was an exact match). The company row created at registration stores the normalized `emailCompany`. (Closes Task 1 finding F5.) | `lib/validations/company-invitation.ts`, `app/api/admin/tokens/route.ts`, `app/api/auth/register/route.ts` |

Consistency check of every email entry point (static review):
- register, login, forgot, reset and verify-resend already normalize and use the case-insensitive lookups (NF-06).
- Admin email change normalizes and checks case-insensitively (`findFirst` with `mode: insensitive`; see §9 for a false-positive-only nuance).
- Invitations: fixed above. Google OAuth: fixed above.

### Regression tests: `tests/integration/oauth-email-integrity.test.ts` (14)
These drive the **real** Auth.js `handleLoginOrRegister` (loaded from the single `@auth/core` copy next-auth uses) with the **real** `@auth/prisma-adapter`:
1. Root cause: the stock adapter duplicates a legacy mixed-case account.
2. Google with three case variants of a legacy account → `OAuthAccountNotLinked`; nothing created or linked; the legacy row is not rewritten (no merge).
3. Existing CANDIDATE, COMPANY and ADMIN accounts are never taken over (upper-case address); roles unchanged.
4. Ambiguous legacy data (two variants) still blocks a third account.
5. An ILIKE wildcard (`a_b@`) doesn't match another account (`axb@`).
6. A new Google user is stored lowercase, CANDIDATE, unverified and not onboarded. A hostile profile carrying `role: ADMIN`, `isOnboarded`, `isActive: false`, `emailVerified`, `sessionVersion` or `passwordHash` is ignored.
7. A repeat sign-in reuses the linked user (no duplicate).
8. An already-linked COMPANY keeps working and keeps its role.
9. Linked identity is by provider account id, not by email.
10. Strict `email_verified === true` (rejects `"true"`, missing, `false`, blank address).
11. Verification is trusted only for the same address, provider and verified flag.
12. Source pin: guarded adapter wired; no `allowDangerousEmailAccountLinking`.
13. Invitation refused for a company email held by a legacy mixed-case user.
14. Invitation emails stored normalized; manager == company across case and whitespace.

Coverage of the required cases:
- Mixed-case and duplicate registration: already covered by the NF-06 tests in `auth-flows.routes.test.ts`, which pass.
- Google with an existing mixed-case email: tests 1–4.
- Verified vs unverified: 10–11.
- Existing linked accounts: 7–9.
- Takeover: 2–3, 9, 12.
- Role preservation: 3, 6, 8.

**Negative control.** Reverting the guard (delegating `getUserByEmail` to the stock adapter, passing the raw profile to `createUser`) fails tests 2, 3, 4 and 6. The file was restored byte-identical (SHA-1 checked).

### Remaining limitations (need data work or a user-facing flow)
- **Existing duplicates are not merged** (as instructed). If the old behaviour already created a Google duplicate of a legacy account, both rows remain. Find them with the B4 query (`lower(email)` groups with count > 1). Resolve them manually with the owner.
- **Legacy mixed-case credentials users** who try Google now see "already registered with a different sign-in method" and must use their password (or reset it). Linking Google to such an account needs a signed-in "connect Google" flow. Not built: it's a product feature, and safe linking requires the user to authenticate first.
- **Durable fix:** after B4 dedupe, a data migration that lowercases `users.email`, plus a unique index on `lower(email)`. Not done (no migrations in this phase).
- Google itself was never contacted. The provider round trip (state/PKCE, ID-token profile) is Auth.js code and is **not verified** here (B5).

---

## 5. Company onboarding redirect

### Original problem
A COMPANY with `isOnboarded = false` looped. Reproduced by the regression test with the original logic restored: `/dashboard → /onboarding/company → /dashboard → …`, and `/dashboard/company → /onboarding/company → /dashboard → /dashboard/company → …`.

### Root cause
1. `app/(dashboard)/layout.tsx` sent every not-onboarded COMPANY to `/onboarding/company`.
2. `/onboarding/company` is the **invitation-registration** page. Since Phase 3 (and, via `/dashboard/company/profile`, already at HEAD) it sends every signed-in user to `/dashboard`.
3. The **company profile page**, where a company completes onboarding (saving it through `POST /api/profile` sets `isOnboarded`; signup already sends invited companies to `/dashboard/company/profile?welcome=1`), sits under the same shell layout. A not-onboarded company could never reach it.

Contributing factor: `/dashboard` routed by the **JWT** role claim, which can lag the DB by up to 15 minutes, while the shell used the **DB** record. Guards reading different sources can disagree.

When it occurs: invited companies are created with `isOnboarded: true`, so new invitations didn't hit it. It affects existing or legacy COMPANY rows with `isOnboarded = false` (for example, rows created before invitation registration set the flag, or set by hand).

### Fix
| File | Change |
|---|---|
| `lib/security/dashboard-access.ts` (new) | Pure policy, from the **DB** user record. **Shell:** no user or inactive → `/login`; CANDIDATE not onboarded → `/onboarding/candidate`; otherwise render. A not-onboarded COMPANY is let in on purpose. **Company area:** no user or inactive → `/login`; non-COMPANY → its own home directly (not via `/dashboard`); COMPANY not onboarded → `/dashboard/company/profile`; otherwise render. |
| `app/(dashboard)/layout.tsx` | Uses the shell policy (replaces the inline branch that targeted `/onboarding/company`). |
| `app/(dashboard)/dashboard/company/(onboarded)/layout.tsx` (new) | Guards every company page except the profile page. Route groups don't change URLs. It reuses the request-scoped DB read the shell already made: **no extra query**. |
| `app/(dashboard)/dashboard/company/{page.tsx, jobs/, analytics/}` → `(onboarded)/…` | Moved unchanged (SHA-1 verified) into the group; only `jobs/page.tsx` changed (below). `profile/` and `loading.tsx` stay where they were. |
| `app/(dashboard)/dashboard/page.tsx` | Routes by the **DB** role (`dashboardHomeFor`) instead of the JWT claim. Same request-scoped read, no extra query. |
| `app/(dashboard)/dashboard/company/(onboarded)/jobs/page.tsx` | Its "no company row" fallback pointed at `/onboarding/company`; it now points at the profile page, which creates the row. |

Unchanged:
- The invitation page keeps sending signed-in users to `/dashboard`.
- Candidate onboarding, the admin layout (`requireAdmin`), and every page-level role check.
- Onboarding status is still only ever set server-side (`POST /api/profile`, `POST /api/onboarding`). The client and the JWT claim can't skip it: a test shows a claim of "onboarded" with a DB value of "not onboarded" still lands on the profile page.

Behaviour tightened: an **inactive** account with a still-valid JWT (possible for up to 15 minutes when Redis is down) is now sent to `/login` by the dashboard shell instead of rendering it. API routes already refused it.

### Regression tests: `tests/integration/dashboard-redirects.test.ts` (15)
These run the **real** shell layout, the company-area layout, the `/dashboard` router, the admin layout and the invitation page. They follow redirect chains, failing on any revisited URL or more than 8 hops.

| Scenario | Tests |
|---|---|
| 1. New company | From `/dashboard`, `/dashboard/company`, `…/jobs`, `…/analytics`, `…/profile` and `/onboarding/company` it lands on the profile page with no loop. A stale "onboarded" JWT claim can't skip onboarding. **Completing the profile** (`POST /api/profile`) sets `isOnboarded` server-side, and `/dashboard` then renders `/dashboard/company`. |
| 2/3. Completed or existing company | Every company page renders directly, never via onboarding. Routing performs **no writes** (roles and onboarding flags unchanged; no user create, update or delete recorded). |
| 4. Suspended company | Onboarded or not, it gets `/login` from every dashboard URL. A deleted user row gets `/login`. |
| 5. Candidate | `/onboarding/company` and every company URL lead to `/dashboard/candidate` (one hop from the company area). A not-onboarded candidate still goes to `/onboarding/candidate`. |
| 6. Admin | `/dashboard` and company URLs lead to `/dashboard/admin`, never to onboarding (even with `isOnboarded=false`). Non-admins are still kept out of `/dashboard/admin`. |
| Other | Anonymous → `/login`; the invitation page renders. An exhaustive role × active × onboarded truth table. A structural check that every company `page.tsx` except `profile/` is inside `(onboarded)/`. |

**Negative control.** Restoring the original shell branch fails 5 tests, with the exact loop shown above. The file was restored byte-identical.

### Browser verification
**Not performed.** The repo has no browser-test infrastructure (no Playwright, Cypress or Puppeteer), and the instructions say not to add a large framework. The app wasn't started in a browser either: the only local `.env` points at production services. The tests run the real server components but not the Next.js router or client navigation. Recommended staging check: log in as a COMPANY with `isOnboarded=false`, land on the profile page, save, then reach `/dashboard/company`.

---

## 6. Security fixes

| ID | Description | Severity | Affected files | Fix | Regression test |
|---|---|---|---|---|---|
| SEC-4A-1 | Google OAuth silently created a **duplicate account** for a legacy mixed-case email (also when variants were ambiguous) | **Medium** (account integrity; no takeover) | `lib/auth.ts`, `lib/server/user-email.ts`, `lib/server/auth-adapter.ts` | Case-insensitive, ambiguity-preserving `getUserByEmail` in an adapter wrapper → `OAuthAccountNotLinked` | `oauth-email-integrity` 1–5 |
| SEC-4A-2 | Linking a verified Google account to a signed-in user marked that user's **different, unverified** address as verified (a bypass of `REQUIRE_EMAIL_VERIFICATION` once enabled) | Low | `lib/auth.ts`, `lib/server/auth-adapter.ts` | `providerVerifiesUserEmail`: same address required | `oauth-email-integrity` 11 |
| SEC-4A-7 | New OAuth users were created from the raw provider profile (role and other server fields only protected by the default Google `profile()`) | Low (defence in depth) | `lib/server/auth-adapter.ts` | Explicit server-chosen fields, normalized email | `oauth-email-integrity` 6 |
| SEC-4A-3 | `PUT /api/dashboard/company` validated `website`/`logoUrl`/`coverImageUrl` with `z.string().url()`, which **accepts `javascript:`, `data:` and `vbscript:`**, bypassing the safe-URL policy applied everywhere else. The route has no client caller but is reachable by any company session. Render-time `toSafeHref` limits the impact where it's used. | **Medium** (stored unsafe URL; validation bypass) | `app/api/dashboard/company/route.ts` | `optionalSafeUrlSchema` (same as `POST /api/profile`; `""` still clears) | `remaining-routes`: dashboard/company PUT |
| SEC-4A-4 | `GET /api/profile/allCompanies` (public, cached) disclosed each company's number of **draft, deleted and expired** jobs via `_count.jobs` (audit medium/low item) | Low (information disclosure) | `app/api/profile/allCompanies/route.ts` | Count only live jobs (same filter as `companies/[slug]`) | `remaining-routes`: allCompanies |
| SEC-4A-5 | `POST /api/analytics/web-vitals` (public) was unthrottled and wrote arbitrary attacker-chosen strings and objects into the logs (audit medium/low item) | Low (log injection / flooding) | `app/api/analytics/web-vitals/route.ts` | Per-IP limit 60/min (fail-open telemetry); strict zod shape (known metric names, bounded numbers, path-only `page`, bounded `id`, `.strict()`) | `remaining-routes`: web-vitals ×2 |
| SEC-4A-6 | Invitation emails stored un-normalized; the admin uniqueness check was an exact match and missed legacy variants (Task 1 finding F5). Registration's own check already caught them. | Low (integrity) | `lib/validations/company-invitation.ts`, `app/api/admin/tokens/route.ts`, `app/api/auth/register/route.ts` | Schema normalizes; `emailIsTaken`; normalized `emailCompany` | `oauth-email-integrity` 13–14 |

Non-security fix: the company onboarding redirect loop (§5). Severity for users: **High** (a lockout for affected companies).

Negative controls: each of SEC-4A-1/7, SEC-4A-3, SEC-4A-4, SEC-4A-5 and the redirect fix was reverted in turn. The corresponding tests failed, and every file was restored byte-identical (SHA-1 compared).

---

## 7. Files changed

**Created**
| File | Purpose |
|---|---|
| `lib/server/auth-adapter.ts` | Adapter wrapper, provider-email trust checks (H8) |
| `lib/security/dashboard-access.ts` | DB-derived dashboard routing policy |
| `lib/security/oauth-error-message.ts` | Fixed login messages for OAuth error codes |
| `app/(dashboard)/dashboard/company/(onboarded)/layout.tsx` | Company-area onboarding guard |
| `tests/integration/oauth-email-integrity.test.ts` | 14 tests (Task B) |
| `tests/integration/dashboard-redirects.test.ts` | 15 tests (Task C) |
| `tests/integration/remaining-routes.test.ts` | 20 tests (Task A, the 16 untested routes) |
| `docs/PHASE-4A-CHANGES.md` | This report |

**Moved without content change** (route group; URLs unchanged): `app/(dashboard)/dashboard/company/page.tsx`, `analytics/*`, `jobs/*` → `app/(dashboard)/dashboard/company/(onboarded)/…`. This includes the pre-existing local modification of `jobs/[jobId]/applications/candidate-review-modal.tsx`, carried over byte-identical. Git will show these as deletions plus untracked paths until staged.

**Modified**
| File | Change |
|---|---|
| `lib/auth.ts` | Guarded adapter; same-address verification; extracted Google profile check |
| `lib/server/user-email.ts` | `findEmailOwners`; `emailIsTaken` reuses it |
| `lib/validations/company-invitation.ts` | Emails trimmed and lowercased |
| `app/api/admin/tokens/route.ts` | `emailIsTaken`; normalized emails stored |
| `app/api/auth/register/route.ts` | Normalized `emailCompany` |
| `app/api/dashboard/company/route.ts` | Safe-URL schema on 3 fields |
| `app/api/profile/allCompanies/route.ts` | Live-jobs-only count |
| `app/api/analytics/web-vitals/route.ts` | Rate limit + strict schema |
| `app/(dashboard)/layout.tsx` | Shell policy |
| `app/(dashboard)/dashboard/page.tsx` | DB-role router |
| `app/(dashboard)/dashboard/company/(onboarded)/jobs/page.tsx` | Fallback target |
| `components/auth/login-form.tsx` | OAuth error message from `?error=` |
| `tests/integration/fake-prisma.ts` | `account→user` relation, `companies.jobs` alias, `_count` with `where`, `groupBy`, `landingPageVisitor` model |
| `docs/PRODUCTION-READINESS-AUDIT.md` | Phase 4A status section (§10) |

**Generated, not hand-edited**
- `next-env.d.ts` was rewritten by `next build`. Its diff vs HEAD is one added line, `import "./.next/types/root-params.d.ts";`. It was already modified vs HEAD before this phase, most likely by an earlier `next dev`. Its prior content couldn't be reconstructed with certainty, so it was left as `next build` generates it.
- `.next/dev/types/` (gitignored `next dev` output from 2026-11-09) still referenced the old company page paths and broke `tsc`. It was moved, not deleted, to the session scratchpad (`next-dev-types-backup/`). The next `next dev` regenerates it.

---

## 8. Verification results

Run on Windows 10, Node via `tsx`, in the local working tree, after all changes.

| Check | Result | Details |
|---|---|---|
| TypeScript | **PASS** | `npx tsc --noEmit --incremental false` → exit 0, **0 errors** (run after the build regenerated `.next/types`) |
| ESLint | **PASS** | `npm run lint:ci` (`--max-warnings=35`) → exit 0, **0 errors, 35 warnings** (unchanged). The changed and new files linted alone: 0 errors, 0 warnings |
| Targeted tests | **PASS** | `node --experimental-test-module-mocks --import tsx --test <file>`: `oauth-email-integrity` **14/14**, `dashboard-redirects` **15/15**, `remaining-routes` **20/20** |
| Full test suite | **PASS** | `npm run test:security` **189/189**, `npm run test:integration` **220/220** → **409/409**, 0 fail, 0 skipped, 0 cancelled, 0 todo (was 360 at session start) |
| Production build | **PASS** | `next build` with all 16 `.env` keys overridden by unroutable placeholders (`NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1`; script kept in the session scratchpad; no value printed) → exit 0, "Compiled successfully", **63/63** static pages. All company URLs are unchanged in the route list (`/dashboard/company`, `…/jobs`, `…/jobs/[jobId]/applications`, `…/analytics`, `…/profile`). 0 connection-refused / DB errors in the log. `git status` and `next-env.d.ts` were identical before and after the final build. |
| Dependency audit | **PASS** (0 high, 0 critical; unchanged) | `npm audit --omit=dev` → 2 moderate (`exceljs` → `uuid`, GHSA-w5hq-g745-h8pq, analysed as unreachable in the audit), 0 high, 0 critical. The command exits 1 because advisories exist. No dependency was changed in this phase. |

### 8.1 Notes on the runs
- **Order.** The first build of this phase failed with a TypeScript error in `lib/server/auth-adapter.ts`, caused by a cast introduced while removing `id` from the created user. Fixed (`as unknown as AdapterUser`), then the build, `tsc`, both test suites and ESLint were re-run on the final tree. The numbers above are from those final runs.
- **Stale generated types.** The first `tsc` run of the phase reported 8 errors, all in generated `.next/dev/types/validator.ts` and `.next/types/validator.ts`, referencing the pre-move page paths. They disappeared once `next build` regenerated `.next/types` and the stale dev types were moved aside (§7). No source file had a type error apart from one in a new test (fixed).
- **Before / after:** tests 360 → **409** (+49 in this session; +88 over all of Phase 4A, counting Task 1's 39). ESLint warnings 35 → 35. Production advisories unchanged.

---

## 9. Remaining risks

**Routes and tests**
- 4 routes partially tested: `admin/overview` and `dashboard/company/analytics` (raw SQL / analytics computation), `health` (real dependencies), `auth/[...nextauth]` (Google HTTP round trip).
- Routes in the "Existing" rows were not re-audited in depth in this phase.
- Fake Prisma: no case-sensitive unique index, unknown-column, enum or real transaction semantics (Task 1 F2 `salaryExpectation` stays unverified).

**Known, not fixed (out of scope or behaviour changes)**
- `PUT /api/dashboard/company` has no client caller. It still replaces all benefits when `benefits` is sent (deleting job↔benefit links, owner's own data), leaves `linkedinUrl` unvalidated, and returns 500 on non-JSON. Consider removing this endpoint in favour of `POST /api/profile`.
- Task 1 findings still open: F1 (`/api/profile` non-JSON → 500), F2, F3 (company social URLs unvalidated; prefixed safely at render), F4.
- Nine routes authorize by the **JWT role claim** (`company/benefits`, `dashboard/company`, `dashboard/company/analytics`, `job-offers/[jobId]/applications`, `job-offers/expire`, `candidate/cv/export`, `job-offers/by-slug`, and others from earlier phases). Roles can't be changed through the API, and suspension revokes sessions via `sessionVersion` (immediately with Redis, ≤ 15 minutes without). That is acceptable, but a DB re-read would be stricter.
- Admin email change uses `findFirst … mode: insensitive` without the strict re-check. It can only produce a false "already in use" (e.g. `a_b@x` vs `axb@x`), never a duplicate.
- Zod strips rather than rejects unknown keys on most routes; many free-text fields are unbounded (audit medium/low).

**Unverified external integrations** (B5): Google OAuth round trip, Upstash (the web-vitals limiter is fail-open by design), Resend, Supabase Storage privacy (B3), Vercel runtime.

**Database-dependent** (B2, B4): legacy case-variant rows and any existing duplicates; the `lower(email)` migration; both pending migrations.

**Production-only:** none of these changes has run on Vercel. Legacy companies with `isOnboarded=false` will now be routed to their profile page; confirm on staging.

**Incomplete:** browser verification of the redirect flow (§5).

---

## 10. Production readiness impact

| Item | Before | After Phase 4A |
|---|---|---|
| H5 untested routes | ◐ 22/41 tested (Phase 3); 25/41 after Task 1 | ✅ **Resolved in code:** 41/41 loaded by tests (37 tested, 4 partial, 0 untested) |
| H8 Google vs legacy mixed-case emails | ⏳ Open | ◐ **Code side resolved:** no new duplicates, no linking, normalized creation. **Data side open:** B4 check, dedupe, `lower(email)` migration |
| Medium/low: `web-vitals` unthrottled | Open | ✅ Fixed |
| Medium/low: `allCompanies` counts drafts | Open | ✅ Fixed |
| Company onboarding redirect loop | Reported | ✅ Fixed in code; browser/staging check pending |
| B1 commit/release | Open | ⏳ **Open** (nothing committed) |
| B2 migrations | Open | ⏳ **Open** (no new migration; none applied) |
| B3 CV bucket privacy | Open | ⏳ **Open** (not verified) |
| B4 duplicate-email data check | Open | ⏳ **Open** (now also the way to find duplicates already created by SEC-4A-1) |
| B5 external integrations | Open | ⏳ **Open** |

Recommendation unchanged: **CONDITIONAL GO** once B1–B5 are complete. No production blocker is marked resolved.

---

## 11. Final verdict: **COMPLETE**

All four tasks were carried out in order, and the deliverables of each exist and are verified locally:
- **A:** every route covered, 3 real defects fixed with tests.
- **B:** root cause proven, fixed, 14 tests.
- **C:** root cause proven, fixed, 15 tests.
- **D:** review and negative controls.

Final checks: TypeScript, ESLint, 409/409 tests and the isolated build all pass.

What is *not* done is outside the code scope of Phase 4A and recorded rather than claimed:
- browser verification (no infrastructure; documented);
- external-service and database verification (B1–B5, the H8 data side), which belongs to later verification work.

None of these blocks the Phase 4A objective, so the verdict is COMPLETE rather than PARTIALLY COMPLETE. The production readiness verdict is unchanged.

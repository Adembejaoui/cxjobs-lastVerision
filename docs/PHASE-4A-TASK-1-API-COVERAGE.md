# Phase 4A / Task 1: API test coverage (security and authorization)

Companion to `docs/PRODUCTION-READINESS-AUDIT.md` (finding **H5**) and `docs/PHASE-3-CHANGES.md`.

**Scope and safety.** Everything here is an uncommitted working-tree change.
- No commit, push, deploy or migration.
- No database, Supabase, Redis, email, OAuth or AI service was contacted. The integration harness blocks any non-loopback `fetch`.
- No environment value was printed.
- **No application code was changed.** Only two test files and this report were added; the audit got a status update.

## Summary

| | Before | After |
|---|---|---|
| Security tests | 189 | 189 |
| Integration tests | 132 | **171** (+39) |
| **Total** | 321 | **360** |
| API routes loaded by at least one test | 22 / 41 | **25 / 41** |
| Vulnerabilities found | — | **0** (5 non-security defects / hardening gaps recorded, §5) |

---

## 1. Routes inspected

The four priority routes, plus the token **revoke** route, since "manage tokens" includes revocation:

| Route | Methods | Guard (real code) |
|---|---|---|
| `/api/profile` | GET, POST | `getAuthenticatedUser({ requireActive, requireOnboarded })` (GET); `getAuthenticatedUser({ requireActive })`, then a branch on the **DB** role (POST) |
| `/api/onboarding` | POST | `auth()` session id → DB re-read of `isActive`/`isOnboarded`/role; persisted-profile completion check |
| `/api/admin/tokens` | GET, POST | `requireAdmin()`: DB-checked `role === ADMIN` and `isActive`; per-admin rate limit |
| `/api/admin/tokens/[id]/link` | POST | `requireAdmin()`, UUID check, status/expiry/revocation checks, AES-GCM decrypt |
| `/api/admin/tokens/[id]/revoke` | POST | `requireAdmin()`, UUID check, PENDING-only transition |

## 2. Existing coverage (before this task)

| Route | Existing tests | Methods covered | Auth / role / ownership cases |
|---|---|---|---|
| `/api/profile` | **None** (only `/api/profile/cv` and the zod schemas in unit tests) | — | none |
| `/api/onboarding` | **None** (only `/api/onboarding/cv-parse`) | — | none |
| `/api/admin/tokens` | `invitations.routes.test.ts`: POST as admin (fragment link, hash-only storage, no-store, token never logged) | POST (admin happy path) | **none**: no anon, wrong-role, suspended or stale-role case; GET never called |
| `/api/admin/tokens/[id]/link` | same file: admin copy-link returns a fragment link | POST (admin happy path) | **none** |
| `/api/admin/tokens/[id]/revoke` | **None** (revocation was only simulated by editing the row) | — | none |

The existing tests were not duplicated: link format, hashing, `no-store` and log hygiene stay in `invitations.routes.test.ts`.

## 3. Missing cases identified

- **All five routes:** unauthenticated, wrong role, suspended account, and a session whose DB row changed (stale role, deleted user).
- **Profile:** whether the caller can see or write another user's candidate/company rows, relation rows (experience, skill, benefit), CV path or slug.
- **Server-controlled fields:**
  - candidate: `userId`, `id`, `cvParsed`, `cvExportCount`, `lastCvExportAt`;
  - user: `role`, `isActive`, `isOnboarded`, `sessionVersion`, `email`;
  - company: `userId`, `id`, `isVerified`, `verifiedAt`, `deletedAt`;
  - invitation: `id`, `status`, `tokenHash`, `tokenEncrypted`, `usedAt`, `revokedAt`, `expiresAt`.
- **Onboarding:** whether the body can target another user or force completion.
- **Tokens:** whether GET leaks `tokenHash`, `tokenEncrypted` or the raw token; whether a link is refused for every non-PENDING state; tampered ciphertext; revoke transitions.
- **Malformed IDs and payloads**, and generic 500s on DB or crypto failure.

## 4. Tests added

The real handlers are driven through the existing harness (`tests/integration/harness.ts`).
- **Real:** `getAuthenticatedUser`, `requireAdmin`, `getAuthUserRecord`, the zod schemas, relation sync/ownership, `normalizeOwnCvReference`, the onboarding rules, the rate limiter (in-memory store), invitation crypto and the logger.
- **Replaced (existing harness convention):** `auth()`, which only chooses *which user id* is signed in; role and status are re-read from the DB. Also Prisma (in-memory fake with real `where` semantics and transaction rollback), and Auth.js `unstable_update`.

No new mocks or fixtures were introduced.

### `tests/integration/admin-tokens.routes.test.ts`: 16 tests

| # | Test | Asserts |
|---|---|---|
| 1 | anonymous → 401 on GET, POST, link, revoke | `UNAUTHORIZED`, no data, table unchanged |
| 2 | CANDIDATE / COMPANY / profile-less COMPANY → 403 on all four | `FORBIDDEN`, no token or company data in the body, table unchanged |
| 3 | stale ADMIN session, DB role now COMPANY → 403 on all four | role comes from the DB; nothing created or revoked |
| 4 | suspended admin → 403 `ACCOUNT_DISABLED`; deleted admin → 401 | |
| 5 | GET as admin | exact key allow-list; no raw token, hash, ciphertext or `#token=` |
| 6 | GET invalid `status` (incl. injection-shaped) → 400; `limit=100000&page=-5` clamped to 100 / 1; odd `search` OK | |
| 7 | POST mass assignment | forged `id`, `status`, `tokenHash`, `tokenEncrypted`, `usedAt`, `revokedAt`, `expiresAt`, `createdAt` all ignored; expiry derived from `durationDays` |
| 8 | POST malformed / invalid payloads (9 shapes + non-JSON) → 400 | nothing created; no `SyntaxError` leaked |
| 9 | POST email already a user (case-insensitive) / manager == company → 409 | |
| 10 | POST per-admin limit 10/min across IPs | 11th → 429 |
| 11 | link: malformed IDs (`../../users`, `' OR 1=1 --`, …) → 400 **before any DB lookup**; unknown → 404 | |
| 12 | link refused (409) for revoked, used, expired, CREATED, IN_PROGRESS and legacy (no ciphertext) invitations | token never in the body |
| 13 | link with tampered ciphertext → generic 500 | no crypto, key-name or stack details |
| 14 | revoke PENDING → 200; link then 409; second revoke idempotent (timestamp unchanged) | |
| 15 | revoke CREATED → 409 (unchanged); bad ID 400; unknown 404 | |
| 16 | DB failure on all four routes → generic 500 | no Prisma, path or table names |

### `tests/integration/profile-onboarding.routes.test.ts`: 23 tests

| # | Test | Asserts |
|---|---|---|
| 1 | profile GET: anon 401, suspended 403, not onboarded (DB) 403 | DB state overrides the session claim |
| 2 | profile GET returns only own data | own user, candidate, experience and skill ids only; no `passwordHash`, `sessionVersion`, `isActive`, `emailVerified`, `deletedAt`; no other candidate's id or email; company sees only its own company |
| 3 | profile POST: anon 401, suspended 403 | no write |
| 4 | ADMIN POST → 400 `INVALID_ROLE` | no candidate or company row created |
| 5 | profile type follows the **DB** role | candidate + company payload → no company row; company + candidate payload → 400, no candidate row; stale CANDIDATE session with DB role COMPANY → company path, candidate untouched |
| 6 | candidate mass assignment | `id`, `userId`, `cvParsed`, `cvExportCount`, `lastCvExportAt`, `createdAt`, `role`, `isActive`, `isOnboarded`, `sessionVersion`, `email` ignored; other candidate byte-identical |
| 7 | client `isOnboarded: true` on an incomplete profile | 400, still not onboarded, save rolled back |
| 8 | another candidate's experience / skill IDs (alone or mixed with own) → 400 `INVALID_RELATION_ID` | both candidates' rows unchanged (rollback) |
| 9 | `skills: []`, `experiences: []` delete only own rows | new rows bound to the caller's `candidateId` |
| 10 | CV reference to another user's folder, its public URL, an external URL or `../` traversal → 400 `INVALID_CV_REFERENCE` | |
| 11 | malformed payloads (bad enum, bad date, wrong types, `javascript:` avatar, injection-shaped enum, over-long summary) → 400; non-JSON refused | no write; no `SyntaxError`/`JSON`/stack text |
| 12 | company mass assignment | `id`, `userId`, `isVerified`, `verifiedAt`, `deletedAt` ignored; company B byte-identical |
| 13 | company A cannot take company B's slug → 400 `SLUG_TAKEN` | |
| 14 | company B's benefit ID (alone or mixed) → 400; duplicate IDs → 400 | `benefits: []` deletes only A's rows |
| 15 | profile-less company creates its own company | bound to its own `userId` despite a forged `userId` |
| 16 | `javascript:` / `data:` URLs in website, logo, culture image; bad slug, year, email, benefit id → 400 | no write |
| 17 | DB failure on GET and POST → generic 500 | |
| 18 | onboarding: anon 401; session for a missing user 404; suspended 403 | not marked onboarded |
| 19 | already onboarded (candidate, company, admin) → 400 `ALREADY_ONBOARDED` | |
| 20 | incomplete candidate → 400 with field details; no candidate row → 400 `PROFILE_INCOMPLETE` | |
| 21 | forged body `{ userId, id, role: ADMIN, isOnboarded, skipValidation }` | ignored: incomplete still 400; complete → 200 for **the caller only**; role unchanged; other candidate untouched; response key allow-list |
| 22 | company without a profile → 400 even with a forged `companyId`; with a profile → 200 | |
| 23 | DB failure → generic 500 | |

### Negative controls (the tests actually detect regressions)

Four temporary mutations were applied, the two new files were run, and the originals were restored. Restoration was verified by SHA-1 to be byte-identical.

| Mutation | Tests that failed |
|---|---|
| `requireAdmin` role check disabled | 2 (wrong-role 403, stale-role 403) |
| `candidateProfileSchema` made `.passthrough()` | mass-assignment test (plus the foreign-ID test) |
| skill ownership check (`ProfileRelationError("skill")`) removed | foreign-ID test |
| onboarding `isActive` check removed | onboarding auth test |

## 5. Vulnerabilities and fixes

**No security vulnerability was found.** Every authorization, ownership and mass-assignment case behaved correctly, so **no application code was changed**.

These non-security defects and hardening gaps were found. They are recorded, not fixed, because each is either a behaviour change or out of scope for a security fix:

| # | Finding | Evidence | Impact | Recommendation |
|---|---|---|---|---|
| F1 | `/api/profile` POST with a non-JSON body returns **500 `INTERNAL_ERROR`** instead of 400 | `app/api/profile/route.ts:534`: `request.json()` throws into the generic catch | Safe: generic message, nothing leaked or written. But it's the wrong status, and it logs an error for client mistakes. | Wrap `request.json()` in a 400, as the token routes do. The test asserts only `>= 400` with no leak, so it will keep passing after the fix. |
| F2 | `salaryExpectation` is accepted by `candidateProfileSchema` but is **not a `Candidate` column** | `lib/validations/profile.ts:122`; absent from `prisma/schema.prisma` | Real Prisma would reject the unknown argument, so a payload with this key gets a 500. No client currently sends it (repo-wide search), and nothing can be written through it. | Drop it from the schema, or add the column. The fake Prisma doesn't model unknown columns, so this was confirmed by static review, not by a test. |
| F3 | Company `linkedinUrl` / `twitterUrl` / `facebookUrl` are unvalidated `z.string()` | `lib/validations/profile.ts:426-428` | **Not exploitable today.** `app/(public)/companies/[slug]/page.tsx:342,360-366` prefixes them with `https://linkedin.com/company/` / `https://twitter.com/` unless the value starts with `http`. So no `javascript:` or `data:` scheme can reach `href`, and `facebookUrl` isn't rendered as a link. A Twitter value starting with `http` can still be any external site (the same trust as `website`). | Apply `optionalSafeUrlSchema` (or a handle regex) for defence in depth. |
| F4 | `/api/onboarding` doesn't check the role, so a not-yet-onboarded **ADMIN** is simply marked onboarded | `app/api/onboarding/route.ts` (no ADMIN branch) | Not a privilege change (onboarding grants nothing to an admin); admins are created onboarded. | None needed; documented for completeness. |
| F5 | `/api/admin/tokens` POST stores `companyEmail` as submitted; it is lower-cased only for the uniqueness check | `app/api/admin/tokens/route.ts` (`companyEmail` vs `normalizedCompanyEmail`) | Display and search consistency only; the check itself is case-insensitive (test 9). | Store the normalized value (relates to H8 email normalization). |

## 6. Verification results (exact)

Run on Windows, Node via `tsx`, in the local working tree:

| Check | Command | Result |
|---|---|---|
| Targeted (new files + existing invitation flow) | `node --experimental-test-module-mocks --import tsx --test tests/integration/admin-tokens.routes.test.ts tests/integration/profile-onboarding.routes.test.ts tests/integration/invitations.routes.test.ts` | **47 / 47 pass**, 0 fail (16 + 23 + 8) |
| Security suite | `npm run test:security` | **189 / 189 pass**, 0 fail |
| Integration suite | `npm run test:integration` | **171 / 171 pass**, 0 fail (was 132) |
| **Total** | | **360 / 360** (was 321) |
| TypeScript | `npx tsc --noEmit --incremental false` | **exit 0, 0 errors** (both new files are in the program: `tsconfig` includes `**/*.ts`) |
| ESLint (CI ratchet) | `npm run lint:ci` (`--max-warnings=35`) | **0 errors, 35 warnings, exit 0**; unchanged, so the ratchet passes |
| ESLint (new files only) | `npx eslint tests/integration/admin-tokens.routes.test.ts tests/integration/profile-onboarding.routes.test.ts` | **0 errors, 0 warnings** |

Before the change the baseline was re-run and confirmed: security 189/189, integration 132/132.

## 7. Remaining untested routes and limitations

**16 of 41 API routes are still loaded by no test.** The list was computed from the `@/app/api/**/route` imports in `tests/`:

| Area | Routes |
|---|---|
| Admin | `admin/job-offers`, `admin/job-offers/[id]`, `admin/overview`, `admin/users` (list; `admin/users/[id]` is tested) |
| Company | `company/benefits`, `dashboard/company`, `dashboard/company/analytics`, `job-offers/[jobId]/applications` (list; the export is tested), `job-offers/expire` |
| Public / misc | `companies/[slug]`, `job-offers/by-slug/[slug]`, `profile/allCompanies`, `health`, `analytics/landing-visitor`, `analytics/web-vitals` |
| Candidate | `candidate/cv/export` |

Suggested next priority: the admin routes (same `requireAdmin` pattern as here), then `company/benefits` and `job-offers/[jobId]/applications` (company ownership), then `job-offers/expire` (check its trigger/auth model).

**Limitations of the tests added:**
- **Fake Prisma, not Postgres.** Unique constraints, unknown-column errors (see F2), enum validation and real transaction isolation aren't modelled. Rollback is modelled by snapshot. A staging run against a real DB is still needed (audit B5).
- **`auth()` is replaced.** Real Auth.js cookie/JWT handling is covered elsewhere (`auth-flows.routes.test.ts`, `auth-callbacks.test.ts`), not by these files. Here the session only supplies the user id; role, `isActive` and `isOnboarded` come from the DB.
- **`unstable_update` is a no-op.** That the onboarding route refreshes the JWT isn't asserted here. Server-side session re-derivation is covered by `auth-callbacks.test.ts` (S1).
- **Rate limits** use the in-memory store; real Upstash behaviour is unverified (audit B5).
- **Abuse-scale** inputs (very large bodies or arrays) weren't tested; most free-text fields still have no maximum length (audit, medium/low).

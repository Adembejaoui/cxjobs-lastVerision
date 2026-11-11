# Vercel build fix: `prisma generate` vs the production database guard

**Date:** 2026-11-12 · **Branch:** `hardening/production-readiness` · **Prisma:** 7.10.1

## Symptom

```text
Failed to load config file "/vercel/path0" as a TypeScript/JavaScript module.
Refusing to run the Prisma CLI against the PRODUCTION database (DATABASE_URL).
npm error command sh -c prisma generate
npm install exited with 1
```

## Root cause

`prisma.config.ts` contains the Release Gate 0 CLI guard (an inlined copy of
`lib/security/production-db-guard.ts`). It ran **at module load, for every
Prisma CLI command**, and threw when `DIRECT_DATABASE_URL`, `DIRECT_URL` or
`DATABASE_URL` contained the production project marker, unless
`CXJOBS_ALLOW_PRODUCTION_DATABASE=I_UNDERSTAND_THIS_IS_PRODUCTION` was set.

On Vercel, `npm install` runs the `postinstall` script `prisma generate`, and
the Vercel environment has the production `DATABASE_URL`, so loading the config
threw. `prisma generate` reads only `prisma/schema.prisma` and writes
`app/generated/prisma`. It never connects to a database, so blocking it
protected nothing.

Unlike the runtime guard in `lib/prisma.ts`, the CLI guard has no `VERCEL=1`
exemption. That is intentional and has been kept, so a `migrate` command run
on Vercel is still refused.

The trigger is the `for … of` loop in `prisma.config.ts` (`throw new Error('Refusing to run the Prisma CLI…')`).
No other guard was involved: `lib/prisma.ts` is not loaded during install, and
`next build` does not load `prisma.config.ts`.

## Fix

A single, narrow exemption in `prisma.config.ts`, `isOfflinePrismaGenerate(process.argv)`.

Prisma 7.10.1 loads the config **in-process**. We verified this by having a scratch
config print `process.argv`, which was `[node, …/node_modules/prisma/build/index.js, "validate", …]`.
That makes the CLI arguments reliable to inspect. The exemption applies only when **all** of these hold:

1. `argv[1]` is the Prisma CLI entrypoint, either `…/node_modules/prisma/build/index.js`
   (Windows `.cmd` shim, or a resolved symlink) or `…/node_modules/.bin/prisma` (the POSIX
   symlink npm uses on Linux/Vercel). Backslashes are normalised.
2. The **first positional argument** is exactly `generate`.
3. There is no `--sql` / `--sql=…` flag. TypedSQL generation connects to the database.

For that invocation, the guard loop is skipped **and the `datasource` URL is
left out of the config**, so client generation never receives the production
connection string. Anything that doesn't match exactly, such as another command,
`migrate generate`, flags before the command, or a non-Prisma entrypoint, gets the
unchanged guard. The check fails closed.

## Behaviour before / after

Production-marker URL in the environment, no override:

| Invocation | Before | After |
|---|---|---|
| `prisma generate` (postinstall, Vercel) | **refused** (build fails) | allowed, no datasource passed |
| `prisma generate --no-hints --schema …` | refused | allowed |
| `prisma generate --sql` | refused | refused |
| `prisma migrate deploy` / `dev` / `reset` / `status` | refused | refused |
| `prisma db push` / `pull` / `seed` / `execute` | refused | refused |
| `prisma studio` | refused | refused |
| `prisma --schema x generate` (unrecognised shape) | refused | refused (fail closed) |
| Config imported by a non-Prisma process | refused | refused |
| Any of the above with `VERCEL=1` only | refused | refused |
| `migrate deploy` with the explicit override | allowed | allowed |
| Local / placeholder URLs | allowed | allowed (unchanged) |

Unchanged: `lib/prisma.ts` (runtime guard), `lib/security/production-db-guard.ts`,
the seed guard (`assertSeedTargetAllowed`) and seed scripts, `scripts/`, `package.json`, `vercel.json`.

## Files changed

- `prisma.config.ts`: `isOfflinePrismaGenerate()`, guard skip, datasource omitted for generate.
- `tests/security/production-db-guard.test.ts`: two new tests. `loadPrismaConfig()` can now simulate the CLI argv and reports whether a datasource was configured.
- `docs/RELEASE-GATE-0-SECURITY-REVIEW.md`: the `prisma.config.ts` row records the exemption.
- `docs/VERCEL-PRISMA-GENERATE-FIX.md`: this report.

## Verification (2026-11-12, Windows, Node 22)

No production connection was made. Guarded-command checks used a synthetic URL that
carries the production marker but points at unroutable `127.0.0.1:9`
(`postgresql://postgres.<marker>:synthetic@127.0.0.1:9/postgres`).

| Check | Result |
|---|---|
| `npx prisma generate` with the normal local env | ✔ generated, exit 0 |
| `npx prisma generate` with the production-marker URL in all three variables (Vercel scenario) | ✔ generated, exit 0 |
| `npx prisma migrate deploy` / `migrate status` / `db push` / `generate --sql`, same URL, no override | ✔ all refused: `Refusing to run the Prisma CLI against the PRODUCTION database (DIRECT_DATABASE_URL)`. Credential not echoed |
| `npx prisma migrate status`, same URL **with** override | ✔ passes the guard, then `P1001: Can't reach database server at 127.0.0.1:9` (the override is still what authorizes) |
| `production-db-guard.test.ts` | ✔ 6/6 |
| Negative control A: remove the exemption | ✔ "`prisma generate` (offline)…" test fails |
| Negative control B: make the exemption always true | ✔ "every other Prisma command… stays refused" fails (`prisma migrate deploy must be refused`) |
| `npm run typecheck` | ✔ exit 0 |
| `npm run lint:ci` | ✔ 0 errors, 34 warnings (≤ 35) |
| `NODE_ENV=test npm run test:security` | 208/209. The failure was `cv-parser.test.ts` M6 (worker deadline timing), unrelated to this change. It passed 3/3 when run alone and flaked under the parallel load of the new child-process tests |
| `NODE_ENV=test npm run test:integration` | ✔ 270/270 |
| `npm run build` (CI placeholder env) | ✔ exit 0 |
| `git status` after generate | `app/generated` unchanged |

### Linux / Vercel compatibility

- The argv check accepts both the Linux form (`node_modules/.bin/prisma`, symlink invoked through `sh -c`) and the resolved form (`node_modules/prisma/build/index.js`). Both are covered by unit tests with `/vercel/path0/...` paths. The end-to-end CLI runs were on Windows only; no Linux runtime was available locally. The first Vercel deploy is the Linux end-to-end check.
- No OS-specific APIs. The logic is string matching on `process.argv` only.
- The build-time install and build commands come from defaults. `vercel.json` sets no `installCommand`/`buildCommand`, and the repo has no `.vercel/` link: install is `npm install` (→ `postinstall: prisma generate`), build is `npm run build` (`next build`, which does not load `prisma.config.ts`).

## Remaining deployment requirements

- **Do not** add `CXJOBS_ALLOW_PRODUCTION_DATABASE` to any Vercel environment. It is not needed.
- Confirm that the Vercel dashboard doesn't override the install/build command with something that runs other Prisma commands (e.g. `prisma migrate deploy && next build`). Such a command will (correctly) still be refused. Migrations stay a manual, approved step (see `docs/OPERATIONS.md`).
- If TypedSQL (`generate --sql`) is ever adopted, generation will need a non-production database or an approved override. It is intentionally not exempt.
- If a future Prisma version loads the config in a child process or changes the CLI entrypoint path, `generate` will be refused again. It fails closed, and the new tests document the expected argv shape.
- Optional follow-up: the M6 timing test in `cv-parser.test.ts` is sensitive to CPU load. Consider a more generous deadline margin.

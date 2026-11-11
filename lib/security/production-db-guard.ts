/**
 * Production database guard (Release Gate 0).
 *
 * A developer checkout once held production credentials in `.env`, which
 * Next.js and the Prisma CLI load automatically. This guard makes it
 * impossible to reach the production database from a local machine by
 * accident: any connection string that identifies the production Supabase
 * project is refused outside Vercel, unless the operator sets an explicit,
 * deliberately awkward override for one approved command.
 *
 * Dependency-free on purpose: `prisma.config.ts` inlines the same check so
 * the Prisma CLI config loader needs no extra imports (keep them in sync;
 * tests/security/production-db-guard.test.ts checks both).
 */

/** Supabase project ref of production (also in next.config.ts, safe-url.ts, seed-guard.ts). */
export const PRODUCTION_DB_MARKERS = ["hvbbactmgfhecqbetlhg"] as const;

export const PRODUCTION_DB_OVERRIDE_VAR = "CXJOBS_ALLOW_PRODUCTION_DATABASE";
export const PRODUCTION_DB_OVERRIDE_VALUE = "I_UNDERSTAND_THIS_IS_PRODUCTION";

type Env = Record<string, string | undefined>;

export function isProductionDatabaseUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return PRODUCTION_DB_MARKERS.some((m) => lower.includes(m));
}

/**
 * Throws when `url` is the production database and the process is neither a
 * Vercel deployment nor explicitly authorized. The message names variables,
 * never values.
 */
export function assertNotProductionDatabase(url: string | undefined | null, source: string, env: Env = process.env): void {
  if (!isProductionDatabaseUrl(url)) return;
  if (env.VERCEL === "1") return; // the deployed application itself
  if (env[PRODUCTION_DB_OVERRIDE_VAR] === PRODUCTION_DB_OVERRIDE_VALUE) return;
  throw new Error(
    `Refusing to use the PRODUCTION database (${source}) from a local process. ` +
      `Production credentials must not be in a development environment. ` +
      `For an approved operation only, load the production env file explicitly and set ` +
      `${PRODUCTION_DB_OVERRIDE_VAR}=${PRODUCTION_DB_OVERRIDE_VALUE} for that single command.`
  );
}

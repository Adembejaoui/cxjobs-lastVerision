/**
 * Safety guard for the test-data seeds (prisma/seed.ts, prisma/seed-k6.ts).
 *
 * Audit finding N1: the seeds used one hard-coded password for 105 accounts
 * and real-looking @gmail.com addresses, and a developer checkout's .env
 * points at the production database. Now:
 *   1. The password comes from SEED_TEST_PASSWORD (min. 12 characters); it
 *      is never stored in the repository.
 *   2. The production database is ALWAYS refused (no override).
 *   3. Any non-local database must be confirmed explicitly by setting
 *      SEED_ALLOW_DATABASE_HOST to exactly that host name.
 * Seeded addresses use the reserved .test domain (RFC 2606), so they can
 * never belong to a real person.
 */

/** Supabase project ref of production (also in next.config.ts / safe-url.ts). */
export const PRODUCTION_DB_MARKERS = ["hvbbactmgfhecqbetlhg"];

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

type SeedEnv = Record<string, string | undefined>;

export function requireSeedPassword(env: SeedEnv = process.env): string {
  const value = env.SEED_TEST_PASSWORD ?? "";
  if (value.length < 12) {
    throw new Error(
      "SEED_TEST_PASSWORD must be set (at least 12 characters). Test accounts no longer use a password stored in the repository."
    );
  }
  return value;
}

export function assertSeedTargetAllowed(connectionString: string | undefined, env: SeedEnv = process.env): void {
  if (!connectionString) throw new Error("DATABASE_URL is not set.");
  let host: string;
  try {
    host = new URL(connectionString).hostname.toLowerCase();
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }
  const full = connectionString.toLowerCase();
  if (PRODUCTION_DB_MARKERS.some((m) => host.includes(m) || full.includes(m))) {
    throw new Error("Refusing to seed: DATABASE_URL points at the PRODUCTION database. Seeds never run there.");
  }
  if (LOCAL_HOSTS.has(host)) return;
  if ((env.SEED_ALLOW_DATABASE_HOST ?? "").toLowerCase() !== host) {
    throw new Error(
      `Refusing to seed a non-local database (${host}). If this is a disposable staging/test database, ` +
        "confirm by setting SEED_ALLOW_DATABASE_HOST to exactly that host name."
    );
  }
}

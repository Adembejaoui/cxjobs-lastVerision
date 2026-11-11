import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Direct (non-pooled) connection used only by the Prisma CLI (migrate,
// introspection). DIRECT_DATABASE_URL is the documented name (.env.example,
// lib/env.ts); DIRECT_URL is accepted for older local .env files.
//
// Deliberately NOT `env('…')` from prisma/config: that helper throws while the
// config is loaded, which made `prisma generate` (npm postinstall) fail on a
// fresh checkout. `generate` needs no URL; migrate commands report a clear
// "datasource url" error when it is missing.
const directUrl = process.env.DIRECT_DATABASE_URL || process.env.DIRECT_URL

// Gate 0: the Prisma CLI (migrate, db push, studio, seed) refuses the
// PRODUCTION database unless explicitly authorized for one approved command:
//   CXJOBS_ALLOW_PRODUCTION_DATABASE=I_UNDERSTAND_THIS_IS_PRODUCTION
// Inlined copy of lib/security/production-db-guard.ts (no imports, so the
// CLI config loader stays dependency-free); keep the marker in sync.
//
// Single exemption: offline client generation. Vercel runs `prisma generate`
// (npm postinstall) with the production DATABASE_URL in its environment;
// generation reads only the schema and never connects, so it must not be
// blocked. The exemption is deliberately narrow and fails closed:
//   - the process must be the Prisma CLI itself (the config is loaded
//     in-process, so process.argv is `node <prisma CLI> <command> ...`);
//   - the FIRST positional argument must be exactly `generate`;
//   - `--sql` (TypedSQL) is excluded: it connects to introspect queries.
// For that invocation the datasource URL is also left out of the config, so
// generation never even receives the production connection string. Every
// other command (migrate *, db *, studio, seed, introspect, execute...) and
// any argv shape that cannot be recognised stays guarded. There is no
// VERCEL=1 exemption here (unlike lib/prisma.ts): a migrate command run on
// Vercel without the override is still refused.
const PRODUCTION_DB_MARKERS = ['hvbbactmgfhecqbetlhg']

function isOfflinePrismaGenerate(argv: readonly string[]): boolean {
  const entry = (argv[1] ?? '').replace(/\\/g, '/').toLowerCase()
  // node_modules/prisma/build/index.js (Windows shim, resolved symlink) or
  // node_modules/.bin/prisma (POSIX symlink as invoked by npm/npx on Linux).
  const isPrismaCli = /\/node_modules\/prisma\/build\/index\.js$/.test(entry) || /\/node_modules\/\.bin\/prisma$/.test(entry)
  if (!isPrismaCli) return false
  const args = argv.slice(2)
  const command = args.find((a) => !a.startsWith('-'))
  if (command !== 'generate') return false
  return !args.some((a) => a === '--sql' || a.startsWith('--sql='))
}

const offlineGenerate = isOfflinePrismaGenerate(process.argv)
const allowProduction =
  process.env.CXJOBS_ALLOW_PRODUCTION_DATABASE === 'I_UNDERSTAND_THIS_IS_PRODUCTION'
for (const [name, value] of [
  ['DIRECT_DATABASE_URL', process.env.DIRECT_DATABASE_URL],
  ['DIRECT_URL', process.env.DIRECT_URL],
  ['DATABASE_URL', process.env.DATABASE_URL],
] as const) {
  if (offlineGenerate) break
  if (value && PRODUCTION_DB_MARKERS.some((m) => value.toLowerCase().includes(m)) && !allowProduction) {
    throw new Error(
      `Refusing to run the Prisma CLI against the PRODUCTION database (${name}). ` +
        'For an approved operation only, load the production env file explicitly and set ' +
        'CXJOBS_ALLOW_PRODUCTION_DATABASE=I_UNDERSTAND_THIS_IS_PRODUCTION for that single command.'
    )
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx ./prisma/seed.ts',
  },
  ...(directUrl && !offlineGenerate ? { datasource: { url: directUrl } } : {}),
})

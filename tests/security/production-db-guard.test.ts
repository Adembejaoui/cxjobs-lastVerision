/**
 * Release Gate 0: a local process can never reach the production database by
 * accident (runtime client and Prisma CLI config). Pure checks: no database
 * connection is made; the config is only evaluated in a child process.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  assertNotProductionDatabase,
  isProductionDatabaseUrl,
  PRODUCTION_DB_OVERRIDE_VAR,
  PRODUCTION_DB_OVERRIDE_VALUE,
} from "../../lib/security/production-db-guard";

// Synthetic URLs: the real project ref, fake credentials, nothing routable is contacted.
const PROD_DIRECT = "postgresql://postgres:synthetic@db.hvbbactmgfhecqbetlhg.supabase.co:5432/postgres";
const PROD_POOLER = "postgresql://postgres.hvbbactmgfhecqbetlhg:synthetic@aws-0-eu.pooler.supabase.com:6543/postgres";
const LOCAL = "postgresql://cxjobs:cxjobs@localhost:5432/cxjobs_dev";

test("Gate 0: production URLs are recognised (host or pooler user name)", () => {
  assert.equal(isProductionDatabaseUrl(PROD_DIRECT), true);
  assert.equal(isProductionDatabaseUrl(PROD_POOLER), true);
  assert.equal(isProductionDatabaseUrl(LOCAL), false);
  assert.equal(isProductionDatabaseUrl(undefined), false);
});

test("Gate 0: runtime guard refuses production locally; allows Vercel and the explicit override only", () => {
  assert.throws(() => assertNotProductionDatabase(PROD_POOLER, "DATABASE_URL", {}), /PRODUCTION/);
  assert.throws(() => assertNotProductionDatabase(PROD_POOLER, "DATABASE_URL", { [PRODUCTION_DB_OVERRIDE_VAR]: "yes" }), /PRODUCTION/);
  assert.doesNotThrow(() => assertNotProductionDatabase(PROD_POOLER, "DATABASE_URL", { VERCEL: "1" }));
  assert.doesNotThrow(() =>
    assertNotProductionDatabase(PROD_POOLER, "DATABASE_URL", { [PRODUCTION_DB_OVERRIDE_VAR]: PRODUCTION_DB_OVERRIDE_VALUE })
  );
  assert.doesNotThrow(() => assertNotProductionDatabase(LOCAL, "DATABASE_URL", {}));
  try {
    assertNotProductionDatabase(PROD_DIRECT, "DATABASE_URL", {});
  } catch (e) {
    assert.equal(String((e as Error).message).includes("synthetic"), false, "the URL/credential is never echoed");
  }
});

/**
 * Evaluate prisma.config.ts (no Prisma command, no connection) with a given env.
 * `cli` simulates the Prisma CLI process: the CLI loads the config in-process,
 * so process.argv is `[node, <prisma entry>, ...args]`.
 */
function loadPrismaConfig(env: Record<string, string>, cli?: { entry?: string; args: string[] }) {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !/DATABASE_URL|DIRECT_URL|CXJOBS_ALLOW/.test(k)) clean[k] = v;
  }
  const setArgv = cli
    ? `process.argv = [process.execPath, ${JSON.stringify(cli.entry ?? "/vercel/path0/node_modules/.bin/prisma")}, ...${JSON.stringify(cli.args)}];`
    : "";
  return spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "-e",
      `${setArgv} import('./prisma.config.ts').then((m) => console.log('CONFIG_OK datasource=' + Boolean((m.default.default ?? m.default).datasource)))`,
    ],
    // DOTENV_CONFIG_PATH points dotenv at a non-existent file so the local .env
    // never influences the result.
    { env: { ...clean, DOTENV_CONFIG_PATH: "tests/.no-such-env", ...env } as unknown as NodeJS.ProcessEnv, encoding: "utf8", timeout: 60_000 }
  );
}

test("Gate 0: the Prisma CLI config refuses production URLs unless explicitly authorized", () => {
  for (const name of ["DIRECT_DATABASE_URL", "DIRECT_URL", "DATABASE_URL"]) {
    const r = loadPrismaConfig({ [name]: PROD_DIRECT });
    assert.equal(r.stdout.includes("CONFIG_OK"), false, `${name} must be refused`);
    assert.match(r.stderr, /Refusing to run the Prisma CLI against the PRODUCTION database/);
    assert.equal(r.stderr.includes("synthetic"), false, "credential never echoed");
  }
  assert.ok(loadPrismaConfig({ DIRECT_DATABASE_URL: LOCAL }).stdout.includes("CONFIG_OK"), "local database allowed");
  assert.ok(loadPrismaConfig({}).stdout.includes("CONFIG_OK"), "no URL (prisma generate) still loads");
  assert.ok(
    loadPrismaConfig({ DIRECT_DATABASE_URL: PROD_DIRECT, CXJOBS_ALLOW_PRODUCTION_DATABASE: "I_UNDERSTAND_THIS_IS_PRODUCTION" }).stdout.includes("CONFIG_OK"),
    "explicit override for an approved operation"
  );
});

test("Gate 0: `prisma generate` (offline) loads with a production URL, without receiving the datasource", () => {
  const entries = [
    "/vercel/path0/node_modules/.bin/prisma", // npm postinstall on Vercel/Linux
    "/vercel/path0/node_modules/prisma/build/index.js",
    "C:\\Users\\dev\\cxjobs\\node_modules\\prisma\\build\\index.js", // Windows .cmd shim
  ];
  for (const entry of entries) {
    for (const name of ["DATABASE_URL", "DIRECT_DATABASE_URL"]) {
      const r = loadPrismaConfig({ [name]: PROD_POOLER }, { entry, args: ["generate"] });
      assert.ok(r.stdout.includes("CONFIG_OK datasource=false"), `generate via ${entry} with ${name}: ${r.stderr}`);
    }
  }
  const flagged = loadPrismaConfig({ DATABASE_URL: PROD_POOLER }, { args: ["generate", "--no-hints", "--schema", "prisma/schema.prisma"] });
  assert.ok(flagged.stdout.includes("CONFIG_OK datasource=false"), "generate with offline flags");
  // Local URL: generate also leaves the datasource out; other commands keep it.
  assert.ok(loadPrismaConfig({ DIRECT_DATABASE_URL: LOCAL }, { args: ["generate"] }).stdout.includes("datasource=false"));
  assert.ok(loadPrismaConfig({ DIRECT_DATABASE_URL: LOCAL }, { args: ["migrate", "status"] }).stdout.includes("datasource=true"));
});

test("Gate 0: every other Prisma command (and anything not clearly offline generate) stays refused", () => {
  const refused: { entry?: string; args: string[] }[] = [
    { args: ["migrate", "deploy"] },
    { args: ["migrate", "dev"] },
    { args: ["migrate", "reset", "--force"] },
    { args: ["migrate", "status"] },
    { args: ["db", "push"] },
    { args: ["db", "pull"] },
    { args: ["db", "seed"] },
    { args: ["db", "execute", "--stdin"] },
    { args: ["studio"] },
    { args: ["migrate", "generate"] }, // `generate` not in command position
    { args: ["generate", "--sql"] }, // TypedSQL connects to the database
    { args: ["generate", "--sql=true"] },
    { args: ["--schema", "prisma/schema.prisma", "generate"] }, // unrecognised shape: fail closed
    { args: [] },
    { entry: "/vercel/path0/prisma/seed.ts", args: ["generate"] }, // not the Prisma CLI
    { entry: "/vercel/path0/node_modules/.bin/tsx", args: ["generate"] },
  ];
  for (const cli of refused) {
    const r = loadPrismaConfig({ DATABASE_URL: PROD_POOLER }, cli);
    assert.equal(r.stdout.includes("CONFIG_OK"), false, `${cli.entry ?? "prisma"} ${cli.args.join(" ")} must be refused`);
    assert.match(r.stderr, /Refusing to run the Prisma CLI against the PRODUCTION database/);
    assert.equal(r.stderr.includes("synthetic"), false, "credential never echoed");
  }
  // The explicit override is still what authorizes an approved operation.
  const approved = loadPrismaConfig(
    { DIRECT_DATABASE_URL: PROD_DIRECT, [PRODUCTION_DB_OVERRIDE_VAR]: PRODUCTION_DB_OVERRIDE_VALUE },
    { args: ["migrate", "deploy"] }
  );
  assert.ok(approved.stdout.includes("CONFIG_OK datasource=true"), "override authorizes migrate deploy");
  // VERCEL=1 alone does not authorize CLI commands (only the runtime client).
  const onVercel = loadPrismaConfig({ DATABASE_URL: PROD_POOLER, VERCEL: "1" }, { args: ["migrate", "deploy"] });
  assert.equal(onVercel.stdout.includes("CONFIG_OK"), false, "VERCEL=1 is not a CLI override");
});

test("Gate 0.1: every tracked file that opens a database connection calls a production guard", async () => {
  const fs = await import("node:fs");
  const tracked = spawnSync("git", ["ls-files", "--", "*.ts", "*.tsx", "*.js", "*.mjs", "*.cjs"], { encoding: "utf8" })
    .stdout.split(/\r?\n/)
    .filter((f) => f && !f.startsWith("tests/") && !f.startsWith("app/generated/") && fs.existsSync(f));
  assert.ok(tracked.length > 50, "git ls-files returned the repository's files");
  const opensConnection = /new\s+(?:Client|Pool)\s*\(|new\s+PrismaPg\s*\(/;
  const guarded = /assertNotProductionDatabase\s*\(|assertSeedTargetAllowed\s*\(/;
  const offenders = tracked.filter((f) => {
    const src = fs.readFileSync(f, "utf8");
    return opensConnection.test(src) && !guarded.test(src);
  });
  assert.deepEqual(offenders, [], `unguarded database connection(s): ${offenders.join(", ")}`);
});

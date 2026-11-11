import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Phase 3 / H1: trigram search indexes.
 *
 * The defect was invisible to every other test: migrations created the
 * trigram indexes and later migrations dropped them again, so a database
 * built by `prisma migrate deploy` had none. These tests replay the migration
 * history statically (no database) and check the schema declarations that
 * stop `prisma migrate dev` from generating DROPs in the future.
 */

const ROOT = path.resolve(__dirname, "../..");
const MIGRATIONS = path.join(ROOT, "prisma", "migrations");
const SCHEMA = fs.readFileSync(path.join(ROOT, "prisma", "schema.prisma"), "utf8");

const REQUIRED: Array<{ name: string; table: string; column: string }> = [
  { name: "idx_job_offers_title_trgm", table: "job_offers", column: "title" },
  { name: "idx_job_offers_description_trgm", table: "job_offers", column: "description" },
  { name: "idx_job_offers_custom_location_trgm", table: "job_offers", column: "customLocation" },
  { name: "idx_companies_name_trgm", table: "companies", column: "name" },
  { name: "idx_companies_location_trgm", table: "companies", column: "location" },
];

function migrationDirs(): string[] {
  return fs
    .readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort(); // Prisma applies migrations in lexical (timestamp) order
}

function stripComments(sql: string): string {
  return sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Index names present after applying every migration in order. */
function finalIndexSet(): Set<string> {
  const live = new Set<string>();
  const re = /\b(CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+CONCURRENTLY)?(?:\s+IF\s+NOT\s+EXISTS)?|DROP\s+INDEX(?:\s+CONCURRENTLY)?(?:\s+IF\s+EXISTS)?)\s+"?([A-Za-z0-9_]+)"?/gi;
  for (const dir of migrationDirs()) {
    const sql = stripComments(fs.readFileSync(path.join(MIGRATIONS, dir, "migration.sql"), "utf8"));
    for (const m of sql.matchAll(re)) {
      if (/^CREATE/i.test(m[1])) live.add(m[2]);
      else live.delete(m[2]);
    }
  }
  return live;
}

test("H1: after replaying ALL migrations in order, every trigram search index exists", () => {
  const live = finalIndexSet();
  for (const { name } of REQUIRED) assert.ok(live.has(name), `${name} missing from final migration state`);
});

test("H1: the restore migration is forward-only, idempotent and matches Prisma's definitions", () => {
  const dir = migrationDirs().find((d) => d.endsWith("_restore_trigram_search_indexes"));
  assert.ok(dir, "restore migration not found");
  const sql = stripComments(fs.readFileSync(path.join(MIGRATIONS, dir!, "migration.sql"), "utf8"));
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS pg_trgm;/);
  for (const { name, table, column } of REQUIRED) {
    const expected = `CREATE INDEX IF NOT EXISTS "${name}" ON "${table}" USING GIN ("${column}" gin_trgm_ops);`;
    assert.ok(sql.includes(expected), `missing or different definition: ${expected}`);
  }
  // Additive only: nothing dropped, altered or deleted.
  assert.doesNotMatch(sql, /\b(DROP|ALTER|DELETE|UPDATE|TRUNCATE)\b/i);
  // Must sort after the sessionVersion migration so it never runs out of order.
  assert.ok(dir! > "20261109120000_add_user_session_version");
});

test("H1: schema.prisma declares the same GIN trigram indexes (so `migrate dev` never drops them)", () => {
  for (const { name, column } of REQUIRED) {
    const decl = new RegExp(
      String.raw`@@index\(\[${column}\(ops: raw\("gin_trgm_ops"\)\)\], type: Gin, map: "${name}"\)`
    );
    assert.match(SCHEMA, decl, `schema.prisma does not declare ${name}`);
  }
});

test("migration history: no index is dropped that is still declared in the schema", () => {
  // Every index mapped in the schema with an explicit name must be live at
  // the end of the history; catches future `migrate dev` drift-drops.
  const live = finalIndexSet();
  const mapped = SCHEMA.split(/\r?\n/)
    .filter((line) => line.trim().startsWith("@@index("))
    .map((line) => /map: "([^"]+)"/.exec(line)?.[1])
    .filter((name): name is string => !!name);
  assert.ok(mapped.length >= REQUIRED.length, "expected the trigram index declarations to be found");
  for (const name of mapped) assert.ok(live.has(name), `${name} is declared but dropped by the migration history`);
});

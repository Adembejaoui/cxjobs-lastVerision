import { test } from "node:test";
import assert from "node:assert/strict";
import { emailIsTaken, findUserByEmail, normalizeEmail, type EmailLookupDb } from "../../lib/server/user-email";

type Row = { id: string; email: string };

/**
 * Fake that mimics the DANGEROUS behaviour the helper must defend against:
 * the case-insensitive query is evaluated like SQL ILIKE, so `_` matches any
 * single character and `%` any run of characters.
 */
function fakeDb(rows: Row[]): EmailLookupDb<Row> & { calls: string[] } {
  const calls: string[] = [];
  const ilike = (pattern: string, value: string) => {
    const re = new RegExp(
      "^" + pattern.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/_/g, ".").replace(/%/g, ".*") + "$"
    );
    return re.test(value.toLowerCase());
  };
  return {
    calls,
    async findUnique({ where }) {
      calls.push("exact");
      return rows.find((r) => r.email === where.email) ?? null;
    },
    async findMany({ where, take }) {
      calls.push("insensitive");
      return rows.filter((r) => ilike(where.email.equals, r.email)).slice(0, take);
    },
  };
}

test("normalizeEmail trims and lowercases", () => {
  assert.equal(normalizeEmail("  Alice.B@Example.COM "), "alice.b@example.com");
});

test("exact (indexed) match is used first", async () => {
  const db = fakeDb([{ id: "1", email: "alice@x.io" }]);
  assert.equal((await findUserByEmail(db, "ALICE@x.io"))?.id, "1");
  assert.deepEqual(db.calls, ["exact"]);
});

test("legacy mixed-case row is found via the case-insensitive fallback", async () => {
  const db = fakeDb([{ id: "1", email: "Alice@X.io" }]);
  assert.equal((await findUserByEmail(db, "alice@x.io"))?.id, "1");
});

test("ILIKE wildcard false positives are rejected by the strict re-check", async () => {
  // "a_b@x.io" as an ILIKE pattern also matches "axb@x.io".
  const db = fakeDb([{ id: "victim", email: "axb@x.io" }]);
  assert.equal(await findUserByEmail(db, "a_b@x.io"), null);
  assert.equal(await emailIsTaken(db, "a_b@x.io"), false);
  assert.equal(await findUserByEmail(db, "a%@x.io"), null);
});

test("ambiguous legacy duplicates (case variants) resolve to null, never a guess", async () => {
  const db = fakeDb([
    { id: "1", email: "Bob@x.io" },
    { id: "2", email: "BOB@x.io" },
  ]);
  assert.equal(await findUserByEmail(db, "bob@x.io"), null);
  assert.equal(await emailIsTaken(db, "bob@x.io"), true);
});

test("emailIsTaken detects any case variant", async () => {
  const db = fakeDb([{ id: "1", email: "Carol@X.io" }]);
  assert.equal(await emailIsTaken(db, "carol@x.io"), true);
  assert.equal(await emailIsTaken(db, "dave@x.io"), false);
});

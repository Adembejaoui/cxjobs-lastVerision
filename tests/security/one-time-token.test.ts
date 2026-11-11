import { test } from "node:test";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import pino from "pino";
import {
  consumeOneTimeToken,
  generateOneTimeToken,
  hashOneTimeToken,
  type ConsumeDeps,
} from "../../lib/security/one-time-token";
import { REDACT_PATHS } from "../../lib/logger";

interface Row { id: string; userId: string | null; tokenHash: string; expires: Date }

function fakeDb(rows: Row[], activeUsers = new Set(["u1", "u2"])) {
  const passwords: Record<string, string> = {};
  let lock = Promise.resolve();
  const deps: ConsumeDeps<null> & { passwords: typeof passwords; rows: Row[] } = {
    rows,
    passwords,
    // Serialise transactions like a DB would for the conditional delete.
    transaction: async (fn) => {
      const run = lock.then(() => fn(null));
      lock = run.then(() => undefined, () => undefined);
      return run;
    },
    findByHash: async (_tx, h) => rows.find((r) => r.tokenHash === h) ?? null,
    deleteIfValid: async (_tx, id, now) => {
      const i = rows.findIndex((r) => r.id === id && r.expires > now);
      if (i === -1) return 0;
      rows.splice(i, 1);
      return 1;
    },
    isUserActive: async (_tx, userId) => activeUsers.has(userId),
    apply: async (_tx, userId) => {
      passwords[userId] = "new-hash";
    },
  };
  return deps;
}

test("S8: generated tokens are 256-bit hex and only the hash is stored", () => {
  const { token, tokenHash } = generateOneTimeToken();
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.equal(tokenHash, hashOneTimeToken(token));
  assert.notEqual(tokenHash, token);
  assert.notEqual(generateOneTimeToken().token, token);
});

test("S8: valid token resets the password once", async () => {
  const { token, tokenHash } = generateOneTimeToken();
  const db = fakeDb([{ id: "t1", userId: "u1", tokenHash, expires: new Date(Date.now() + 60_000) }]);
  assert.deepEqual(await consumeOneTimeToken(token, db), { ok: true, userId: "u1" });
  assert.equal(db.passwords.u1, "new-hash");
});

test("S8: token reuse is rejected", async () => {
  const { token, tokenHash } = generateOneTimeToken();
  const db = fakeDb([{ id: "t1", userId: "u1", tokenHash, expires: new Date(Date.now() + 60_000) }]);
  await consumeOneTimeToken(token, db);
  assert.deepEqual(await consumeOneTimeToken(token, db), { ok: false, reason: "invalid" });
});

test("S8: concurrent use of one token succeeds at most once", async () => {
  const { token, tokenHash } = generateOneTimeToken();
  const db = fakeDb([{ id: "t1", userId: "u1", tokenHash, expires: new Date(Date.now() + 60_000) }]);
  const results = await Promise.all(Array.from({ length: 5 }, () => consumeOneTimeToken(token, db)));
  assert.equal(results.filter((r) => r.ok).length, 1);
});

test("S8: expired token is rejected and does not change the password", async () => {
  const { token, tokenHash } = generateOneTimeToken();
  const db = fakeDb([{ id: "t1", userId: "u1", tokenHash, expires: new Date(Date.now() - 1) }]);
  assert.deepEqual(await consumeOneTimeToken(token, db), { ok: false, reason: "expired" });
  assert.equal(db.passwords.u1, undefined);
});

test("S8: invalid / malformed tokens are rejected", async () => {
  const db = fakeDb([]);
  for (const t of ["", "abc", "x".repeat(64), null, 123, generateOneTimeToken().token]) {
    assert.equal((await consumeOneTimeToken(t, db)).ok, false);
  }
});

test("S8: a stored HASH presented as a token does not work (DB leak is not replayable)", async () => {
  const { tokenHash } = generateOneTimeToken();
  const db = fakeDb([{ id: "t1", userId: "u1", tokenHash, expires: new Date(Date.now() + 60_000) }]);
  assert.equal((await consumeOneTimeToken(tokenHash, db)).ok, false);
});

test("S8: token for a deactivated account is consumed but has no effect", async () => {
  const { token, tokenHash } = generateOneTimeToken();
  const db = fakeDb([{ id: "t1", userId: "u9", tokenHash, expires: new Date(Date.now() + 60_000) }]);
  assert.equal((await consumeOneTimeToken(token, db)).ok, false);
  assert.equal(db.passwords.u9, undefined);
});

test("S8/S10: logger redacts tokens, passwords, cookies and raw bodies", () => {
  const lines: string[] = [];
  const sink = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  const log = pino({ redact: { paths: REDACT_PATHS, censor: "[REDACTED]" } }, sink);
  const secret = generateOneTimeToken().token;
  log.info(
    {
      token: secret,
      password: "Hunter2!",
      body: { email: "a@b.c", password: "Hunter2!" },
      ctx: { resetUrl: `https://cxjobs.app/reset?token=${secret}`, cookie: "authjs.session-token=abc" },
      headers: { cookie: "authjs.session-token=abc", authorization: "Bearer x" },
      userId: "u1",
    },
    "event"
  );
  const out = lines.join("");
  assert.equal(out.includes(secret), false);
  assert.equal(out.includes("Hunter2!"), false);
  assert.equal(out.includes("authjs.session-token"), false);
  assert.equal(out.includes("Bearer x"), false);
  assert.ok(out.includes('"userId":"u1"'));
});

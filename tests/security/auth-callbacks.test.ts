import { test } from "node:test";
import assert from "node:assert/strict";
import {
  authorizeCredentials,
  isEmailVerificationRequired,
  jwtCallback,
  type CredentialsUserRecord,
  type TokenUserRecord,
} from "../../lib/auth-callbacks";

const NOW = 1_800_000_000_000;
const nowSec = Math.floor(NOW / 1000);

function db(records: Record<string, TokenUserRecord>) {
  const calls: string[] = [];
  return {
    calls,
    loadUser: async (id: string) => {
      calls.push(id);
      return records[id] ?? null;
    },
  };
}

const candidate: TokenUserRecord = {
  id: "u-cand",
  role: "CANDIDATE",
  isActive: true,
  isOnboarded: false,
  emailVerified: null,
  sessionVersion: 0,
};

const freshToken = () => ({ id: "u-cand", role: "CANDIDATE", isOnboarded: false, emailVerified: false, sv: 0, claimsAt: nowSec - 10 });

test("S1: session update cannot escalate a candidate to ADMIN", async () => {
  const d = db({ "u-cand": candidate });
  const out = await jwtCallback(
    { token: freshToken(), trigger: "update", session: { user: { role: "ADMIN" }, role: "ADMIN" } },
    { loadUser: d.loadUser, now: () => NOW }
  );
  assert.equal(out?.role, "CANDIDATE");
});

test("S1: company account cannot become ADMIN or switch identity via update", async () => {
  const d = db({ "u-co": { ...candidate, id: "u-co", role: "COMPANY" } });
  const out = await jwtCallback(
    { token: { id: "u-co", role: "COMPANY", iat: nowSec }, trigger: "update", session: { user: { role: "ADMIN", id: "u-admin" } } },
    { loadUser: d.loadUser, now: () => NOW }
  );
  assert.equal(out?.role, "COMPANY");
  assert.equal(out?.id, "u-co");
});

test("S1: update cannot change the identity (id) claim", async () => {
  const d = db({ "u-cand": candidate, "u-admin": { ...candidate, id: "u-admin", role: "ADMIN" } });
  const out = await jwtCallback(
    { token: freshToken(), trigger: "update", session: { user: { id: "u-admin" }, id: "u-admin" } },
    { loadUser: d.loadUser, now: () => NOW }
  );
  assert.equal(out?.id, "u-cand");
  assert.deepEqual(d.calls, ["u-cand"]);
});

test("S1: client cannot self-set isOnboarded or emailVerified", async () => {
  const d = db({ "u-cand": candidate });
  const out = await jwtCallback(
    { token: freshToken(), trigger: "update", session: { user: { isOnboarded: true, emailVerified: true } } },
    { loadUser: d.loadUser, now: () => NOW }
  );
  assert.equal(out?.isOnboarded, false);
  assert.equal(out?.emailVerified, false);
});

test("S1: legitimate update reflects server-side onboarding completion", async () => {
  const d = db({ "u-cand": { ...candidate, isOnboarded: true } });
  const out = await jwtCallback({ token: freshToken(), trigger: "update", session: {} }, { loadUser: d.loadUser, now: () => NOW });
  assert.equal(out?.isOnboarded, true);
});

test("S1: deleted or deactivated user invalidates the token", async () => {
  assert.equal(await jwtCallback({ token: freshToken(), trigger: "update" }, { loadUser: async () => null, now: () => NOW }), null);
  const d = db({ "u-cand": { ...candidate, isActive: false } });
  assert.equal(await jwtCallback({ token: { ...freshToken(), claimsAt: 0 } }, { loadUser: d.loadUser, now: () => NOW }), null);
});

test("S1: fresh token without update is not re-read (no extra DB load)", async () => {
  const d = db({ "u-cand": candidate });
  const tok = freshToken();
  const out = await jwtCallback({ token: tok }, { loadUser: d.loadUser, now: () => NOW });
  assert.equal(out, tok);
  assert.equal(d.calls.length, 0);
});

test("S1: stale token picks up an admin demotion", async () => {
  const d = db({ "u-x": { ...candidate, id: "u-x", role: "CANDIDATE" } });
  const out = await jwtCallback({ token: { id: "u-x", role: "ADMIN", claimsAt: nowSec - 7200 } }, { loadUser: d.loadUser, now: () => NOW });
  assert.equal(out?.role, "CANDIDATE");
});

test("A: unverified user's session is rejected when verification is required", async () => {
  const d = db({ "u-cand": candidate });
  const out = await jwtCallback(
    { token: freshToken(), trigger: "update" },
    { loadUser: d.loadUser, now: () => NOW, requireEmailVerification: true }
  );
  assert.equal(out, null);
});

test("A: verified user keeps the session when verification is required", async () => {
  const d = db({ "u-cand": { ...candidate, emailVerified: new Date(NOW) } });
  const out = await jwtCallback(
    { token: freshToken(), trigger: "update" },
    { loadUser: d.loadUser, now: () => NOW, requireEmailVerification: true }
  );
  assert.equal(out?.emailVerified, true);
});

test("A: trusted provider (Google email_verified) marks the account verified on sign-in", async () => {
  let marked = "";
  const d = db({ "u-g": { ...candidate, id: "u-g" } });
  const out = await jwtCallback(
    { token: {}, user: { id: "u-g" }, trigger: "signIn", providerVerifiedEmail: true },
    {
      loadUser: d.loadUser,
      now: () => NOW,
      requireEmailVerification: true,
      markEmailVerified: async (id) => {
        marked = id;
      },
    }
  );
  assert.equal(marked, "u-g");
  assert.equal(out?.emailVerified, true);
});

test("A: providerVerifiedEmail is ignored outside sign-in (cannot be smuggled via update)", async () => {
  let marked = false;
  const d = db({ "u-cand": candidate });
  const out = await jwtCallback(
    { token: freshToken(), trigger: "update", providerVerifiedEmail: true },
    {
      loadUser: d.loadUser,
      now: () => NOW,
      requireEmailVerification: true,
      markEmailVerified: async () => {
        marked = true;
      },
    }
  );
  assert.equal(marked, false);
  assert.equal(out, null);
});

const DUMMY = "$dummy";
function authDeps(record: CredentialsUserRecord | null, requireVerification = false) {
  const compared: string[] = [];
  return {
    compared,
    deps: {
      findUserByEmail: async () => record,
      comparePassword: async (plain: string, hash: string) => {
        compared.push(hash);
        return hash === "hash-ok" && plain === "right";
      },
      dummyHash: DUMMY,
      requireEmailVerification: requireVerification,
    },
  };
}

const credUser: CredentialsUserRecord = {
  id: "u1",
  email: "a@b.c",
  name: null,
  role: "CANDIDATE",
  isActive: true,
  isOnboarded: false,
  passwordHash: "hash-ok",
  emailVerified: null,
};

test("A: unverified credentials login is rejected when required", async () => {
  const { deps } = authDeps(credUser, true);
  assert.deepEqual(await authorizeCredentials("a@b.c", "right", deps), { ok: false, reason: "unverified" });
});

test("A: verified credentials login succeeds when required", async () => {
  const { deps } = authDeps({ ...credUser, emailVerified: new Date() }, true);
  assert.equal((await authorizeCredentials("a@b.c", "right", deps)).ok, true);
});

test("A: verification status is not revealed for a wrong password", async () => {
  const { deps } = authDeps(credUser, true);
  assert.deepEqual(await authorizeCredentials("a@b.c", "wrong", deps), { ok: false, reason: "invalid" });
});

test("A: flag off preserves existing behaviour (unverified may log in)", async () => {
  const { deps } = authDeps(credUser, false);
  assert.equal((await authorizeCredentials("a@b.c", "right", deps)).ok, true);
});

test("login: unknown user still performs a dummy bcrypt comparison", async () => {
  const { deps, compared } = authDeps(null);
  assert.deepEqual(await authorizeCredentials("x@y.z", "pw", deps), { ok: false, reason: "invalid" });
  assert.deepEqual(compared, [DUMMY]);
});

test("login: inactive user is rejected", async () => {
  const { deps } = authDeps({ ...credUser, isActive: false });
  assert.equal((await authorizeCredentials("a@b.c", "right", deps)).ok, false);
});

test("A: flag parsing", () => {
  assert.equal(isEmailVerificationRequired({}), false);
  assert.equal(isEmailVerificationRequired({ REQUIRE_EMAIL_VERIFICATION: "true" }), true);
  assert.equal(isEmailVerificationRequired({ REQUIRE_EMAIL_VERIFICATION: "1" }), true);
  assert.equal(isEmailVerificationRequired({ REQUIRE_EMAIL_VERIFICATION: "yes-please" }), false);
});

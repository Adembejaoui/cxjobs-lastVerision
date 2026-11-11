import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { assertEnv, runStartupEnvValidation, validateEnv } from "../../lib/env";
import { logger } from "../../lib/logger";

/** A complete, valid production environment with secret-shaped values. */
const SECRET_MARK = "S3CR3T";
const PROD: Record<string, string> = {
  NODE_ENV: "production",
  DATABASE_URL: `postgresql://user:${SECRET_MARK}pw@db.example:6543/app?pgbouncer=true`,
  AUTH_SECRET: `${SECRET_MARK}-auth-secret-0123456789abcdefghij`,
  UPSTASH_REDIS_REST_URL: "https://redis.example",
  UPSTASH_REDIS_REST_TOKEN: `${SECRET_MARK}-upstash`,
  NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: `${SECRET_MARK}-service-role`,
  INVITATION_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  APP_URL: "https://cxjobs.example",
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: `${SECRET_MARK}-resend`,
  EMAIL_FROM: "CXJobs <no-reply@cxjobs.example>",
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: `${SECRET_MARK}-google`,
  OPENAI_API_KEY: `${SECRET_MARK}-openai`,
  // Launch plan A2: the nightly expiry run needs it (warning when missing).
  CRON_SECRET: `${SECRET_MARK}-cron-secret-0123456789`,
};

const without = (...names: string[]) => Object.fromEntries(Object.entries(PROD).filter(([k]) => !names.includes(k)));
const errorNames = (env: Record<string, string>) => validateEnv(env).errors.flatMap((e) => e.names);

test("H7: a complete production environment is valid with no warnings", () => {
  const r = validateEnv(PROD);
  assert.equal(r.valid, true);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("H7: each runtime requirement is fatal in production when missing", () => {
  for (const name of ["DATABASE_URL", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "INVITATION_TOKEN_ENCRYPTION_KEY"]) {
    assert.ok(errorNames(without(name)).includes(name), name);
  }
});

test("H7: either AUTH_SECRET or NEXTAUTH_SECRET satisfies the secret requirement", () => {
  assert.equal(validateEnv(without("AUTH_SECRET")).valid, false);
  assert.equal(validateEnv({ ...without("AUTH_SECRET"), NEXTAUTH_SECRET: PROD.AUTH_SECRET }).valid, true);
});

test("H7: migration-only and optional variables are NOT required at runtime", () => {
  // The old validator demanded these and would have crashed valid deployments.
  for (const name of ["DIRECT_DATABASE_URL", "NEXTAUTH_URL", "NEXTAUTH_SECRET"]) {
    assert.equal(validateEnv(without(name)).valid, true, name);
  }
  // Optional features only warn.
  const r = validateEnv(without("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "OPENAI_API_KEY", "RESEND_API_KEY"));
  assert.equal(r.valid, true);
  const warned = r.warnings.flatMap((w) => w.names);
  for (const n of ["GOOGLE_CLIENT_ID", "OPENAI_API_KEY", "RESEND_API_KEY"]) assert.ok(warned.includes(n), n);
});

test("H7: malformed values are rejected by format (invitation key, DB URL)", () => {
  assert.ok(errorNames({ ...PROD, INVITATION_TOKEN_ENCRYPTION_KEY: "your-invitation-token-encryption-key-here" }).includes("INVITATION_TOKEN_ENCRYPTION_KEY"));
  assert.ok(errorNames({ ...PROD, DATABASE_URL: "mysql://x@y/z" }).includes("DATABASE_URL"));
});

test("H7: dangerous-but-legal combinations warn (verification without email; http app URL in prod)", () => {
  const r = validateEnv({ ...without("RESEND_API_KEY", "EMAIL_FROM"), EMAIL_PROVIDER: "disabled", REQUIRE_EMAIL_VERIFICATION: "true", APP_URL: "http://cxjobs.example" });
  assert.equal(r.valid, true);
  const reasons = r.warnings.map((w) => `${w.names.join(",")}: ${w.reason}`).join("\n");
  assert.match(reasons, /REQUIRE_EMAIL_VERIFICATION/);
  assert.match(reasons, /not https/);
});

test("H7: outside production nothing is fatal (local dev / CI keep working)", () => {
  const r = validateEnv({ NODE_ENV: "development" });
  assert.equal(r.valid, true);
  assert.ok(r.warnings.some((w) => w.names.includes("DATABASE_URL")));
  assert.doesNotThrow(() => assertEnv({ NODE_ENV: "test" }));
});

test("H7: no variable VALUE ever appears in results, log lines or the thrown error", () => {
  const broken = { ...PROD, INVITATION_TOKEN_ENCRYPTION_KEY: `${SECRET_MARK}-bad-key`, DATABASE_URL: `mysql://u:${SECRET_MARK}@h/d`, AUTH_SECRET: `${SECRET_MARK}x` };
  delete (broken as Record<string, string | undefined>).UPSTASH_REDIS_REST_TOKEN;
  const logged: string[] = [];
  const spies = (["warn", "error"] as const).map((level) =>
    mock.method(logger, level, (m: string, d?: unknown) => {
      logged.push(`${m} ${JSON.stringify(d)}`);
    })
  );
  let thrown = "";
  try {
    runStartupEnvValidation(broken);
  } catch (e) {
    thrown = (e as Error).message;
  } finally {
    spies.forEach((s) => s.mock.restore());
  }
  assert.ok(thrown.length > 0, "fatal production problems must throw");
  assert.match(thrown, /UPSTASH_REDIS_REST_TOKEN/);
  const everything = [thrown, ...logged, JSON.stringify(validateEnv(broken))].join("\n");
  assert.doesNotMatch(everything, new RegExp(SECRET_MARK));
});

test("H7: instrumentation skips validation during `next build` and on non-Node runtimes", async () => {
  const saved = { phase: process.env.NEXT_PHASE, runtime: process.env.NEXT_RUNTIME, node: process.env.NODE_ENV };
  const spy = mock.method(logger, "error", () => {});
  try {
    const { register } = await import("../../instrumentation");
    // A production build with an empty environment must NOT throw.
    Object.assign(process.env, { NEXT_PHASE: "phase-production-build", NEXT_RUNTIME: "nodejs", NODE_ENV: "production" });
    await assert.doesNotReject(register());
    Object.assign(process.env, { NEXT_PHASE: "phase-production-server", NEXT_RUNTIME: "edge" });
    await assert.doesNotReject(register());
    // Real production server start with Redis unset (as in this test env): fails fast, by name.
    const savedRedis = process.env.UPSTASH_REDIS_REST_URL;
    process.env.UPSTASH_REDIS_REST_URL = "";
    Object.assign(process.env, { NEXT_RUNTIME: "nodejs" });
    try {
      await assert.rejects(register(), /UPSTASH_REDIS_REST_URL/);
    } finally {
      if (savedRedis === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
      else process.env.UPSTASH_REDIS_REST_URL = savedRedis;
    }
  } finally {
    spy.mock.restore();
    // NODE_ENV is typed read-only; restore through an untyped view of the same object.
    const env = process.env as Record<string, string | undefined>;
    for (const [k, v] of [["NEXT_PHASE", saved.phase], ["NEXT_RUNTIME", saved.runtime], ["NODE_ENV", saved.node]] as const) {
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
  }
});

/**
 * Startup environment validation (Phase 3 / H7).
 *
 * Runs once per server process from `instrumentation.ts` (never during
 * `next build`, which intentionally uses placeholders). Reports variable
 * NAMES only — values are never logged, echoed or included in errors.
 *
 * Severity:
 *  - FATAL (production only): settings without which the app cannot serve
 *    requests correctly. Most of them already crash individual modules at
 *    import time; validating up front reports ALL problems at once, by name,
 *    instead of the first module that happens to load.
 *  - WARNING: optional features that degrade silently when misconfigured
 *    (email, Google sign-in, AI, link base URL). Logged, never fatal.
 *
 * Outside production nothing is fatal: local development and tests keep
 * working with partial configuration.
 */
import { logger } from "./logger";

export type EnvMode = "production" | "development";

export interface EnvIssue {
  /** Variable name(s) concerned — never values. */
  names: string[];
  reason: string;
}

export interface EnvValidationResult {
  valid: boolean;
  /** Fatal in production. */
  errors: EnvIssue[];
  warnings: EnvIssue[];
}

type Env = Record<string, string | undefined>;

const has = (env: Env, name: string) => typeof env[name] === "string" && env[name]!.trim() !== "";

function isUrl(value: string | undefined, protocols: string[]): boolean {
  if (!value) return false;
  try {
    return protocols.includes(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
}

function isBase64Key32(value: string | undefined): boolean {
  if (!value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.trim())) return false;
  return Buffer.from(value.trim(), "base64").length === 32;
}

/** Production runtime requirements: missing → the app cannot work. */
const REQUIRED_IN_PRODUCTION: Array<{ names: string[]; anyOf?: boolean; reason: string }> = [
  { names: ["DATABASE_URL"], reason: "database connection (pooled) is required" },
  { names: ["AUTH_SECRET", "NEXTAUTH_SECRET"], anyOf: true, reason: "session signing secret is required (either name)" },
  { names: ["UPSTASH_REDIS_REST_URL"], reason: "rate limiting and session revocation require Redis" },
  { names: ["UPSTASH_REDIS_REST_TOKEN"], reason: "rate limiting and session revocation require Redis" },
  { names: ["NEXT_PUBLIC_SUPABASE_URL"], reason: "file storage is required" },
  { names: ["SUPABASE_SERVICE_ROLE_KEY"], reason: "file storage is required" },
  { names: ["INVITATION_TOKEN_ENCRYPTION_KEY"], reason: "company invitations require the encryption key" },
];

export function validateEnv(env: Env = process.env, mode: EnvMode = env.NODE_ENV === "production" ? "production" : "development"): EnvValidationResult {
  const errors: EnvIssue[] = [];
  const warnings: EnvIssue[] = [];
  const prod = mode === "production";
  // Outside production, "required" problems are reported as warnings.
  const fail = (issue: EnvIssue) => (prod ? errors : warnings).push(issue);

  for (const req of REQUIRED_IN_PRODUCTION) {
    const present = req.anyOf ? req.names.some((n) => has(env, n)) : req.names.every((n) => has(env, n));
    if (!present) fail({ names: req.names, reason: `missing: ${req.reason}` });
  }

  // ── Format checks on present values (names only in messages) ──
  if (has(env, "DATABASE_URL") && !isUrl(env.DATABASE_URL, ["postgresql:", "postgres:"])) {
    fail({ names: ["DATABASE_URL"], reason: "is not a postgresql:// URL" });
  }
  if (has(env, "UPSTASH_REDIS_REST_URL") && !isUrl(env.UPSTASH_REDIS_REST_URL, ["https:", "http:"])) {
    fail({ names: ["UPSTASH_REDIS_REST_URL"], reason: "is not a URL" });
  }
  if (has(env, "NEXT_PUBLIC_SUPABASE_URL") && !isUrl(env.NEXT_PUBLIC_SUPABASE_URL, ["https:", "http:"])) {
    fail({ names: ["NEXT_PUBLIC_SUPABASE_URL"], reason: "is not a URL" });
  }
  if (has(env, "INVITATION_TOKEN_ENCRYPTION_KEY") && !isBase64Key32(env.INVITATION_TOKEN_ENCRYPTION_KEY)) {
    fail({ names: ["INVITATION_TOKEN_ENCRYPTION_KEY"], reason: "must be base64 of exactly 32 bytes" });
  }
  const secret = env.AUTH_SECRET ?? env.NEXTAUTH_SECRET;
  if (secret && secret.trim().length < 32) {
    warnings.push({ names: ["AUTH_SECRET"], reason: "is shorter than 32 characters; use `openssl rand -base64 32`" });
  }

  // ── Optional features (never fatal) ──
  const appUrl = env.APP_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) {
    warnings.push({ names: ["APP_URL", "NEXT_PUBLIC_APP_URL"], reason: "not set: emailed links cannot be built, so no account email is sent" });
  } else if (prod && !isUrl(appUrl, ["https:"])) {
    warnings.push({ names: ["APP_URL", "NEXT_PUBLIC_APP_URL"], reason: "is not https: emailed links are disabled in production" });
  }

  const provider = (env.EMAIL_PROVIDER ?? "disabled").trim().toLowerCase();
  if (provider === "resend") {
    for (const n of ["RESEND_API_KEY", "EMAIL_FROM"]) {
      if (!has(env, n)) warnings.push({ names: [n], reason: "required by EMAIL_PROVIDER=resend: no email will be sent" });
    }
  } else if (provider !== "disabled" && provider !== "") {
    warnings.push({ names: ["EMAIL_PROVIDER"], reason: "unsupported provider: no email will be sent" });
  } else if (prod) {
    warnings.push({ names: ["EMAIL_PROVIDER"], reason: "is disabled: password-reset and verification emails are not sent" });
  }

  const requireVerification = ["true", "1"].includes(env.REQUIRE_EMAIL_VERIFICATION?.trim().toLowerCase() ?? "");
  if (requireVerification && provider !== "resend") {
    warnings.push({
      names: ["REQUIRE_EMAIL_VERIFICATION", "EMAIL_PROVIDER"],
      reason: "verification is required but email delivery is not configured: new credential accounts cannot log in",
    });
  }

  if (has(env, "GOOGLE_CLIENT_ID") !== has(env, "GOOGLE_CLIENT_SECRET")) {
    warnings.push({ names: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], reason: "only one is set: Google sign-in will fail" });
  } else if (!has(env, "GOOGLE_CLIENT_ID") && prod) {
    warnings.push({ names: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], reason: "not set: Google sign-in is unavailable" });
  }

  if (!has(env, "OPENAI_API_KEY")) {
    warnings.push({ names: ["OPENAI_API_KEY"], reason: "not set: AI features are disabled" });
  }

  // A2: the nightly job-expiry run is refused without a strong CRON_SECRET.
  if (prod && (!has(env, "CRON_SECRET") || env.CRON_SECRET!.trim().length < 16)) {
    warnings.push({ names: ["CRON_SECRET"], reason: "not set (or under 16 characters): the nightly job-expiry run is disabled" });
  }
  if (has(env, "AI_DAILY_QUOTA") && !(Number.parseInt(env.AI_DAILY_QUOTA!, 10) > 0)) {
    warnings.push({ names: ["AI_DAILY_QUOTA"], reason: "is not a positive integer: the default daily AI quota is used" });
  }

  return { valid: errors.length === 0, errors, warnings };
}

const describe = (i: EnvIssue) => `${i.names.join(" / ")} ${i.reason}`;

/** Throws (names only) when any FATAL problem exists. */
export function assertEnv(env: Env = process.env, mode?: EnvMode): void {
  const result = validateEnv(env, mode);
  if (!result.valid) {
    throw new Error(`Environment validation failed:\n- ${result.errors.map(describe).join("\n- ")}`);
  }
}

/**
 * Called once from instrumentation.ts at server start. Production: logs every
 * problem by name, then throws on fatal ones so a misconfigured deployment
 * fails immediately and visibly. Elsewhere: warnings only.
 */
export function runStartupEnvValidation(env: Env = process.env): EnvValidationResult {
  const result = validateEnv(env);
  for (const w of result.warnings) logger.warn("Environment configuration warning", { names: w.names, reason: w.reason });
  for (const e of result.errors) logger.error("Environment configuration error", { names: e.names, reason: e.reason });
  if (!result.valid) assertEnv(env);
  return result;
}

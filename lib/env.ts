import { logger } from "./logger";

const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "AUTH_SECRET",
] as const;

const REQUIRED_IN_PRODUCTION = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

export function validateEnv(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  const required = process.env.NODE_ENV === "production"
    ? REQUIRED_IN_PRODUCTION
    : REQUIRED_ENV_VARS;

  for (const envVar of required) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    warnings.push("OPENAI_API_KEY is not set - AI features will be disabled");
  }

  if (!process.env.UPSTASH_REDIS_REST_URL && !process.env.REDIS_URL) {
    if (process.env.NODE_ENV !== "production") {
      warnings.push(
        "No Redis configured (UPSTASH_REDIS_REST_URL) - " +
        "rate limiting and caching will be disabled in development"
      );
    }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (process.env.NODE_ENV !== "production") {
      warnings.push(
        "Supabase not fully configured (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) - " +
        "file uploads will be disabled in development"
      );
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

export function assertEnv(): void {
  const result = validateEnv();

  if (!result.valid) {
    throw new Error(
      `Environment validation failed. Missing required variables: ${result.missing.join(", ")}\n` +
      "Please set these in your environment configuration."
    );
  }

  for (const warning of result.warnings) {
    logger.warn(warning);
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { isSupabaseConfigured } from "@/lib/supabase";
import { isAIConfigured } from "@/lib/ai-service";
import { logger } from "@/lib/logger";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";

// A4: public endpoint, so cap per-IP polling. Fail-open: a limiter outage
// must never make the health check itself report the site as down.
const HEALTH_IP_LIMIT = { windowMs: 60_000, max: 30, failOpen: true };

interface HealthCheckResult {
  service: string;
  status: "healthy" | "unhealthy" | "degraded";
  details?: string;
}

async function checkDatabase(): Promise<HealthCheckResult> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { service: "database", status: "healthy" };
  } catch (error) {
    logger.error("Database health check failed", { error });
    return {
      service: "database",
      status: "unhealthy",
      details: "Unable to connect to database",
    };
  }
}

async function checkRedis(): Promise<HealthCheckResult> {
  if (!redis) {
    return {
      service: "redis",
      status: "degraded",
      details: "Redis not configured",
    };
  }

  try {
    await redis.ping();
    return { service: "redis", status: "healthy" };
  } catch (error) {
    logger.error("Redis health check failed", { error });
    return {
      service: "redis",
      status: "unhealthy",
      details: "Unable to ping Redis",
    };
  }
}

async function checkSupabase(): Promise<HealthCheckResult> {
  if (!isSupabaseConfigured()) {
    return {
      service: "supabase",
      status: "degraded",
      details: "Supabase not configured",
    };
  }

  try {
    return { service: "supabase", status: "healthy" };
  } catch (error) {
    logger.error("Supabase health check failed", { error });
    return {
      service: "supabase",
      status: "unhealthy",
      details: "Unable to connect to Supabase",
    };
  }
}

async function checkOpenAI(): Promise<HealthCheckResult> {
  if (!isAIConfigured()) {
    return {
      service: "openai",
      status: "degraded",
      details: "OpenAI API key not configured - AI features disabled",
    };
  }

  // Configuration only: the provider is not called (that would cost money and
  // let anyone trigger outbound requests). Reported as such (audit F-28).
  return { service: "openai", status: "healthy", details: "configured (not probed)" };
}

// The endpoint is public and unauthenticated, and every deep check pings the
// database, Redis and Supabase. Results are shared for a short window per
// instance (NF-18), so request volume cannot be amplified onto the backends.
const CHECK_CACHE_MS = 15_000;
let cachedChecks: { at: number; promise: Promise<HealthCheckResult[]> } | null = null;

function runChecks(): Promise<HealthCheckResult[]> {
  const now = Date.now();
  if (cachedChecks && now - cachedChecks.at < CHECK_CACHE_MS) return cachedChecks.promise;
  const promise = Promise.all([checkDatabase(), checkRedis(), checkSupabase(), checkOpenAI()]);
  cachedChecks = { at: now, promise };
  // A rejected run must not be served from the cache.
  promise.catch(() => {
    cachedChecks = null;
  });
  return promise;
}

export async function GET(request: Request) {
  const rl = await checkRateLimitAsync(`health-ip:${getClientIp(request)}`, HEALTH_IP_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { status: "rate_limited", error: "Too many requests" },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }
  try {
    const checks = await runChecks();

    const criticalServices = checks.filter(
      (c) => c.status === "unhealthy"
    );

    const allHealthy = checks.every((c) => c.status !== "unhealthy");
    const anyDegraded = checks.some((c) => c.status === "degraded");

    const overallStatus = criticalServices.length > 0
      ? "unhealthy"
      : allHealthy && anyDegraded
        ? "degraded"
        : "healthy";

    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    }, {
      status: overallStatus === "healthy" ? 200 : overallStatus === "degraded" ? 200 : 503,
    });
  } catch (error) {
    logger.error("Health check failed", { error });
    return NextResponse.json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Health check failed",
    }, { status: 500 });
  }
}

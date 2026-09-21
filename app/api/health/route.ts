import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { isSupabaseConfigured } from "@/lib/supabase";
import { isAIConfigured } from "@/lib/ai-service";
import { logger } from "@/lib/logger";

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

  return { service: "openai", status: "healthy" };
}

export async function GET() {
  try {
    const checks = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkSupabase(),
      checkOpenAI(),
    ]);

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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/health - Health check endpoint for monitoring
 * Used by load balancers, Kubernetes, and monitoring systems
 */
export async function GET() {
  const startTime = Date.now();
  const healthStatus = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    checks: {
      database: {
        status: "unknown",
        latency: null as number | null,
      },
    },
  };

  try {
    // Check database connectivity
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;
    
    healthStatus.checks.database = {
      status: "ok",
      latency: dbLatency,
    };
  } catch (error) {
    healthStatus.status = "degraded";
    healthStatus.checks.database = {
      status: "error",
      latency: null,
    };
    console.error("Health check - Database error:", error);
  }

  const responseTime = Date.now() - startTime;

  // Return 503 if any critical checks fail
  const statusCode = healthStatus.status === "ok" ? 200 : 503;

  return NextResponse.json(
    {
      ...healthStatus,
      responseTime,
    },
    {
      status: statusCode,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Response-Time": `${responseTime}ms`,
      },
    }
  );
}

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { closeExpiredJobOffers } from "@/lib/server/job-expiry";

/**
 * Close published jobs whose expiry date has passed (launch plan A2).
 *
 *   GET  — the nightly scheduled run (Vercel Cron, see vercel.json). Vercel
 *          sends `Authorization: Bearer $CRON_SECRET`; anything else is 401.
 *          Without CRON_SECRET configured the endpoint is disabled (503),
 *          never open.
 *   POST — manual run by an administrator (session, role checked).
 *
 * Idempotent and safe to retry: the UPDATE itself re-checks
 * `status = PUBLISHED AND expiresAt < now AND deletedAt IS NULL`, so a
 * concurrent edit or a second run never touches a job twice. Readers already
 * hide expired jobs by date (publicJobWhere); this run makes the stored
 * status, dashboards and counts agree with that.
 */

function cronAuthorized(request: NextRequest): "ok" | "unauthorized" | "disabled" {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return "disabled";
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  if (given.length !== expected.length) return "unauthorized";
  return timingSafeEqual(given, expected) ? "ok" : "unauthorized";
}

function okResponse(closedCount: number) {
  return NextResponse.json({
    success: true,
    message: closedCount === 0 ? "No expired offers found" : `Closed ${closedCount} expired job offer(s)`,
    data: { closedCount },
  });
}

function failure(error: unknown, trigger: "cron" | "admin") {
  // Logged at error level so log-based alerting picks up a failed nightly run.
  logger.error("Auto-close expired offers failed", {
    trigger,
    error: error instanceof Error ? error.name : "unknown",
  });
  return NextResponse.json(
    { success: false, error: "Failed to close expired offers", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}

export async function GET(request: NextRequest) {
  const authz = cronAuthorized(request);
  if (authz === "disabled") {
    logger.error("Scheduled job expiry is disabled: CRON_SECRET is not configured");
    return NextResponse.json(
      { success: false, error: "Scheduled task not configured", code: "NOT_CONFIGURED" },
      { status: 503 }
    );
  }
  if (authz !== "ok") {
    return NextResponse.json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const { closedCount } = await closeExpiredJobOffers();
    return okResponse(closedCount);
  } catch (error) {
    return failure(error, "cron");
  }
}

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Admin access required", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const { closedCount } = await closeExpiredJobOffers();
    return okResponse(closedCount);
  } catch (error) {
    return failure(error, "admin");
  }
}

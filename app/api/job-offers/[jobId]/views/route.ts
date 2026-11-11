import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { activeCompanyWhere } from "@/lib/security/company-activity";
import { getClientIp } from "@/lib/utils";

// Anti-inflation (NF-07). Both limits fail OPEN: a Redis outage must not
// break job pages, and the worst case is an over-counted view, not a security
// boundary.
const VIEW_IP_LIMIT = { windowMs: 60_000, max: 60, failOpen: true };
// At most one counted view per (visitor IP, job) per hour.
const VIEW_DEDUPE = { windowMs: 60 * 60_000, max: 1, failOpen: true };

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;

    if (!jobId || jobId.length > 200) {
      return NextResponse.json(
        { success: false, error: "Job ID is required", code: "BAD_REQUEST" },
        { status: 400 },
      );
    }

    const ipKey = hashIp(getClientIp(request));
    const ipLimit = await checkRateLimitAsync(`job-view-ip:${ipKey}`, VIEW_IP_LIMIT);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    // Only live jobs are countable: drafts, deleted and expired jobs are not
    // publicly visible, so views on them can only be fabricated.
    const now = new Date();
    const jobOffer = await prisma.jobOffer.findFirst({
      where: {
        OR: [{ id: jobId }, { slug: jobId }],
        status: "PUBLISHED",
        deletedAt: null,
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
        company: activeCompanyWhere(), // F-04: not publicly visible either
      },
      select: { id: true, views: true },
    });

    if (!jobOffer) {
      return NextResponse.json(
        { success: false, error: "Job offer not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // Repeat views from the same visitor within the window are acknowledged
    // but not counted (idempotent, so the client needs no special handling).
    const fresh = await checkRateLimitAsync(`job-view:${jobOffer.id}:${ipKey}`, VIEW_DEDUPE);
    if (!fresh.allowed) {
      return NextResponse.json({ success: true, data: { views: jobOffer.views, counted: false } });
    }

    const updated = await prisma.jobOffer.update({
      where: { id: jobOffer.id },
      data: { views: { increment: 1 } },
      select: { views: true },
    });

    return NextResponse.json({
      success: true,
      data: { views: updated?.views ?? 0, counted: true },
    });
  } catch (error) {
    logger.error("Increment job views error", { error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json(
      { success: false, error: "Failed to increment views", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}

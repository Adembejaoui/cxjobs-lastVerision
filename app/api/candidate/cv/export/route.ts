import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

const COOLDOWN_DAYS = 7;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

function buildCooldownResponse(lastExport: Date, now: Date) {
  const timeSinceLastExport = now.getTime() - lastExport.getTime();
  const remainingMs = COOLDOWN_MS - timeSinceLastExport;
  const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
  const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));

  let timeString = "";
  if (remainingDays > 1) {
    timeString = `${remainingDays} days`;
  } else if (remainingDays === 1) {
    timeString = `${remainingHours} hours`;
  } else {
    timeString = `${remainingMinutes} minutes`;
  }

  return NextResponse.json(
    {
      success: false,
      error: `You can export your CV once every ${COOLDOWN_DAYS} days. Please wait ${timeString} before exporting again.`,
      code: "COOLDOWN_ACTIVE",
      cooldown: {
        remainingMs,
        remainingDays,
        remainingHours,
        remainingMinutes,
        nextExportAt: new Date(lastExport.getTime() + COOLDOWN_MS).toISOString(),
      },
    },
    { status: 429 }
  );
}

export async function GET() {
  try {
    const session = await auth();

    if (!session || session.user.role !== "CANDIDATE") {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const candidate = await prisma.candidate.findUnique({
      where: { userId: session.user.id },
      select: { id: true, lastCvExportAt: true },
    });

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: "Candidate profile not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const now = new Date();
    const lastExport = candidate.lastCvExportAt ? new Date(candidate.lastCvExportAt) : null;

    if (lastExport) {
      const timeSinceLastExport = now.getTime() - lastExport.getTime();
      if (timeSinceLastExport < COOLDOWN_MS) {
        return buildCooldownResponse(lastExport, now);
      }
    }

    return NextResponse.json({
      success: true,
      eligible: true,
      message: "Eligible for CV export",
      nextExportAt: new Date(now.getTime() + COOLDOWN_MS).toISOString(),
    });
  } catch (error) {
    logger.error("CV export eligibility check failed", { error });
    return NextResponse.json(
      { success: false, error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const session = await auth();

    if (!session || session.user.role !== "CANDIDATE") {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const candidate = await prisma.candidate.findUnique({
      where: { userId: session.user.id },
      select: { id: true, lastCvExportAt: true },
    });

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: "Candidate profile not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - COOLDOWN_MS);
    const lastExport = candidate.lastCvExportAt ? new Date(candidate.lastCvExportAt) : null;

    if (lastExport && lastExport >= cutoff) {
      return buildCooldownResponse(lastExport, now);
    }

    const updated = await prisma.candidate.updateMany({
      where: {
        id: candidate.id,
        OR: [
          { lastCvExportAt: null },
          { lastCvExportAt: { lt: cutoff } },
        ],
      },
      data: { lastCvExportAt: now, cvExportCount: { increment: 1 } },
    });

    if (updated.count === 0) {
      const fresh = await prisma.candidate.findUnique({
        where: { id: candidate.id },
        select: { lastCvExportAt: true },
      });
      const freshExport = fresh?.lastCvExportAt ? new Date(fresh.lastCvExportAt) : null;
      if (freshExport) {
        return buildCooldownResponse(freshExport, now);
      }
      return NextResponse.json(
        { success: false, error: "Could not claim export slot", code: "CONCURRENCY_CONFLICT" },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "CV export committed",
      nextExportAt: new Date(now.getTime() + COOLDOWN_MS).toISOString(),
    });
  } catch (error) {
    logger.error("CV export commit failed", { error });
    return NextResponse.json(
      { success: false, error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: "Job ID is required", code: "BAD_REQUEST" },
        { status: 400 },
      );
    }

    // Look up by UUID id, fall back to slug
    const jobOffer = await prisma.jobOffer.findFirst({
      where: {
        OR: [
          { id: jobId },
          { slug: jobId },
        ],
      },
    });

    if (!jobOffer) {
      return NextResponse.json(
        { success: false, error: "Job offer not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const resolvedId = jobOffer.id;

    const updated = await prisma.jobOffer.update({
      where: { id: resolvedId },
      data: { views: { increment: 1 } },
      select: { views: true },
    });

    return NextResponse.json({
      success: true,
      data: { views: updated?.views ?? 0 },
    });
  } catch (error) {
    const errorInfo = error instanceof Error
      ? { message: error.message, name: error.name, stack: error.stack }
      : { error: String(error) };
    logger.error("Increment job views error", { error: errorInfo });
    return NextResponse.json(
      { success: false, error: "Failed to increment views", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}

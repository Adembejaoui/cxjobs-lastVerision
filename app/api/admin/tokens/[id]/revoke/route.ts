import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { isValidUuid } from "@/lib/utils";
import { logger } from "@/lib/logger";

const TOKEN_REVOKE_LIMIT = { windowMs: 60_000, max: 30 };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const adminUser = authResult.user;

    const rl = await checkRateLimitAsync(
      `admin-token-revoke:${adminUser.id}`,
      TOKEN_REVOKE_LIMIT
    );
    if (!rl.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many requests. Please try again later.",
          code: "RATE_LIMITED",
        },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const { id } = await params;

    if (!id || !isValidUuid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid invitation ID", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    const existing = await prisma.companyInvitation.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        revokedAt: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Invitation not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (existing.revokedAt) {
      return NextResponse.json({ success: true });
    }

    if (existing.status !== "PENDING") {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot revoke an invitation with status: ${existing.status}`,
          code: "CONFLICT",
        },
        { status: 409 }
      );
    }

    await prisma.companyInvitation.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    logger.info("COMPANY_INVITATION_TOKEN_REVOKED", {
      invitationId: id,
      adminId: adminUser.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to revoke company invitation token", { error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to revoke invitation",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

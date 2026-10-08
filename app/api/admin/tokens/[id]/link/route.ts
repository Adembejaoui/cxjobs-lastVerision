import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { isValidUuid } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { decryptToken } from "@/lib/server/invitation-token-crypto";

const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000";

// In production the app URL must be explicitly configured. Falling back to
// NEXTAUTH_URL or localhost would silently generate broken invitation links
// in emails. Validate at module load so the failure is loud, not silent.
if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error(
    "NEXT_PUBLIC_APP_URL environment variable is required in production. " +
    "Set it to the canonical application URL (e.g. https://app.example.com)."
  );
}

const TOKEN_LINK_LIMIT = { windowMs: 60_000, max: 30 };

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
      `admin-token-link:${adminUser.id}`,
      TOKEN_LINK_LIMIT
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

    const invitation = await prisma.companyInvitation.findUnique({
      where: { id },
      select: {
        id: true,
        tokenEncrypted: true,
        status: true,
        revokedAt: true,
        usedAt: true,
        expiresAt: true,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: "Invitation not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const now = new Date();

    if (
      invitation.status !== "PENDING" ||
      invitation.revokedAt !== null ||
      invitation.usedAt !== null ||
      invitation.expiresAt < now
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invitation link is no longer available.",
          code: "CONFLICT",
        },
        { status: 409 }
      );
    }

    if (!invitation.tokenEncrypted) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invitation link is unavailable for this invitation. Please generate a new invitation.",
          code: "CONFLICT",
        },
        { status: 409 }
      );
    }

    const rawToken = decryptToken(invitation.tokenEncrypted);
    const link = `${APP_BASE_URL}/onboarding/company?token=${rawToken}`;

    logger.info("COMPANY_INVITATION_LINK_COPIED", {
      invitationId: invitation.id,
      adminId: adminUser.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          link,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error("Failed to retrieve company invitation link", { error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve invitation link",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
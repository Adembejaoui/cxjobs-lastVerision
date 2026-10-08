import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { parsePaginationParams } from "@/lib/utils";
import { logger } from "@/lib/logger";
import {
  createCompanyInvitationSchema,
  companyInvitationStatuses,
  type CompanyInvitationStatus,
  isValidCompanyInvitationStatus,
} from "@/lib/validations/company-invitation";
import crypto from "crypto";
import { encryptToken } from "@/lib/server/invitation-token-crypto";

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

const TOKEN_GENERATE_LIMIT = { windowMs: 60_000, max: 10 };
const TOKEN_LIST_LIMIT = { windowMs: 60_000, max: 60 };

function mapInvitation(invitation: {
  id: string;
  companyName: string;
  companyEmail: string;
  managerName: string | null;
  managerEmail: string | null;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  status: CompanyInvitationStatus;
}) {
  return {
    id: invitation.id,
    companyName: invitation.companyName,
    companyEmail: invitation.companyEmail,
    managerName: invitation.managerName,
    managerEmail: invitation.managerEmail,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    usedAt: invitation.usedAt,
    revokedAt: invitation.revokedAt,
    status: invitation.status,
  };
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const adminUser = authResult.user;

    const rl = await checkRateLimitAsync(
      `admin-token-create:${adminUser.id}`,
      TOKEN_GENERATE_LIMIT
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    const validation = createCompanyInvitationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const { managerName, managerEmail, companyName, companyEmail, durationDays } =
      validation.data;

    // Normalize companyEmail for validation
    const normalizedCompanyEmail = companyEmail.trim().toLowerCase();

    // Check if companyEmail is already used by any User
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedCompanyEmail },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "This company email is already associated with a user account.",
          code: "COMPANY_EMAIL_IN_USE",
        },
        { status: 409 }
      );
    }

    // Check if managerEmail equals companyEmail
    if (managerEmail) {
      const normalizedManagerEmail = managerEmail.trim().toLowerCase();
      if (normalizedManagerEmail === normalizedCompanyEmail) {
        return NextResponse.json(
          {
            success: false,
            error: "Company email cannot be the same as the manager email.",
            code: "COMPANY_EMAIL_IN_USE",
          },
          { status: 409 }
        );
      }
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const tokenEncrypted = encryptToken(rawToken);

    const expiresAt = new Date(
      Date.now() + durationDays * 24 * 60 * 60 * 1000
    );

    const invitation = await prisma.companyInvitation.create({
      data: {
        tokenHash,
        tokenEncrypted,
        companyName,
        companyEmail,
        managerName: managerName ?? null,
        managerEmail: managerEmail ?? null,
        expiresAt,
        status: "PENDING",
      },
      select: {
        id: true,
        companyName: true,
        companyEmail: true,
        managerName: true,
        managerEmail: true,
        createdAt: true,
        expiresAt: true,
        status: true,
      },
    });

    const link = `${APP_BASE_URL}/onboarding/company?token=${rawToken}`;

    logger.info("COMPANY_INVITATION_TOKEN_GENERATED", {
      invitationId: invitation.id,
      adminId: adminUser.id,
      companyEmail,
      durationDays,
      expiresAt,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: invitation.id,
          companyName: invitation.companyName,
          companyEmail: invitation.companyEmail,
          managerName: invitation.managerName,
          managerEmail: invitation.managerEmail,
          createdAt: invitation.createdAt,
          expiresAt: invitation.expiresAt,
          status: invitation.status,
          link,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Failed to generate company invitation token", { error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate invitation",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const adminUser = authResult.user;

    const rl = await checkRateLimitAsync(
      `admin-token-list:${adminUser.id}`,
      TOKEN_LIST_LIMIT
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

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    );

    const search = searchParams.get("search")?.trim() || undefined;
    const statusParam = searchParams.get("status")?.trim().toUpperCase() || undefined;

    if (statusParam && !isValidCompanyInvitationStatus(statusParam)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Allowed values: ${companyInvitationStatuses.join(", ")}`,
          code: "INVALID_STATUS",
        },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {};

    if (statusParam) {
      where.status = statusParam;
    }

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { companyEmail: { contains: search, mode: "insensitive" } },
        { managerName: { contains: search, mode: "insensitive" } },
        { managerEmail: { contains: search, mode: "insensitive" } },
      ];
    }

    const [invitations, total] = await Promise.all([
      prisma.companyInvitation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          companyName: true,
          companyEmail: true,
          managerName: true,
          managerEmail: true,
          createdAt: true,
          expiresAt: true,
          usedAt: true,
          revokedAt: true,
          status: true,
        },
      }),
      prisma.companyInvitation.count({ where }),
    ]);

    const data = invitations.map(mapInvitation);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch company invitations", { error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch invitations",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

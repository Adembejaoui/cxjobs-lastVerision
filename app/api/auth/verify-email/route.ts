import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { checkRateLimitAsync, checkRateLimitsAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { z } from "zod";
import { emailSchema } from "@/lib/validations/auth";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/utils";
import { consumeOneTimeToken } from "@/lib/security/one-time-token";
import { runAfterResponse } from "@/lib/server/after-response";
import { issueEmailVerification } from "@/lib/server/account-emails";

const VERIFY_LIMIT = { windowMs: 60_000, max: 5 };
const RESEND_IP_LIMIT = { windowMs: 60_000, max: 3 };
const RESEND_EMAIL_LIMIT = { windowMs: 60 * 60_000, max: 5 };

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

// POST /api/auth/verify-email - Verify email with token
export async function POST(request: NextRequest) {
  try {
    const rl = await checkRateLimitAsync(`verify-email:${getClientIp(request)}`, VERIFY_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const body = await request.json().catch(() => null);
    const validationResult = verifyEmailSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await consumeOneTimeToken<Tx>(validationResult.data.token, {
      transaction: (fn) => prisma.$transaction(fn),
      findByHash: (tx, tokenHash) =>
        tx.emailVerificationToken.findUnique({
          where: { token: tokenHash },
          select: { id: true, userId: true, expires: true },
        }),
      deleteIfValid: async (tx, id, now) =>
        (await tx.emailVerificationToken.deleteMany({ where: { id, expires: { gt: now } } })).count,
      isUserActive: async (tx, userId) =>
        !!(await tx.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true } })),
      apply: async (tx, userId) => {
        await tx.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
        await tx.emailVerificationToken.deleteMany({ where: { userId } });
      },
    });

    if (!result.ok) {
      return NextResponse.json(
        result.reason === "expired"
          ? { success: false, error: "Verification token has expired", code: "TOKEN_EXPIRED" }
          : { success: false, error: "Invalid verification token", code: "INVALID_TOKEN" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    logger.error("Email verification error", { error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json(
      { success: false, error: "Failed to verify email", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// Request new verification email
const resendSchema = z.object({
  email: emailSchema,
});

// One response for every outcome (unknown, verified, sent) — no enumeration.
const RESEND_RESPONSE = {
  success: true,
  message: "If the email exists and is not yet verified, a verification email has been sent",
} as const;

// PUT /api/auth/verify-email - Resend verification email
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const validationResult = resendSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email } = validationResult.data;
    const emailKey = crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
    const rl = await checkRateLimitsAsync([
      { key: `verify-email-resend-ip:${getClientIp(request)}`, config: RESEND_IP_LIMIT },
      { key: `verify-email-resend-email:${emailKey}`, config: RESEND_EMAIL_LIMIT },
    ]);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    // Account-dependent work runs after the response (no enumeration via
    // body or timing).
    runAfterResponse("verification-email", () => issueEmailVerification({ email }));

    return NextResponse.json(RESEND_RESPONSE);
  } catch (error) {
    logger.error("Resend verification error", { error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json(
      { success: false, error: "Failed to resend verification email", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

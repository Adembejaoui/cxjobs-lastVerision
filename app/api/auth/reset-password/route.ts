import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/utils";
import { consumeOneTimeToken } from "@/lib/security/one-time-token";
import { bumpSessionVersion, publishSessionVersion } from "@/lib/server/session-revocation";

const RESETPW_LIMIT = { windowMs: 60_000, max: 5 };

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function POST(request: NextRequest) {
  try {
    const rl = await checkRateLimitAsync(`reset-pw:${getClientIp(request)}`, RESETPW_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const body = await request.json().catch(() => null);

    const validationResult = resetPasswordSchema.safeParse(body);
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

    const { token, password } = validationResult.data;

    // Hash before touching the token row so the transaction stays short.
    const passwordHash = await bcrypt.hash(password, 12);

    let revokedVersion: number | null = null;
    const result = await consumeOneTimeToken<Tx>(token, {
      transaction: (fn) => prisma.$transaction(fn),
      findByHash: (tx, tokenHash) =>
        tx.passwordResetToken.findUnique({
          where: { token: tokenHash },
          select: { id: true, userId: true, expires: true },
        }),
      deleteIfValid: async (tx, id, now) =>
        (await tx.passwordResetToken.deleteMany({ where: { id, expires: { gt: now } } })).count,
      isUserActive: async (tx, userId) =>
        !!(await tx.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true } })),
      apply: async (tx, userId) => {
        await tx.user.update({ where: { id: userId }, data: { passwordHash } });
        // Revoke any other outstanding reset tokens for this account.
        await tx.passwordResetToken.deleteMany({ where: { userId } });
        // Sign out every existing session, in the same transaction as the change.
        revokedVersion = await bumpSessionVersion(tx, userId);
      },
    });

    if (result.ok && revokedVersion !== null) {
      await publishSessionVersion(result.userId, revokedVersion);
    }

    if (!result.ok) {
      // Same response for unknown, reused, expired, or inactive-account tokens.
      return NextResponse.json(
        { success: false, error: "Invalid or expired reset token", code: "INVALID_TOKEN" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    logger.error("Reset password error", { error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json(
      {
        success: false,
        error: "An error occurred while resetting your password",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

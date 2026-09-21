import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const RESETPW_LIMIT = { windowMs: 60_000, max: 5 };

export async function POST(request: NextRequest) {
  try {

    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rl = await checkRateLimitAsync(`reset-pw:${ip}`, RESETPW_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const body = await request.json();

    // Validate input
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

    // Find valid reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired reset token",
          code: "INVALID_TOKEN",
        },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (resetToken.expires < new Date()) {
      // Delete expired token
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });

      return NextResponse.json(
        {
          success: false,
          error: "Reset token has expired",
          code: "TOKEN_EXPIRED",
        },
        { status: 400 }
      );
    }

    // Check if userId exists
    if (!resetToken.userId || !resetToken.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid reset token - no associated user",
          code: "INVALID_TOKEN",
        },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update user password and delete the used token
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    logger.error("Reset password error", { error });
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

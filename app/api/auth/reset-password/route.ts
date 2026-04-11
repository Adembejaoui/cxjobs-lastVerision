import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { getClientIp } from "@/lib/utils";
import { rateLimitResponse, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting for password reset endpoint
    const clientIp = getClientIp(request);
    const rateLimitResult = rateLimitResponse(clientIp, RATE_LIMIT_PRESETS.PASSWORD_RESET);
    if (rateLimitResult) return rateLimitResult;

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
    console.error("Reset password error:", error);
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

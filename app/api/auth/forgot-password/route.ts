import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import crypto from "crypto";
import { logger } from "@/lib/logger";

const FORGOTPW_LIMIT = { windowMs: 60_000, max: 3 };

export async function POST(request: NextRequest) {
  try {

    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rl = await checkRateLimitAsync(`forgot-pw:${ip}`, FORGOTPW_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const body = await request.json();

    // Validate input
    const validationResult = forgotPasswordSchema.safeParse(body);
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

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "If an account with that email exists, we've sent a password reset link.",
      });
    }

    // Delete any existing reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token to database
    await prisma.passwordResetToken.create({
      data: {
        email,
        token,
        userId: user.id,
        expires,
      },
    });

    // TODO: Send email with reset link
    // The reset URL and token are never logged in production.

    return NextResponse.json({
      success: true,
      message: "If an account with that email exists, we've sent a password reset link.",
    });
  } catch (error) {
    logger.error("Forgot password error", { error });
    return NextResponse.json(
      {
        success: false,
        error: "An error occurred while processing your request",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

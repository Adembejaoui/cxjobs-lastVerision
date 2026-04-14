import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { z } from "zod";

const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

// POST /api/auth/verify-email - Verify email with token
export async function POST(request: NextRequest) {
  try {
    // Rate limiting

    const body = await request.json();
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

    const { token } = validationResult.data;

    // Find the verification token
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { success: false, error: "Invalid verification token", code: "INVALID_TOKEN" },
        { status: 400 }
      );
    }

    if (verificationToken.expires < new Date()) {
      return NextResponse.json(
        { success: false, error: "Verification token has expired", code: "TOKEN_EXPIRED" },
        { status: 400 }
      );
    }

    // Check if userId exists
    if (!verificationToken.userId || !verificationToken.user) {
      return NextResponse.json(
        { success: false, error: "Invalid verification token - no associated user", code: "INVALID_TOKEN" },
        { status: 400 }
      );
    }

    // Update user and delete the used token
    await prisma.$transaction([
      prisma.emailVerificationToken.delete({
        where: { id: verificationToken.id },
      }),
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: {
          emailVerified: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify email", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// Request new verification email
const resendSchema = z.object({
  email: z.string().email("Invalid email address"),
});

// PUT /api/auth/verify-email - Resend verification email
export async function PUT(request: NextRequest) {
  try {
    // Rate limiting

    const body = await request.json();
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

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists
      return NextResponse.json({
        success: true,
        message: "If the email exists, a verification email has been sent",
      });
    }

    // Check if already verified (using emailVerified field)
    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: "Email is already verified",
      });
    }

    // Delete existing tokens for this user
    await prisma.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    });

    // Generate new token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.emailVerificationToken.create({
      data: {
        email,
        token,
        userId: user.id,
        expires,
      },
    });

    // TODO: Send verification email
    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/verify-email?token=${token}`;
    console.log(`Verification URL for ${email}: ${verifyUrl}`);

    return NextResponse.json({
      success: true,
      message: "Verification email sent",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to resend verification email", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

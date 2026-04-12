import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";
import { notifyWelcome, notifyAdminsNewCompany, notifyAdminsNewCandidate } from "@/lib/notifications";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {

    const body = await request.json();

    // Validate input
    const validationResult = registerSchema.safeParse(body);
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

    const { email, password, name, role } = validationResult.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "An account with this email already exists",
          code: "EMAIL_EXISTS",
        },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role,
        isOnboarded: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Send verification email
    try {
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

      const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/verify-email?token=${token}`;
      console.log(`Verification URL for ${email}: ${verifyUrl}`);
    } catch (verificationError) {
      console.error("Failed to create verification token:", verificationError);
    }

    // Send welcome notification (but not until email is verified - optional)
    try {
      await notifyWelcome(user.id, user.name || "there");
      
      // Notify admins about new registration
      if (role === "COMPANY") {
        await notifyAdminsNewCompany(user.name || "New Company", user.id);
      } else if (role === "CANDIDATE") {
        await notifyAdminsNewCandidate(user.name || "New Candidate", user.id);
      }
    } catch (notificationError) {
      // Log but don't fail registration
      console.error("Failed to send registration notifications:", notificationError);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully",
        data: user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An error occurred during registration",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/onboarding - Complete user onboarding
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        candidate: true,
        company: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (user.isOnboarded) {
      return NextResponse.json(
        { success: false, error: "User already onboarded", code: "ALREADY_ONBOARDED" },
        { status: 400 }
      );
    }

    // Check if profile exists based on role
    if (user.role === "CANDIDATE" && !user.candidate) {
      return NextResponse.json(
        { success: false, error: "Please complete your candidate profile first", code: "PROFILE_INCOMPLETE" },
        { status: 400 }
      );
    }

    if (user.role === "COMPANY" && !user.company) {
      return NextResponse.json(
        { success: false, error: "Please complete your company profile first", code: "PROFILE_INCOMPLETE" },
        { status: 400 }
      );
    }

    // Mark user as onboarded
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { isOnboarded: true },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isOnboarded: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Onboarding completed successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to complete onboarding", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

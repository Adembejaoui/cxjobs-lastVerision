import { NextRequest, NextResponse } from "next/server";
import { auth, unstable_update } from "@/lib/auth";
import  prisma  from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  getCandidateOnboardingErrors,
  type PersistedCandidateOnboardingState,
} from "@/lib/validations/profile";

// POST /api/onboarding - Complete user onboarding
export async function POST(_request: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = _request;
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
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isOnboarded: true,
        candidate: true,
        companies: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: "Account is disabled", code: "ACCOUNT_DISABLED" },
        { status: 403 }
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

    // For candidates the mere existence of the record is not enough: the same
    // completion requirements enforced by `POST /api/profile` are applied to the
    // persisted candidate, so this route cannot bypass them.
    if (user.role === "CANDIDATE") {
      const persistedCandidate = await prisma.candidate.findUnique({
        where: { userId: user.id },
        select: {
          firstName: true,
          lastName: true,
          phone: true,
          location: true,
          targetJobRole: true,
          gender: true,
          dateOfBirth: true,
          skills: { select: { name: true } },
          languages: { select: { name: true } },
          experiences: { select: { title: true, company: true } },
          education: { select: { school: true, degree: true } },
        },
      });

      const onboardingErrors = getCandidateOnboardingErrors(
        persistedCandidate as PersistedCandidateOnboardingState | null
      );

      if (Object.keys(onboardingErrors).length > 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              onboardingErrors[Object.keys(onboardingErrors)[0]] ??
              "Please complete your candidate profile first",
            code: "VALIDATION_ERROR",
            details: onboardingErrors,
          },
          { status: 400 }
        );
      }
    }

    if (user.role === "COMPANY" && !user.companies) {
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

    // Synchronize the updated isOnboarded value into the Auth.js JWT/session
    await unstable_update({
      user: {
        isOnboarded: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Onboarding completed successfully",
      data: updatedUser,
    });
  } catch (error) {
    logger.error("Onboarding error", { error });
    return NextResponse.json(
      { success: false, error: "Failed to complete onboarding", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

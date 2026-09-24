import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  isOnboarded: boolean;
}

export interface AuthOptions {
  requireActive?: boolean;
  requireOnboarded?: boolean;
}

export interface AuthResult {
  user: AuthenticatedUser;
}

export async function getAuthenticatedUser(options: AuthOptions = {}): Promise<AuthResult | NextResponse> {
  const { requireActive = false, requireOnboarded = false } = options;

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
    },
  });

  if (!user) {
    return NextResponse.json(
      { success: false, error: "User not found", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (requireActive && !user.isActive) {
    return NextResponse.json(
      { success: false, error: "Account is disabled", code: "ACCOUNT_DISABLED" },
      { status: 403 }
    );
  }

  if (requireOnboarded && !user.isOnboarded) {
    return NextResponse.json(
      { success: false, error: "Onboarding required", code: "ONBOARDING_REQUIRED" },
      { status: 403 }
    );
  }

  return { user };
}
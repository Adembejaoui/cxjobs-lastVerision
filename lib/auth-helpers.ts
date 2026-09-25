import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuthUserRecord } from "@/lib/auth-user-record";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
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

  // Shares the request-scoped lookup with the Auth.js jwt callback, so a single
  // render performs at most one read of the users table for this user.
  const user = await getAuthUserRecord(session.user.id);

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
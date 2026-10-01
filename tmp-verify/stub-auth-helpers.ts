import type { NextResponse } from "next/server";

/**
 * Test double for `getAuthenticatedUser`.
 *
 * The authenticated identity is read from a global so a single harness process
 * can drive several candidates through the real `POST /api/profile` handler
 * without an Auth.js session.
 */
export async function getAuthenticatedUser(): Promise<
  | {
      user: {
        id: string;
        email: string;
        name: string | null;
        image: string | null;
        role: string;
        isActive: boolean;
        isOnboarded: boolean;
      };
    }
  | NextResponse
> {
  const g = globalThis as unknown as { __TEST_USER_ID?: string };
  if (!g.__TEST_USER_ID) {
    throw new Error("__TEST_USER_ID not set");
  }
  return {
    user: {
      id: g.__TEST_USER_ID,
      email: "harness@example.test",
      name: "Harness",
      image: null,
      role: "CANDIDATE",
      isActive: true,
      isOnboarded: false,
    },
  };
}
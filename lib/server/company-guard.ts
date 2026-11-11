import { NextResponse } from "next/server";

/**
 * Uniform refusal for company-side write operations attempted by a suspended
 * (or deleted) company (F-04). Suspended accounts normally hold no session at
 * all (suspension bumps `sessionVersion`); this closes the window in which a
 * JWT is still accepted, e.g. while Redis is unavailable (≤ 15 minutes).
 */
export function companySuspendedResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: "This company account is suspended. Please contact support.",
      code: "COMPANY_SUSPENDED",
    },
    { status: 403 }
  );
}

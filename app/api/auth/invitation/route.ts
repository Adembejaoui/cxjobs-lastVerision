import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateInvitationToken } from "@/lib/server/invitation-validation";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";
import { logger } from "@/lib/logger";

/**
 * POST /api/auth/invitation — validate a company invitation token (H3).
 *
 * The token arrives ONLY in the JSON body (never the URL), so it is not
 * written to access logs. The invitation is NOT consumed here; consumption
 * stays atomic inside POST /api/auth/register. Only the fields the onboarding
 * page displays are returned. The token itself is never logged.
 */

// Tokens are 256-bit, so this bounds probing cost rather than guessing odds.
const VALIDATE_LIMIT = { windowMs: 60_000, max: 20 };

const bodySchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/),
});

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(request: NextRequest) {
  try {
    const rl = await checkRateLimitAsync(`invitation-validate:${getClientIp(request)}`, VALIDATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: { ...getRateLimitHeaders(rl), ...NO_STORE } }
      );
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "This invitation link is invalid.", code: "INVALID_TOKEN" },
        { status: 400, headers: NO_STORE }
      );
    }

    const result = await validateInvitationToken(parsed.data.token);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, code: result.code },
        { status: 400, headers: NO_STORE }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          companyName: result.data.companyName,
          managerName: result.data.managerName ?? null,
          managerEmail: result.data.managerEmail ?? null,
        },
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    logger.error("Invitation validation error", { error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json(
      { success: false, error: "Could not validate the invitation", code: "INTERNAL_ERROR" },
      { status: 500, headers: NO_STORE }
    );
  }
}

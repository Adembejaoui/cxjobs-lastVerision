import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { checkRateLimitsAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/utils";
import { runAfterResponse } from "@/lib/server/after-response";
import { issuePasswordReset } from "@/lib/server/account-emails";

const FORGOTPW_IP_LIMIT = { windowMs: 60_000, max: 3 };
// Per-address limit stops mail-bombing one victim from many IPs.
const FORGOTPW_EMAIL_LIMIT = { windowMs: 60 * 60_000, max: 5 };

// Identical body for every outcome so the response never reveals whether an
// account exists.
const GENERIC_RESPONSE = {
  success: true,
  message: "If an account with that email exists, we've sent a password reset link.",
} as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

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
    const emailKey = crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);

    const rl = await checkRateLimitsAsync([
      { key: `forgot-pw-ip:${getClientIp(request)}`, config: FORGOTPW_IP_LIMIT },
      { key: `forgot-pw-email:${emailKey}`, config: FORGOTPW_EMAIL_LIMIT },
    ]);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    // All account-dependent work (lookup, token issue, email send) runs after
    // the response is sent, so neither the body nor the timing reveals
    // whether the account exists or how the email provider behaved.
    runAfterResponse("password-reset-email", () => issuePasswordReset(email));

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    logger.error("Forgot password error", { error: error instanceof Error ? error.name : "unknown" });
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

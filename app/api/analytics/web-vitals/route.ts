import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";

// Public, unauthenticated telemetry (sent by components/web-vitals-reporter).
// Phase 4A: bounded per IP and strictly shaped, so it can no longer be used to
// write arbitrary attacker-chosen strings or volumes into the logs.
// Fail open: losing the limiter must not matter for a metrics beacon, and the
// payload is already bounded below.
const WEB_VITALS_LIMIT = { windowMs: 60_000, max: 60, failOpen: true };

const webVitalSchema = z
  .object({
    name: z.enum(["CLS", "FCP", "FID", "INP", "LCP", "TTFB"]),
    value: z.number().finite().min(0).max(1e7),
    rating: z.enum(["good", "needs-improvement", "poor"]).optional(),
    delta: z.number().finite().min(-1e7).max(1e7).optional(),
    id: z.string().max(100).regex(/^[\w.-]*$/).optional(),
    // A same-origin path as sent by window.location.pathname.
    page: z.string().max(512).regex(/^\/[^\s]*$/).optional(),
    timestamp: z.number().int().nonnegative().optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const rl = await checkRateLimitAsync(`web-vitals:${getClientIp(request)}`, WEB_VITALS_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }

    const parsed = webVitalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }

    const { name, value, rating, delta, id, page, timestamp } = parsed.data;
    logger.info("Web Vitals metric received", {
      metric: name,
      value,
      rating,
      delta,
      id,
      page,
      timestamp,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Web Vitals endpoint error", { error });
    return NextResponse.json(
      { success: false, error: "Failed to process metric" },
      { status: 500 }
    );
  }
}

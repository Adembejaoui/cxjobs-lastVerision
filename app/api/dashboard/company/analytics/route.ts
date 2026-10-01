import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCompanyAnalytics } from "@/lib/company-analytics";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { z } from "zod";

const querySchema = z.object({
  days: z.coerce.number().min(7).max(90).default(30),
  language: z.string().default("all"),
});

// GET /api/dashboard/company/analytics - Company analytics data
// The aggregation itself lives in @/lib/company-analytics so the dashboard page
// can call it directly instead of issuing an internal HTTP request to this route.
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (session.user.role !== "COMPANY") {
    return NextResponse.json(
      { success: false, error: "Access denied", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  // Rate limit: 30 requests per 60 seconds per authenticated COMPANY user
  const ANALYTICS_LIMIT = { windowMs: 60_000, max: 30 };
  const rl = await checkRateLimitAsync(
    `company-analytics:${session.user.id}`,
    ANALYTICS_LIMIT
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: {
          ...getRateLimitHeaders(rl),
          "Retry-After": String(
            Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))
          ),
        },
      }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    days: searchParams.get("days") ?? undefined,
    language: searchParams.get("language") ?? undefined,
  });
  const days = parsed.success ? parsed.data.days : 30;
  const language = parsed.success ? parsed.data.language : "all";
  const refresh = searchParams.get("refresh") === "true";

  const result = await getCompanyAnalytics({
    userId: session.user.id,
    days,
    language,
    refresh,
  });

  if (result.success) {
    return NextResponse.json({ success: true, data: result.data });
  }

  if (result.code === "PROFILE_NOT_FOUND") {
    return NextResponse.json(
      { success: false, error: "Company profile not found", code: "PROFILE_NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { success: false, error: "Failed to fetch analytics data", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}

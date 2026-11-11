import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { extractJobFromUrlText, isAIConfigured } from "@/lib/ai-service";
import { AIServiceError } from "@/lib/ai-errors";
import { fetchUrlText } from "@/lib/job-scraper";
import { scrapeJobUrlSchema, type ScrapeJobUrlInput } from "@/lib/validations/job";
import { checkRateLimitsAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/utils";
import { consumeAIQuota, aiQuotaExceededBody, aiQuotaHeaders, type AIQuotaTicket } from "@/lib/security/ai-quota";

// Platform ceiling; the route gives up at ROUTE_TIMEOUT_MS with a clean 504.
export const maxDuration = 60;

const SCRAPE_LIMIT = { windowMs: 60_000, max: 5 };
const SCRAPE_IP_LIMIT = { windowMs: 60_000, max: 10 };

// Hard timeout prevents this route from hanging forever if the target
// site is slow.  22 seconds leaves headroom before Vercel/edge timeout.
const ROUTE_TIMEOUT_MS = 22_000;

/**
 * POST /api/job-offers/scrape-from-url
 *
 * Body: { url: string, language?: "en" | "fr" }
 *
 * Flow:
 *   1. Auth guard  → COMPANY only
 *   2. Zod validate → validated URL
 *   3. fetchUrlText → HTML stripped to text, or null
 *   4. extractJobFromUrlText → OpenAI returns structured JSON
 *   5. Return parsed fields to client
 *
 * Everything runs server-side, so CORS is irrelevant.
 */
export async function POST(request: NextRequest) {
  // ─── 1. Enforce overall timeout (hard guard) ───
  const outer = new AbortController();
  const outerTimer = setTimeout(() => outer.abort(), ROUTE_TIMEOUT_MS);
  let quota: AIQuotaTicket | null = null;

  try {
    // ─── 2. Auth guard (company role required) ───
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    if (session.user.role !== "COMPANY") {
      return NextResponse.json(
        {
          success: false,
          error: "Only company accounts can scrape job offers",
          code: "FORBIDDEN",
        },
        { status: 403 }
      );
    }

    // ─── 3. Rate limiting (per account AND per IP, before any outbound work) ───
    const rl = await checkRateLimitsAsync([
      { key: `scrape-user:${session.user.id}`, config: SCRAPE_LIMIT },
      { key: `scrape-ip:${getClientIp(request)}`, config: SCRAPE_IP_LIMIT },
    ]);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    // ─── 3. Validate request body ───
    const rawBody = await request.json();
    const parseResult = scrapeJobUrlSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: parseResult.error.issues[0]?.message || "Invalid URL",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }
    const { url, language }: ScrapeJobUrlInput = parseResult.data;

    // ─── 4. AI availability guard ───
    if (!isAIConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: "AI service is not configured",
          code: "AI_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    // ─── 5. Fetch page text (server-side, no CORS) ───
    const pageText = await fetchUrlText(url, { signal: outer.signal });
    if (!pageText) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not fetch the page. The site may be blocking automated access. Try pasting the job description manually.",
          code: "FETCH_FAILED",
        },
        { status: 502 }
      );
    }

    // ─── 6. Daily per-user AI allowance (S7), only once there is work to do ───
    quota = await consumeAIQuota(session.user.id);
    if (!quota.result.allowed) {
      return NextResponse.json(aiQuotaExceededBody(), { status: 429, headers: aiQuotaHeaders(quota.result) });
    }

    // ─── 7. Let AI extract structured fields ───
    // The route deadline now also bounds the AI call (it previously applied
    // only to the page fetch).
    const extracted = await extractJobFromUrlText(
      { content: pageText, language: language ?? "en" },
      { signal: outer.signal }
    );

    return NextResponse.json({
      success: true,
      message: "Job data extracted successfully",
      data: extracted,
    });
  } catch (error) {
    // The user is not charged for a failed AI call.
    await quota?.refund();
    // Distinguish timeout errors from everything else
    if (
      (error as Error).name === "AbortError" ||
      (error instanceof AIServiceError && error.kind === "timeout")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Request timed out. The page may be too large or slow to load.",
          code: "TIMEOUT",
        },
        { status: 504 }
      );
    }

    logger.error("scrape-from-url unexpected error", { error });
    return NextResponse.json(
      { success: false, error: "Failed to scrape job offer", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  } finally {
    clearTimeout(outerTimer);
  }
}

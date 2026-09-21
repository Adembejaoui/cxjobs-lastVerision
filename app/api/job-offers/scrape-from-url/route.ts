import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { extractJobFromUrlText, isAIConfigured } from "@/lib/ai-service";
import { fetchUrlText } from "@/lib/job-scraper";
import { scrapeJobUrlSchema, type ScrapeJobUrlInput } from "@/lib/validations/job";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const SCRAPE_LIMIT = { windowMs: 60_000, max: 5 };

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

  try {
    // ─── 2. Rate limiting ───
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rl = await checkRateLimitAsync(`scrape:${ip}`, SCRAPE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    // ─── 3. Auth guard (company role required) ───
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
    const pageText = await fetchUrlText(url);
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

    // ─── 6. Let AI extract structured fields ───
    const extracted = await extractJobFromUrlText({
      content: pageText,
      language: language ?? "en",
    });

    return NextResponse.json({
      success: true,
      message: "Job data extracted successfully",
      data: extracted,
    });
  } catch (error) {
    // Distinguish timeout errors from everything else
    if ((error as Error).name === "AbortError") {
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

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateJobDescription, isAIConfigured } from "@/lib/ai-service";
import { AIServiceError } from "@/lib/ai-errors";
import { jobGenerationSchema } from "@/lib/validations/ai";
import { consumeAIQuota, aiQuotaExceededBody, aiQuotaHeaders, type AIQuotaTicket } from "@/lib/security/ai-quota";
import { AI_ROUTE_DEADLINE_MS } from "@/lib/ai-errors";

// Platform ceiling for this function; the route itself gives up at
// AI_ROUTE_DEADLINE_MS (< 30 s) and answers with a clean 504.
export const maxDuration = 60;
import { checkRateLimitsAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/utils";

const AI_GENERATE_LIMIT = { windowMs: 60_000, max: 5 };
const AI_GENERATE_IP_LIMIT = { windowMs: 60_000, max: 10 };



/**
 * POST /api/job-offers/generate-with-ai
 * Generate a job description using AI
 * 
 * Request body:
 * - title: string (required)
 * - company: string (optional)
 * - location: string (optional)
 * - contractType: ContractType (optional)
 * - workMode: WorkMode (optional)
 * - requirements: string[] (optional)
 * - benefits: string[] (optional)
 * - language: "en" | "fr" (optional, default: "en")
 */
export async function POST(request: NextRequest) {
  let quota: AIQuotaTicket | null = null;
  try {
    // Check if AI is configured
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

    // Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Only companies and admins can generate job descriptions
    if (session.user.role !== "COMPANY" && session.user.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          error: "Only companies can generate job descriptions",
          code: "FORBIDDEN",
        },
        { status: 403 }
      );
    }

    // Rate limiting (per account AND per IP) before any paid AI call.
    const rl = await checkRateLimitsAsync([
      { key: `ai-generate-user:${session.user.id}`, config: AI_GENERATE_LIMIT },
      { key: `ai-generate-ip:${getClientIp(request)}`, config: AI_GENERATE_IP_LIMIT },
    ]);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = jobGenerationSchema.safeParse(body);

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

    // Daily per-user AI allowance (S7), consumed only for valid requests.
    quota = await consumeAIQuota(session.user.id);
    if (!quota.result.allowed) {
      return NextResponse.json(aiQuotaExceededBody(), { status: 429, headers: aiQuotaHeaders(quota.result) });
    }

    // Generate job description
    // Bounded: the route deadline (and a client disconnect) cancels the AI
    // request and any retry, so a stalled provider cannot pin the function.
    const result = await generateJobDescription(
      {
        title: validationResult.data.title,
        company: validationResult.data.company,
        location: validationResult.data.location,
        contractType: validationResult.data.contractType ?? undefined,
        workMode: validationResult.data.workMode ?? undefined,
        requirements: validationResult.data.requirements,
        benefits: validationResult.data.benefits,
        language: validationResult.data.language,
      },
      { signal: AbortSignal.any([request.signal, AbortSignal.timeout(AI_ROUTE_DEADLINE_MS)]) }
    );

    return NextResponse.json({
      success: true,
      message: "Job description generated successfully",
      data: result,
    });
  } catch (error) {
    // The user is not charged for a failed AI call.
    await quota?.refund();
    logger.error("AI job generation error", {
      error: error instanceof Error ? error.name : "unknown",
      ...(error instanceof AIServiceError ? { kind: error.kind } : {}),
    });

    if (error instanceof AIServiceError && error.kind === "timeout") {
      return NextResponse.json(
        {
          success: false,
          error: "The AI service took too long to respond. Please try again.",
          code: "AI_TIMEOUT",
        },
        { status: 504 }
      );
    }

    if (error instanceof Error && error.message === "Failed to generate job description") {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to generate job description. Please try again.",
          code: "AI_GENERATION_FAILED",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: "An unexpected error occurred", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { parseCV, isValidPDF, getFileSizeMB } from "@/lib/cv-parser";
import { checkRateLimitsAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { checkCvFile } from "@/lib/security/file-type";
import { getClientIp } from "@/lib/utils";
import { consumeAIQuota, type AIQuotaTicket } from "@/lib/security/ai-quota";

// Platform ceiling; PDF extraction + AI are bounded to < 30 s inside parseCV.
export const maxDuration = 60;

const CV_PARSE_LIMIT = { windowMs: 60_000, max: 5 };
const CV_PARSE_IP_LIMIT = { windowMs: 60_000, max: 10 };

// Maximum file size: 5MB
const MAX_FILE_SIZE_MB = 5;

/**
 * POST /api/onboarding/cv-parse
 * Parse a CV file and extract structured information
 * 
 * Form data:
 * - cv: File (PDF, max 5MB)
 * - language: "en" | "fr" (optional, default: "en")
 * - useAI: boolean (optional, default: true if OPENAI_API_KEY is set)
 */
export async function POST(request: NextRequest) {
  try {

    // Authentication check
    const authResult = await getAuthenticatedUser({ requireActive: true });
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user: session } = authResult;

    // Only candidates can parse CVs
    if (session.role !== "CANDIDATE") {
      return NextResponse.json(
        {
          success: false,
          error: "Only candidates can parse CVs",
          code: "FORBIDDEN",
        },
        { status: 403 }
      );
    }

    // Per-account AND per-IP limits, enforced before the upload is parsed
    // and before any (paid) AI processing.
    const rl = await checkRateLimitsAsync([
      { key: `cv-parse-user:${session.id}`, config: CV_PARSE_LIMIT },
      { key: `cv-parse-ip:${getClientIp(request)}`, config: CV_PARSE_IP_LIMIT },
    ]);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    // Reject oversized bodies before buffering multipart data.
    const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_FILE_SIZE_MB * 1024 * 1024 + 64 * 1024) {
      return NextResponse.json(
        { success: false, error: `File size exceeds the maximum limit of ${MAX_FILE_SIZE_MB}MB.`, code: "FILE_TOO_LARGE" },
        { status: 413 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("cv") as File | null;
    const language: "en" | "fr" = formData.get("language") === "fr" ? "fr" : "en";
    const useAI = formData.get("useAI") !== "false"; // Default to true

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No CV file provided", code: "NO_FILE" },
        { status: 400 }
      );
    }

    // Size check BEFORE buffering the upload.
    if (file.size === 0 || file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: `File size must be between 1 byte and ${MAX_FILE_SIZE_MB}MB.`,
          code: "FILE_TOO_LARGE",
        },
        { status: 400 }
      );
    }

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileSizeMB = getFileSizeMB(buffer);

    // Content-based check: only a structurally plausible PDF reaches the
    // parser. The browser-declared type is not trusted.
    const check = checkCvFile(buffer, file.name, ["pdf"]);
    if (!check.ok || !isValidPDF(buffer)) {
      return NextResponse.json(
        {
          success: false,
          error: "Only PDF files are supported. Please upload a valid PDF document.",
          code: "INVALID_FORMAT",
        },
        { status: 400 }
      );
    }

    // Daily per-user AI allowance (S7). An exhausted allowance does not
    // block onboarding: the CV is still parsed, without AI.
    let quota: AIQuotaTicket | null = null;
    let aiQuotaExceeded = false;
    const wantsAI = useAI && !!process.env.OPENAI_API_KEY;
    if (wantsAI) {
      quota = await consumeAIQuota(session.id);
      if (!quota.result.allowed) {
        aiQuotaExceeded = true;
        quota = null;
      }
    }

    // Parse CV
    let aiSucceeded = false;
    let parsedCV;
    try {
      parsedCV = await parseCV(buffer, {
        useAI: wantsAI && !aiQuotaExceeded,
        language,
        onAIOutcome: (ok) => {
          aiSucceeded = ok;
        },
      });
    } finally {
      // The user is not charged when the AI step failed or never ran.
      if (quota && !aiSucceeded) await quota.refund();
    }


    return NextResponse.json({
      success: true,
      message: "CV parsed successfully",
      data: parsedCV,
      meta: {
        fileSizeMB: fileSizeMB.toFixed(2),
        usedAI: aiSucceeded,
        ...(aiQuotaExceeded ? { aiQuotaExceeded: true } : {}),
      },
    });
  } catch (error) {
    logger.error("CV parsing error", { error });

    if (error instanceof Error && error.message === "Failed to parse PDF file") {
      return NextResponse.json(
        { 
          success: false, 
          error: "Failed to parse CV. Please ensure the file is not corrupted or password-protected.",
          code: "PARSE_ERROR" 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to parse CV", 
        code: "INTERNAL_ERROR" 
      },
      { status: 500 }
    );
  }
}

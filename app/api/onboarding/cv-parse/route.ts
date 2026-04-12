import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseCV, isValidPDF, getFileSizeMB } from "@/lib/cv-parser";
import { rateLimitResponse, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";

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
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimitResult = rateLimitResponse(clientIp, RATE_LIMIT_PRESETS.API_WRITE);
    if (rateLimitResult) return rateLimitResult;

    // Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Only candidates can parse CVs
    if (session.user.role !== "CANDIDATE") {
      return NextResponse.json(
        {
          success: false,
          error: "Only candidates can parse CVs",
          code: "FORBIDDEN",
        },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("cv") as File | null;
    const language = (formData.get("language") as "en" | "fr") || "en";
    const useAI = formData.get("useAI") !== "false"; // Default to true

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No CV file provided", code: "NO_FILE" },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        {
          success: false,
          error: "Only PDF files are supported. Please upload your CV in PDF format.",
          code: "INVALID_FORMAT",
        },
        { status: 400 }
      );
    }

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate PDF
    if (!isValidPDF(buffer)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid PDF file. Please upload a valid PDF document.",
          code: "INVALID_PDF",
        },
        { status: 400 }
      );
    }

    // Check file size
    const fileSizeMB = getFileSizeMB(buffer);
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      return NextResponse.json(
        {
          success: false,
          error: `File size exceeds the maximum limit of ${MAX_FILE_SIZE_MB}MB. Your file is ${fileSizeMB.toFixed(2)}MB.`,
          code: "FILE_TOO_LARGE",
        },
        { status: 400 }
      );
    }

    // Parse CV
    const parsedCV = await parseCV(buffer, { useAI, language });
  

    return NextResponse.json({
      success: true,
      message: "CV parsed successfully",
      data: parsedCV,
      meta: {
        fileSizeMB: fileSizeMB.toFixed(2),
        usedAI: useAI && !!process.env.OPENAI_API_KEY,
      },
    });
  } catch (error) {
    console.error("CV parsing error:", error);

    // Return more detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    if (errorMessage === "Failed to parse PDF file") {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to parse PDF file. Please ensure the file is not corrupted or password-protected.",
          code: "PARSE_ERROR",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: `Failed to parse CV: ${errorMessage}`, 
        code: "INTERNAL_ERROR" 
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateJobDescription, isAIConfigured } from "@/lib/ai-service";
import { jobGenerationSchema } from "@/lib/validations/ai";



/**
 * POST /api/job-offers/generate-with-ai
 * Generate a job description using AI
 * 
 * Request body:
 * - title: string (required)
 * - company: string (optional)
 * - industry: string (optional)
 * - location: string (optional)
 * - contractType: ContractType (optional)
 * - workMode: WorkMode (optional)
 * - requirements: string[] (optional)
 * - benefits: string[] (optional)
 * - language: "en" | "fr" (optional, default: "en")
 */
export async function POST(request: NextRequest) {
  try {
    // Check if AI is configured
    if (!isAIConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: "AI service is not configured. Please set OPENAI_API_KEY environment variable.",
          code: "AI_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    // Rate limiting (stricter for AI endpoints)

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

    // Generate job description
    const result = await generateJobDescription({
      title: validationResult.data.title,
      company: validationResult.data.company,
      industry: validationResult.data.industry,
      location: validationResult.data.location,
      contractType: validationResult.data.contractType ?? undefined,
      workMode: validationResult.data.workMode ?? undefined,
      requirements: validationResult.data.requirements,
      benefits: validationResult.data.benefits,
      language: validationResult.data.language,
    });

    return NextResponse.json({
      success: true,
      message: "Job description generated successfully",
      data: result,
    });
  } catch (error) {
    console.error("AI job generation error:", error);
    
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

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createJobAlertSchema } from "@/lib/validations/job-alert";
import { parsePaginationParams } from "@/lib/utils";

/**
 * GET /api/job-alerts
 * List all job alerts for the current candidate
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    if (session.user.role !== "CANDIDATE") {
      return NextResponse.json(
        { success: false, error: "Only candidates can access job alerts", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Get candidate profile
    const candidate = await prisma.candidate.findUnique({
      where: { userId: session.user.id },
    });

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: "Candidate profile not found", code: "PROFILE_NOT_FOUND" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get("isActive");

    const { page, limit, skip } = parsePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    );

    const where = {
      candidateId: candidate.id,
      ...(isActive !== null && { isActive: isActive === "true" }),
    };

    const [alerts, total] = await Promise.all([
      prisma.jobAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.jobAlert.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: alerts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get job alerts error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch job alerts", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/job-alerts
 * Create a new job alert
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    if (session.user.role !== "CANDIDATE") {
      return NextResponse.json(
        { success: false, error: "Only candidates can create job alerts", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Get candidate profile
    const candidate = await prisma.candidate.findUnique({
      where: { userId: session.user.id },
    });

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: "Candidate profile not found", code: "PROFILE_NOT_FOUND" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validationResult = createJobAlertSchema.safeParse(body);

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

    // Check if user has reached max alerts limit (e.g., 10)
    const existingAlertsCount = await prisma.jobAlert.count({
      where: { candidateId: candidate.id },
    });

    if (existingAlertsCount >= 10) {
      return NextResponse.json(
        {
          success: false,
          error: "Maximum number of job alerts reached (10)",
          code: "LIMIT_REACHED",
        },
        { status: 400 }
      );
    }

    const alert = await prisma.jobAlert.create({
      data: {
        candidateId: candidate.id,
        keywords: validationResult.data.keywords,
        location: validationResult.data.location,
        jobType: validationResult.data.contractType ?? null,
        workMode: validationResult.data.workMode ? String(validationResult.data.workMode) : null,
        salaryMin: validationResult.data.salaryMin ?? null,
        frequency: validationResult.data.frequency ?? "DAILY",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Job alert created successfully",
      data: alert,
    }, { status: 201 });
  } catch (error) {
    console.error("Create job alert error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create job alert", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

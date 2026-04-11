import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateJobAlertSchema } from "@/lib/validations/job-alert";
import { isValidUuid } from "@/lib/utils";

/**
 * GET /api/job-alerts/[id]
 * Get a specific job alert
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid alert ID", code: "INVALID_ID" },
        { status: 400 }
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

    const alert = await prisma.jobAlert.findFirst({
      where: {
        id,
        candidateId: candidate.id,
      },
    });

    if (!alert) {
      return NextResponse.json(
        { success: false, error: "Job alert not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: alert,
    });
  } catch (error) {
    console.error("Get job alert error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch job alert", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/job-alerts/[id]
 * Update a job alert
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { success: false, error: "Only candidates can update job alerts", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid alert ID", code: "INVALID_ID" },
        { status: 400 }
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

    // Check ownership
    const existingAlert = await prisma.jobAlert.findFirst({
      where: { id, candidateId: candidate.id },
    });

    if (!existingAlert) {
      return NextResponse.json(
        { success: false, error: "Job alert not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validationResult = updateJobAlertSchema.safeParse(body);

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

    const alert = await prisma.jobAlert.update({
      where: { id },
      data: validationResult.data,
    });

    return NextResponse.json({
      success: true,
      message: "Job alert updated successfully",
      data: alert,
    });
  } catch (error) {
    console.error("Update job alert error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update job alert", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/job-alerts/[id]
 * Delete a job alert
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { success: false, error: "Only candidates can delete job alerts", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid alert ID", code: "INVALID_ID" },
        { status: 400 }
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

    // Check ownership and delete
    const result = await prisma.jobAlert.deleteMany({
      where: { id, candidateId: candidate.id },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, error: "Job alert not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Job alert deleted successfully",
    });
  } catch (error) {
    console.error("Delete job alert error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete job alert", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

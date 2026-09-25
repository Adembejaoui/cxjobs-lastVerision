import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import  prisma  from "@/lib/prisma";
import { updateApplicationSchema } from "@/lib/validations/job";
import { logger } from "@/lib/logger";
// GET /api/application/[id] - Get single application
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

    const { id } = await params;

    if (session.user.role === "CANDIDATE") {
      // Resolve candidate ID for ownership enforcement
      const candidate = await prisma.candidate.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!candidate) {
        return NextResponse.json(
          { success: false, error: "Candidate profile not found", code: "PROFILE_NOT_FOUND" },
          { status: 404 }
        );
      }

      // Enforce ownership at query level + narrow candidate relations.
      // Candidates viewing their own application do not need their full
      // skills, experiences, languages, or education.
      const application = await prisma.application.findFirst({
        where: {
          id,
          candidateId: candidate.id,
        },
        include: {
          candidate: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          jobOffer: {
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  logoUrl: true,
                  location: true,
                },
              },
            },
          },
        },
      });

      if (!application) {
        return NextResponse.json(
          { success: false, error: "Application not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: application,
      });
    }

    // COMPANY and other roles: use the original full query with all candidate relations
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        candidate: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
            skills: true,
            experiences: { orderBy: { startDate: "desc" } },
            languages: true,
            education: { orderBy: { startDate: "desc" } },
          },
        },
        jobOffer: {
          include: {
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                location: true,
              },
            },
          },
        },
      },
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check access rights for COMPANY role
    if (session.user.role === "COMPANY") {
      const company = await prisma.companies.findUnique({
        where: { userId: session.user.id },
      });

      if (!company || application.jobOffer?.companyId !== company.id) {
        return NextResponse.json(
          { success: false, error: "Access denied", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: application,
    });
  } catch (error) {
    logger.error("Failed to fetch application", { error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch application", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// PUT /api/application/[id] - Update application status (company only)
export async function PUT(
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

    if (session.user.role !== "COMPANY") {
      return NextResponse.json(
        { success: false, error: "Only companies can update application status", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const validationResult = updateApplicationSchema.safeParse(body);

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

    const { status, notes, isSaved } = validationResult.data;

    // Get application and verify ownership
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        jobOffer: {
          include: { company: true },
        },
      },
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Verify user owns the company
    const userCompany = await prisma.companies.findFirst({
      where: { userId: session.user.id, id: application.jobOffer.companyId },
    });

    if (!userCompany) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to update this application", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const updatedApplication = await prisma.application.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
        ...(isSaved !== undefined && { isSaved }),
      },
      include: {
        candidate: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        jobOffer: {
          select: {
            id: true,
            title: true,
            company: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
    return NextResponse.json({
      success: true,
      message: "Application updated successfully",
      data: updatedApplication,
    });
  } catch (error) {
    logger.error("Failed to update application", { error });
    return NextResponse.json(
      { success: false, error: "Failed to update application", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

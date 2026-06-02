import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import  prisma  from "@/lib/prisma";
import { createApplicationSchema } from "@/lib/validations/job";
import { parsePaginationParams } from "@/lib/utils";

// GET /api/application - List applications (role-filtered)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const jobId = searchParams.get("jobId");
    
    // Use safe pagination with enforced limits
    const { page, limit, skip } = parsePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    );

    if (session.user.role === "CANDIDATE") {
      // Get candidate's applications
      const candidate = await prisma.candidate.findUnique({
        where: { userId: session.user.id },
      });

      if (!candidate) {
        return NextResponse.json(
          { success: false, error: "Candidate profile not found", code: "PROFILE_NOT_FOUND" },
          { status: 404 }
        );
      }

      const where: Record<string, unknown> = { candidateId: candidate.id };
      if (status) {
        where.status = status;
      }
      if (jobId) {
        where.jobOfferId = jobId;
      }

      const [applications, total] = await Promise.all([
        prisma.application.findMany({
          where,
          include: {
            jobOffer: {
              include: {
                company: {
              select: {
                    id: true,
                    name: true,
                    slug: true,
                    logoUrl: true,
                  },
                },
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.application.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: applications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } else if (session.user.role === "COMPANY") {
      // Get company's job applications
      const company = await prisma.companies.findUnique({
        where: { userId: session.user.id },
      });

      if (!company) {
        return NextResponse.json(
          { success: false, error: "Company profile not found", code: "PROFILE_NOT_FOUND" },
          { status: 404 }
        );
      }

      const where: Record<string, unknown> = {
        jobOffer: { companyId: company.id },
      };
      if (status) {
        where.status = status;
      }
      if (jobId) {
        where.jobOfferId = jobId;
      }

      const [applications, total] = await Promise.all([
        prisma.application.findMany({
          where,
          include: {
            jobOffer: {
              select: {
                id: true,
                title: true,
                customLocation: true,
                contractType: true,
              },
            },
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
                skills: { take: 5 },
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.application.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: applications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid role", code: "INVALID_ROLE" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Get applications error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch applications", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/application - Submit application (candidate only)
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
        { success: false, error: "Only candidates can submit applications", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Get candidate profile
    const candidate = await prisma.candidate.findUnique({
      where: { userId: session.user.id },
    });

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: "Please complete your profile first", code: "PROFILE_NOT_FOUND" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validationResult = createApplicationSchema.safeParse(body);

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

    const { jobOfferId, coverLetter } = validationResult.data;

    // Check if job offer exists and is published
    const jobOffer = await prisma.jobOffer.findUnique({
      where: { id: jobOfferId },
    });

    if (!jobOffer || jobOffer.deletedAt || jobOffer.status !== "PUBLISHED") {
      return NextResponse.json(
        { success: false, error: "Job offer not found or no longer available", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check for duplicate application
    const existingApplication = await prisma.application.findUnique({
      where: {
        candidateId_jobOfferId: {
          candidateId: candidate.id,
          jobOfferId,
        },
      },
    });

    if (existingApplication) {
      return NextResponse.json(
        { success: false, error: "You have already applied to this job", code: "DUPLICATE_APPLICATION" },
        { status: 400 }
      );
    }

    const application = await prisma.application.create({
      data: {
        candidateId: candidate.id,
        jobOfferId,
        coverLetter: coverLetter || "",
        cvUrl: candidate.resumeUrl,
        status: "NOUVEAU",
      },
      include: {
        jobOffer: {
          select: {
            id: true,
            title: true,
            company: {
              select: {
                id: true,
                name: true,
                userId: true,
              },
            },
          },
        },
      },
    });

    // Send notification to company
    try {
     
    } catch (notificationError) {
      // Log but don't fail the request
      console.error("Failed to send notification:", notificationError);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Application submitted successfully",
        data: application,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create application error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit application", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

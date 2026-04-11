import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePaginationParams } from "@/lib/utils";

// GET /api/job-offers/[jobId]/applications - Get applications for a job (company owner only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { jobId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    
    // Use safe pagination with enforced limits
    const { page, limit, skip } = parsePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    );

    // Get job offer and verify ownership
    const jobOffer = await prisma.jobOffer.findUnique({
      where: { id: jobId },
      include: { company: true },
    });

    if (!jobOffer || jobOffer.deletedAt) {
      return NextResponse.json(
        { success: false, error: "Job offer not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Verify user owns the company
    const userCompany = await prisma.company.findFirst({
      where: { userId: session.user.id, id: jobOffer.companyId },
    });

    if (!userCompany) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to view these applications", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Build where clause
    const where: Record<string, unknown> = { jobOfferId: jobId };
    if (status) {
      where.status = status;
    }

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
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
              experiences: { orderBy: { startDate: "desc" }, take: 3 },
              languages: true,
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
  } catch (error) {
    console.error("Get applications error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch applications", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

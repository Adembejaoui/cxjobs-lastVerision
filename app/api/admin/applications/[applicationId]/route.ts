import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const jobId = searchParams.get("jobId");

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (jobId) {
      where.jobOfferId = jobId;
    }

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
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
            },
          },
          jobOffer: {
            select: {
              id: true,
              title: true,
              company: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.application.count({ where }),
    ]);

    const formattedApplications = applications.map((app) => ({
      id: app.id,
      coverLetter: app.coverLetter,
      cvUrl: app.cvUrl,
      status: app.status,
      notes: app.notes,
      isSaved: app.isSaved,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      candidate: {
        id: app.candidate.user.id,
        name: app.candidate.user.name,
        email: app.candidate.user.email,
        image: app.candidate.user.image,
      },
      job: {
        id: app.jobOffer.id,
        title: app.jobOffer.title,
        company: app.jobOffer.company,
      },
    }));

    return NextResponse.json({
      applications: formattedApplications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching applications:", error);
    return NextResponse.json(
      { error: "Failed to fetch applications" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { applicationId } = await params;
    const body = await request.json();
    const { status, notes } = body;

    const application = await prisma.application.update({
      where: { id: applicationId },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
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
          },
        },
      },
    });

    return NextResponse.json({
      id: application.id,
      status: application.status,
      notes: application.notes,
      candidate: {
        id: application.candidate.user.id,
        name: application.candidate.user.name,
        email: application.candidate.user.email,
      },
      job: {
        id: application.jobOffer.id,
        title: application.jobOffer.title,
      },
    });
  } catch (error) {
    console.error("Error updating application:", error);
    return NextResponse.json(
      { error: "Failed to update application" },
      { status: 500 }
    );
  }
}
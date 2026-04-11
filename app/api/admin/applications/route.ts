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
    const companyId = searchParams.get("companyId");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (jobId) {
      where.jobOfferId = jobId;
    }

    if (companyId) {
      where.jobOffer = {
        companyId,
      };
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
              slug: true,
              company: {
                select: {
                  id: true,
                  name: true,
                  logoUrl: true,
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
      candidate: {
        id: app.candidate.user.id,
        name: app.candidate.user.name,
        email: app.candidate.user.email,
        image: app.candidate.user.image,
      },
      job: {
        id: app.jobOffer.id,
        title: app.jobOffer.title,
        slug: app.jobOffer.slug,
        company: {
          id: app.jobOffer.company.id,
          name: app.jobOffer.company.name,
          logoUrl: app.jobOffer.company.logoUrl,
        },
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
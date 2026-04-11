import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/dashboard/candidate - Candidate dashboard data
export async function GET() {
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
        { success: false, error: "Access denied", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Get candidate profile
    const candidate = await prisma.candidate.findUnique({
      where: { userId: session.user.id },
      include: {
        skills: true,
        _count: {
          select: { applications: true },
        },
      },
    });

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: "Profile not found", code: "PROFILE_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Get application statistics
    const applicationStats = await prisma.application.groupBy({
      by: ["status"],
      where: { candidateId: candidate.id },
      _count: true,
    });

    // Get recent applications
    const recentApplications = await prisma.application.findMany({
      where: { candidateId: candidate.id },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        jobOffer: {
          select: {
            id: true,
            title: true,
            customLocation: true,
            contractType: true,
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
    });

    // Get recommended jobs based on skills
    const skillNames = candidate.skills.map((s) => s.name.toLowerCase());

    const recommendedJobs = await prisma.jobOffer.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        ...(skillNames.length > 0 && {
          OR: skillNames.map((skill) => ({
            description: { contains: skill, mode: "insensitive" as const },
          })),
        }),
      },
      take: 6,
      orderBy: { createdAt: "desc" },
        include: {
        company: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            location: true,
          },
        },
        _count: {
          select: { applications: true },
        },
      },
    });

    // Get job market trends (jobs posted in last 30 days by contract type)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const jobTrends = await prisma.jobOffer.groupBy({
      by: ["contractType"],
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: true,
    });

    // Format response
    const statsMap = {
      NOUVEAU: 0,
      EN_COURS_EXAMEN: 0,
      ENTRETIEN: 0,
      EMBAUCHES: 0,
      REFUSE: 0,
    };

    applicationStats.forEach((stat) => {
      statsMap[stat.status] = stat._count;
    });

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          id: candidate.id,
          headline: candidate.headline,
          location: candidate.location,
          avatarUrl: candidate.avatarUrl,
          skillsCount: candidate.skills.length,
        },
        stats: {
          totalApplications: candidate._count.applications,
          byStatus: statsMap,
        },
        recentApplications,
        recommendedJobs,
        jobTrends,
      },
    });
  } catch (error) {
    console.error("Get candidate dashboard error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch dashboard data", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

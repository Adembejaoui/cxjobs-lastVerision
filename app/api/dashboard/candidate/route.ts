import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import  prisma  from "@/lib/prisma";
import { logger } from "@/lib/logger";

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

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [candidate, jobTrends] = await Promise.all([
      prisma.candidate.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          headline: true,
          location: true,
          avatarUrl: true,
          skills: { select: { name: true }, take: 3 },
        },
      }),
      prisma.jobOffer.groupBy({
        by: ["contractType"],
        where: {
          status: "PUBLISHED",
          deletedAt: null,
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: true,
      }),
    ]);

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: "Profile not found", code: "PROFILE_NOT_FOUND" },
        { status: 404 }
      );
    }

    const skillNames = candidate.skills.map((s: { name: string }) => s.name.toLowerCase());
    const topSkills = skillNames.slice(0, 3);

    const [applicationStats, recentApplications, recommendedJobs] = await Promise.all([
      prisma.application.groupBy({
        by: ["status"],
        where: { candidateId: candidate.id },
        _count: true,
      }),
      prisma.application.findMany({
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
              employmentType: true,
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
      prisma.jobOffer.findMany({
        where: {
          status: "PUBLISHED",
          deletedAt: null,
          ...(topSkills.length > 0 && {
            OR: topSkills.map((skill: string) => ({
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
      }),
    ]);

    const statsMap = {
      NOUVEAU: 0,
      EN_COURS_EXAMEN: 0,
      ENTRETIEN: 0,
      EMBAUCHES: 0,
      REFUSE: 0,
    };

    let totalApplications = 0;
    applicationStats.forEach((stat: { status: string; _count: number }) => {
      statsMap[stat.status as keyof typeof statsMap] = stat._count;
      totalApplications += stat._count;
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
          totalApplications,
          byStatus: statsMap,
        },
        recentApplications,
        recommendedJobs,
        jobTrends,
      },
    });
  } catch (error) {
    logger.error("Get candidate dashboard error", { error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch dashboard data", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

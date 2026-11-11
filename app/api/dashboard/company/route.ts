import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isValidUuid } from "@/lib/utils";
import { getCachedDashboardStats, setCachedDashboardStats } from "@/lib/local-cache";
import { logger } from "@/lib/logger";

const COMPANY_STATS_KEY = (userId: string) => `dashboard:company:${userId}`;
const CACHE_TTL = 60;

// GET /api/dashboard/company - Company dashboard data
export async function GET() {
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
        { success: false, error: "Access denied", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const cacheKey = COMPANY_STATS_KEY(session.user.id);
    const cached = await getCachedDashboardStats(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, data: JSON.parse(cached) });
    }

    const company = await prisma.companies.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        coverImageUrl: true,
        website: true,
        linkedinUrl: true,
        companySize: true,
        location: true,
        foundedYear: true,
        benefits: {
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
            category: true,
            scope: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        culture: true,
        _count: {
          select: { jobs: true },
        },
      },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company profile not found", code: "PROFILE_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (!isValidUuid(company.id)) {
      return NextResponse.json(
        { success: false, error: "Invalid company data", code: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }

    // Seven-day window for applications-per-day chart.
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // All five queries depend only on company.id (already resolved above), so
    // they are safe to run concurrently rather than sequentially. With a pool
    // max of 5 this keeps the connection pipeline saturated without over-subscribing.
    const [
      jobStats,
      applicationStats,
      recentApplications,
      activeJobs,
      applicationsPerDay,
    ] = await Promise.all([
      prisma.jobOffer.groupBy({
        by: ["status"],
        where: {
          companyId: company.id,
          deletedAt: null,
        },
        _count: true,
      }),
      prisma.application.groupBy({
        by: ["status"],
        where: {
          jobOffer: { companyId: company.id },
        },
        _count: true,
      }),
      prisma.application.findMany({
        where: {
          jobOffer: { companyId: company.id },
        },
        take: 10,
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
              customLocation: true,
            },
          },
        },
      }),
      prisma.jobOffer.findMany({
        where: {
          companyId: company.id,
          status: "PUBLISHED",
          deletedAt: null,
        },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { applications: true },
          },
        },
      }),
      prisma.$queryRaw<
        Array<{ date: Date; count: number }>
      >`
        SELECT DATE(a."createdAt") as date, COUNT(*) as count
        FROM applications a
        JOIN job_offers j ON a."jobOfferId" = j.id
        WHERE j."companyId" = ${company.id}
          AND a."createdAt" >= ${sevenDaysAgo}
        GROUP BY DATE(a."createdAt")
        ORDER BY date DESC
      `,
    ]);

    // Total applications derived from grouped status counts (same where clause)
    const totalApplications = applicationStats.reduce((sum, stat) => sum + stat._count, 0);

    // Format response
    const jobStatsMap: Record<string, number> = {
      DRAFT: 0,
      PUBLISHED: 0,
      ARCHIVED: 0,
      CLOSED: 0,
      EXPIRED: 0,
    };

    jobStats.forEach((stat: { status: string; _count: number }) => {
      jobStatsMap[stat.status as keyof typeof jobStatsMap] = stat._count;
    });

    const applicationStatsMap: Record<string, number> = {
      NOUVEAU: 0,
      EN_COURS_EXAMEN: 0,
      ENTRETIEN: 0,
      EMBAUCHES: 0,
      REFUSE: 0,
    };

    applicationStats.forEach((stat: { status: string; _count: number }) => {
      applicationStatsMap[stat.status as keyof typeof applicationStatsMap] = stat._count;
    });

    const responseData = {
        company: {
          id: company.id,
          name: company.name,
          slug: company.slug,
          description: company.description,
          logoUrl: company.logoUrl,
          coverImage: company.coverImageUrl,
          website: company.website,
          linkedin: company.linkedinUrl,
          companySize: company.companySize,
          location: company.location,
          foundedYear: company.foundedYear,
          benefits: company.benefits,
          culture: company.culture,
        },
        stats: {
          totalJobs: company._count.jobs,
          jobsByStatus: jobStatsMap,
          totalApplications,
          applicationsByStatus: applicationStatsMap,
        },
        recentApplications,
        activeJobs,
        applicationsPerDay: applicationsPerDay.map((item: { date: Date; count: number }) => ({
          date: item.date,
          count: item.count,
        })),
      };

    await setCachedDashboardStats(cacheKey, JSON.stringify(responseData), CACHE_TTL);

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    logger.error("Get company dashboard error", { error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch dashboard data", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// PUT was removed (launch plan F3/A6, audit F-19): it was an unused second
// write path that replaced every company benefit (cascading to job links).
// Company profiles are edited only through POST /api/profile. Next.js answers
// 405 Method Not Allowed for PUT requests.

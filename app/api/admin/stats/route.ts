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
    const period = searchParams.get("period") || "30d";

    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    const [
      totalUsers,
      totalCompanies,
      totalJobs,
      totalApplications,
      recentUsers,
      recentJobs,
      recentApplications,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.jobOffer.count({ where: { status: "PUBLISHED" } }),
      prisma.application.count(),
      prisma.user.count({
        where: { createdAt: { gte: startDate } },
      }),
      prisma.jobOffer.count({
        where: { createdAt: { gte: startDate }, status: "PUBLISHED" },
      }),
      prisma.application.count({
        where: { createdAt: { gte: startDate } },
      }),
    ]);

    const applicationsByStatus = await prisma.application.groupBy({
      by: ["status"],
      _count: true,
    });

    const jobsByCompany = await prisma.company.findMany({
      take: 10,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        count: true,
      },
    });

    return NextResponse.json({
      overview: {
        totalUsers,
        totalCompanies,
        totalJobs,
        totalApplications,
      },
      period,
      recentActivity: {
        newUsers: recentUsers,
        newJobs: recentJobs,
        newApplications: recentApplications,
      },
      applicationsByStatus: applicationsByStatus.map((item) => ({
        status: item.status,
        count: item._count,
      })),
      topCompanies: jobsByCompany.map((company) => ({
        id: company.id,
        name: company.name,
        jobCount: company.count?.jobs || 0,
      })),
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
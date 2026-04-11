import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/stats - Platform-wide statistics (admin only)
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Get counts
    const [
      totalUsers,
      totalCandidates,
      totalCompanies,
      totalJobOffers,
      totalApplications,
      publishedJobs,
      draftJobs,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.candidate.count(),
      prisma.company.count({ where: { deletedAt: null } }),
      prisma.jobOffer.count({ where: { deletedAt: null } }),
      prisma.application.count(),
      prisma.jobOffer.count({ where: { status: "PUBLISHED", deletedAt: null } }),
      prisma.jobOffer.count({ where: { status: "DRAFT", deletedAt: null } }),
    ]);

    // Get users by role
    const usersByRole = await prisma.user.groupBy({
      by: ["role"],
      _count: true,
    });

    // Get applications by status
    const applicationsByStatus = await prisma.application.groupBy({
      by: ["status"],
      _count: true,
    });

    // Get jobs by contract type
    const jobsByContractType = await prisma.jobOffer.groupBy({
      by: ["contractType"],
      _count: true,
    });

    // Get new users in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newUsersLast30Days = await prisma.user.count({
      where: {
        deletedAt: null,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const newJobsLast30Days = await prisma.jobOffer.count({
      where: {
        deletedAt: null,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const newApplicationsLast30Days = await prisma.application.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // Format response
    const roleMap: Record<string, number> = { CANDIDATE: 0, COMPANY: 0, ADMIN: 0 };
    usersByRole.forEach((item) => {
      roleMap[item.role] = item._count;
    });

    const statusMap: Record<string, number> = {
      NOUVEAU: 0,
      EN_COURS_EXAMEN: 0,
      ENTRETIEN: 0,
      EMBAUCHES: 0,
      REFUSE: 0,
    };
    applicationsByStatus.forEach((item) => {
      statusMap[item.status] = item._count;
    });

    const contractMap: Record<string, number> = {
      CDI: 0,
      CDD: 0,
      FREELANCE: 0,
      INTERNSHIP: 0,
      PART_TIME: 0,
    };
    jobsByContractType.forEach((item) => {
      contractMap[item.contractType] = item._count;
    });

    return NextResponse.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          candidates: totalCandidates,
          companies: totalCompanies,
          byRole: roleMap,
          newLast30Days: newUsersLast30Days,
        },
        jobs: {
          total: totalJobOffers,
          published: publishedJobs,
          draft: draftJobs,
          byContractType: contractMap,
          newLast30Days: newJobsLast30Days,
        },
        applications: {
          total: totalApplications,
          byStatus: statusMap,
          newLast30Days: newApplicationsLast30Days,
        },
      },
    });
  } catch (error) {
    console.error("Get stats error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch statistics", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

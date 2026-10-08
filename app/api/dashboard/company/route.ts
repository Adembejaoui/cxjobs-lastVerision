import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isValidUuid } from "@/lib/utils";
import { z } from "zod";
import { getCachedDashboardStats, setCachedDashboardStats, invalidateCache } from "@/lib/local-cache";
import { logger } from "@/lib/logger";
import { benefitCategorySchema, benefitScopeSchema } from "@/lib/validations/profile";

const COMPANY_STATS_KEY = (userId: string) => `dashboard:company:${userId}`;
const CACHE_TTL = 60;

// Validation schema for company profile update
const updateCompanySchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  companySize: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  website: z.string().url().optional().or(z.literal("")).nullable(),
  linkedinUrl: z.string().optional().nullable(),
  foundedYear: z.number().min(1800).max(new Date().getFullYear()).optional().nullable(),
  benefits: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    icon: z.string().optional(),
    category: benefitCategorySchema.optional().default("OTHER"),
    scope: benefitScopeSchema.optional().default("ADDITIONAL"),
  })).optional().nullable(),
  culture: z.array(z.object({
    title: z.string(),
    description: z.string()
  })).optional().nullable(),
  logoUrl: z.string().url().optional().or(z.literal("")).nullable(),
  coverImageUrl: z.string().url().optional().or(z.literal("")).nullable(),
});

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

// PUT /api/dashboard/company - Update company profile
// Only the company that owns the profile can update it
export async function PUT(request: NextRequest) {
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

    // Get company profile
    const company = await prisma.companies.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company profile not found", code: "PROFILE_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = updateCompanySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Validation failed", 
          code: "VALIDATION_ERROR",
          details: validationResult.error.issues 
        },
        { status: 400 }
      );
    }

    const { 
      name, 
      description, 
      companySize, 
      location, 
      website, 
      linkedinUrl, 
      foundedYear,
      benefits,
      culture,
      logoUrl,
      coverImageUrl
    } = validationResult.data;

    // Build update data - only include fields that are defined
    const updateData: Record<string, unknown> = {}

    if (name) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (companySize) updateData.companySize = companySize
    if (location !== undefined) updateData.location = location
    if (website !== undefined) updateData.website = website || null
    if (linkedinUrl !== undefined) updateData.linkedinUrl = linkedinUrl
    if (foundedYear !== undefined) updateData.foundedYear = foundedYear
    if (culture !== undefined) updateData.culture = JSON.stringify(culture)
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl || null
    if (coverImageUrl !== undefined) updateData.coverImageUrl = coverImageUrl || null

    // Update company profile and benefits in a transaction
    const updatedCompany = await prisma.$transaction(async (tx) => {
      const updated = await tx.companies.update({
        where: { id: company.id },
        data: updateData,
      });

      // Manage benefits relationally — replace all existing benefits
      if (benefits !== undefined) {
        await tx.companyBenefit.deleteMany({
          where: { companyId: company.id },
        });

        if (benefits && benefits.length > 0) {
          await tx.companyBenefit.createMany({
            data: benefits.map((b: { name: string; description?: string; icon?: string; category?: string; scope?: string }) => ({
              companyId: company.id,
              name: b.name,
              description: b.description || null,
              icon: b.icon || null,
              category: (b.category as "HEALTH" | "FINANCIAL" | "WORK_ENVIRONMENT" | "CAREER_GROWTH" | "WORK_LIFE_BALANCE" | "OTHER") || "OTHER",
              scope: (b.scope as "CORE" | "ADDITIONAL") || "ADDITIONAL",
            })),
          });
        }
      }

      return updated;
    });

    await invalidateCache(COMPANY_STATS_KEY(session.user.id));

    return NextResponse.json({
      success: true,
      data: updatedCompany,
    });
  } catch (error) {
    logger.error("Update company profile error", { error });
    return NextResponse.json(
      { success: false, error: "Failed to update profile", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

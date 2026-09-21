import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { getCachedDashboardStats, setCachedDashboardStats } from "@/lib/local-cache";
import { CompanyAnalyticsData, CompanyAnalyticsAge } from "@/types/company-analytics";
import { pct, buildJobWhere, buildAppWhere } from "@/lib/analytics-utils";

const CACHE_KEY = (companyId: string, days: number, language: string) =>
  `dashboard:company:analytics:${companyId}:${days}:${language}`;
const CACHE_TTL = 60;

const querySchema = z.object({
  days: z.coerce.number().min(7).max(90).default(30),
  language: z.string().default("all"),
});

async function getCandidatesWithGenderData(
  companyId: string,
  language: string | "all",
  fromDate: Date
): Promise<{ total: number; female: number; male: number }> {
  const sql = language !== "all"
    ? `
      WITH applicants AS (
        SELECT DISTINCT a."candidateId" AS "candidateId"
        FROM applications a
        JOIN job_offers j ON a."jobOfferId" = j.id
        WHERE j."companyId" = $1
          AND j."deletedAt" IS NULL
          AND a."createdAt" >= $2
          AND a."candidateId" IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM job_languages jl
            WHERE jl."jobOfferId" = j.id
              AND jl.language = $3
              AND jl.level = 'REQUIRED'
          )
      )
      SELECT
        COUNT(*) AS "total",
        COUNT(CASE WHEN c."gender" = 'female' THEN 1 END) AS "female",
        COUNT(CASE WHEN c."gender" = 'male' THEN 1 END) AS "male"
      FROM applicants ap
      JOIN candidates c ON c.id = ap."candidateId"
      WHERE c."gender" IS NOT NULL
    `
    : `
      WITH applicants AS (
        SELECT DISTINCT a."candidateId" AS "candidateId"
        FROM applications a
        JOIN job_offers j ON a."jobOfferId" = j.id
        WHERE j."companyId" = $1
          AND j."deletedAt" IS NULL
          AND a."createdAt" >= $2
          AND a."candidateId" IS NOT NULL
      )
      SELECT
        COUNT(*) AS "total",
        COUNT(CASE WHEN c."gender" = 'female' THEN 1 END) AS "female",
        COUNT(CASE WHEN c."gender" = 'male' THEN 1 END) AS "male"
      FROM applicants ap
      JOIN candidates c ON c.id = ap."candidateId"
      WHERE c."gender" IS NOT NULL
    `;

  const params = language !== "all" ? [companyId, fromDate, language] : [companyId, fromDate];
  const rows = await prisma.$queryRawUnsafe<Array<{ total: number; female: number; male: number }>>(sql, ...params);
  const row = rows[0] ?? { total: 0, female: 0, male: 0 };
  return {
    total: Number(row.total ?? 0),
    female: Number(row.female ?? 0),
    male: Number(row.male ?? 0),
  };
}

async function getCandidatesAgeGroups(
  companyId: string,
  language: string | "all",
  fromDate: Date
): Promise<CompanyAnalyticsAge> {
  const sql = language !== "all"
    ? `
      WITH applicants AS (
        SELECT DISTINCT a."candidateId" AS "candidateId"
        FROM applications a
        JOIN job_offers j ON a."jobOfferId" = j.id
        WHERE j."companyId" = $1
          AND j."deletedAt" IS NULL
          AND a."createdAt" >= $2
          AND a."candidateId" IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM job_languages jl
            WHERE jl."jobOfferId" = j.id
              AND jl.language = $3
              AND jl.level = 'REQUIRED'
          )
      )
      SELECT
        SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) BETWEEN 18 AND 24 THEN 1 ELSE 0 END) AS "age_18_24",
        SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) BETWEEN 25 AND 34 THEN 1 ELSE 0 END) AS "age_25_34",
        SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) BETWEEN 35 AND 44 THEN 1 ELSE 0 END) AS "age_35_44",
        SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) BETWEEN 45 AND 55 THEN 1 ELSE 0 END) AS "age_45_55",
        SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) > 55 THEN 1 ELSE 0 END) AS "age_55_plus"
      FROM applicants ap
      JOIN candidates c ON c.id = ap."candidateId"
      WHERE c."dateOfBirth" IS NOT NULL
    `
    : `
      WITH applicants AS (
        SELECT DISTINCT a."candidateId" AS "candidateId"
        FROM applications a
        JOIN job_offers j ON a."jobOfferId" = j.id
        WHERE j."companyId" = $1
          AND j."deletedAt" IS NULL
          AND a."createdAt" >= $2
          AND a."candidateId" IS NOT NULL
      )
      SELECT
        SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) BETWEEN 18 AND 24 THEN 1 ELSE 0 END) AS "age_18_24",
        SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) BETWEEN 25 AND 34 THEN 1 ELSE 0 END) AS "age_25_34",
        SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) BETWEEN 35 AND 44 THEN 1 ELSE 0 END) AS "age_35_44",
        SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) BETWEEN 45 AND 55 THEN 1 ELSE 0 END) AS "age_45_55",
        SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) > 55 THEN 1 ELSE 0 END) AS "age_55_plus"
      FROM applicants ap
      JOIN candidates c ON c.id = ap."candidateId"
      WHERE c."dateOfBirth" IS NOT NULL
    `;

  const params = language !== "all" ? [companyId, fromDate, language] : [companyId, fromDate];
  const rows = await prisma.$queryRawUnsafe<Array<{
      age_18_24: number;
      age_25_34: number;
      age_35_44: number;
      age_45_55: number;
      age_55_plus: number;
    }>>(sql, ...params);
  const row = rows[0] ?? { age_18_24: 0, age_25_34: 0, age_35_44: 0, age_45_55: 0, age_55_plus: 0 };
  return {
    "18-24": Number(row.age_18_24 ?? 0),
    "25-34": Number(row.age_25_34 ?? 0),
    "35-44": Number(row.age_35_44 ?? 0),
    "45-55": Number(row.age_45_55 ?? 0),
    "55+": Number(row.age_55_plus ?? 0),
  };
}

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const parsed = querySchema.safeParse({
      days: searchParams.get("days") ?? undefined,
      language: searchParams.get("language") ?? undefined,
    });
    const days = parsed.success ? parsed.data.days : 30;
    const language = parsed.success ? parsed.data.language : "all";
    const refresh = searchParams.get("refresh") === "true";

    const company = await prisma.companies.findUnique({
      where: { userId: session.user.id },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company profile not found", code: "PROFILE_NOT_FOUND" },
        { status: 404 }
      );
    }

    const cacheKey = CACHE_KEY(company.id, days, language);
    if (!refresh) {
      const cached = await getCachedDashboardStats(cacheKey);
      if (cached) {
        try {
          const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
          return NextResponse.json({ success: true, data: parsed });
        } catch {
          // Cache corrupted, proceed
        }
      }
    }

    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - days);

    // ─── Main KPIs ────────────────────────────────────────────────
    const [totalJobListings, activeJobListings, receivedApplications, jobViewsAggregate] = await Promise.all([
      prisma.jobOffer.count({
        where: buildJobWhere(company.id, language, fromDate, { includeTimeWindow: true }),
      }),
      prisma.jobOffer.count({
        where: {
          ...buildJobWhere(company.id, language, fromDate, { includeTimeWindow: true }),
          status: "PUBLISHED",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      prisma.application.count({
        where: buildAppWhere(company.id, language, fromDate),
      }),
      prisma.jobOffer.aggregate({
        where: buildJobWhere(company.id, language, fromDate, { includeTimeWindow: false }),
        _sum: { views: true },
      }),
    ]);

    const totalViews = Number(jobViewsAggregate._sum.views ?? 0);

    // ─── Gender ────────────────────────────────────────────────────
    const genderData = await getCandidatesWithGenderData(company.id, language, fromDate);

    // ─── Age ───────────────────────────────────────────────────────
    const ageData = await getCandidatesAgeGroups(company.id, language, fromDate);

    // ─── Job Performance ────────────────────────────────────────────
    const jobPerformance = await prisma.jobOffer.findMany({
      where: {
        ...buildJobWhere(company.id, language, fromDate, { includeTimeWindow: true }),
        status: "PUBLISHED",
      },
      select: {
        id: true,
        title: true,
        status: true,
        customLocation: true,
        views: true,
        languages: {
          where: { level: "REQUIRED" },
          select: { language: true },
        },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Sort by applications count descending (Prisma doesn't support _count in orderBy)
    jobPerformance.sort(
      (a, b) => (b._count.applications ?? 0) - (a._count.applications ?? 0),
    );

    const jobPerformanceTop5 = jobPerformance.slice(0, 5);

    const jobPerformanceFormatted = jobPerformanceTop5.map((job) => ({
      id: job.id,
      title: job.title,
      primaryLanguage: job.languages[0]?.language ?? "N/A",
      location: job.customLocation ?? "",
      views: job.views ?? 0,
      applications: job._count.applications,
      conversionRate: job.views > 0 ? Number(((job._count.applications / job.views) * 100).toFixed(1)) : 0,
      status: job.status,
    }));

    // ─── Available languages ────────────────────────────────────────
    const availableLanguages = await prisma.jobOffer.findMany({
      where: {
        companyId: company.id,
        deletedAt: null,
      },
      select: {
        languages: {
          where: { level: "REQUIRED" },
          select: { language: true },
        },
      },
    });

    const languageSet = new Set<string>();
    for (const job of availableLanguages) {
      for (const jl of job.languages) {
        languageSet.add(jl.language);
      }
    }

    const data: CompanyAnalyticsData = {
      period: {
        days,
        from: fromDate.toISOString(),
        to: now.toISOString(),
        language: language === "all" ? null : language,
      },
      mainKpis: {
        totalViews,
        totalJobListings,
        activeJobListings,
        receivedApplications,
      },
      gender: {
        totalAnalyzed: genderData.total,
        female: {
          count: genderData.female,
          percentage: pct(genderData.female, genderData.total),
        },
        male: {
          count: genderData.male,
          percentage: pct(genderData.male, genderData.total),
        },
      },
      age: ageData,
      jobPerformance: jobPerformanceFormatted,
      filters: {
        availableLanguages: Array.from(languageSet).sort(),
      },
    };

    await setCachedDashboardStats(cacheKey, JSON.stringify(data), CACHE_TTL);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const errorInfo = error instanceof Error
      ? { message: error.message, name: error.name, stack: error.stack }
      : { error: String(error) };
    logger.error("Get company analytics error", { error: errorInfo });
    return NextResponse.json(
      { success: false, error: "Failed to fetch analytics data", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

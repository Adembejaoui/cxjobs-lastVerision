import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  getCachedDashboardStats,
  setCachedDashboardStats,
  getCompanyAnalyticsVersion,
} from "@/lib/local-cache";
import { CompanyAnalyticsData } from "@/types/company-analytics";
import { pct } from "@/lib/analytics-utils";
import {
  getCompanyKPIs,
  getGenderData,
  getAgeData,
  getDashboardJobPerformance,
  getAvailableLanguages,
} from "@/lib/analytics-queries";

const CACHE_KEY = (companyId: string, version: number, days: number, language: string) =>
  `dashboard:company:analytics:${companyId}:${version}:${days}:${language}`;
const CACHE_TTL = 300;

export interface CompanyAnalyticsQuery {
  userId: string;
  days: number;
  language: string;
  refresh: boolean;
}

export type CompanyAnalyticsOutcome =
  | { success: true; data: CompanyAnalyticsData }
  | { success: false; code: "PROFILE_NOT_FOUND" | "QUERY_FAILED"; error: string };

/**
 * Company analytics aggregation shared by the Server Component and the Route
 * Handler. The caller is responsible for authentication and the COMPANY role
 * check; this function only resolves the company that owns `userId` and runs the
 * read queries.
 */
export async function getCompanyAnalytics({
  userId,
  days,
  language,
  refresh,
}: CompanyAnalyticsQuery): Promise<CompanyAnalyticsOutcome> {
  try {
    const company = await prisma.companies.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!company) {
      return {
        success: false,
        code: "PROFILE_NOT_FOUND",
        error: "Company profile not found",
      };
    }

    // The version is read fresh on every request and never memoized: a company
    // mutation advances it, which retires every `days`/`language` variant of
    // this company's entries at once. A missing version means the company has
    // never been invalidated, so 0 is correct.
    const version = await getCompanyAnalyticsVersion(company.id);

    const cacheKey = CACHE_KEY(company.id, version, days, language);
    if (!refresh) {
      const cached = await getCachedDashboardStats(cacheKey);
      if (cached) {
        try {
          const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
          return { success: true, data: parsed as CompanyAnalyticsData };
        } catch {
          // Cache corrupted, proceed
        }
      }
    }

    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - days);

    // ─── Analytics queries ─────────────────────────────────────────
    // All five groups depend only on `company.id`, `language`, `fromDate`
    // and `now`, so they are independent and can run concurrently. The
    // helper functions each keep their own internal `Promise.all`, so the
    // per-group fan-out is unchanged and no extra DB operations are added.
    const [kpis, genderData, ageData, jobPerformance, availableLanguages] = await Promise.all([
      getCompanyKPIs(company.id, language, fromDate, now),
      getGenderData(company.id, language, fromDate),
      getAgeData(company.id, language, fromDate, now),
      getDashboardJobPerformance(company.id, language, fromDate),
      getAvailableLanguages(company.id),
    ]);

    const totalViews = kpis.totalViews;
    const totalJobListings = kpis.totalJobListings;
    const activeJobListings = kpis.activeJobListings;
    const receivedApplications = kpis.receivedApplications;

    const jobPerformanceFormatted = jobPerformance.map((job) => {
      const views = job.views ?? 0;
      const applications = job._count.applications;
      return {
        id: job.id,
        title: job.title,
        primaryLanguage: job.languages[0]?.language ?? "N/A",
        location: job.customLocation ?? "",
        views,
        applications,
        conversionRate: views > 0 ? Number(((applications / views) * 100).toFixed(1)) : 0,
        status: job.status,
      };
    });

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
        availableLanguages,
      },
    };

    await setCachedDashboardStats(cacheKey, JSON.stringify(data), CACHE_TTL);

    return { success: true, data };
  } catch (error) {
    const errorInfo = error instanceof Error
      ? { message: error.message, name: error.name, stack: error.stack }
      : { error: String(error) };
    logger.error("Get company analytics error", { error: errorInfo });
    return {
      success: false,
      code: "QUERY_FAILED",
      error: "Failed to fetch analytics data",
    };
  }
}
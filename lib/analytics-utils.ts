export interface CompanyAnalyticsAge {
  "18-24": number;
  "25-34": number;
  "35-44": number;
  "45-55": number;
  "55+": number;
}

export function pct(count: number, total: number): number {
  return total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
}

export function buildJobWhere(
  companyId: string,
  language: string | "all",
  fromDate: Date,
  opts?: { includeTimeWindow?: boolean }
): Record<string, unknown> {
  const where: Record<string, unknown> = {
    companyId,
    deletedAt: null,
  };
  if (opts?.includeTimeWindow) {
    where.createdAt = { gte: fromDate };
  }
  if (language !== "all") {
    where.languages = {
      some: {
        language,
        level: "REQUIRED",
      },
    };
  }
  return where;
}

export function buildAppWhere(
  companyId: string,
  language: string | "all",
  fromDate: Date
): Record<string, unknown> {
  const jobOfferWhere: Record<string, unknown> = {
    companyId,
    deletedAt: null,
  };
  if (language !== "all") {
    jobOfferWhere.languages = {
      some: {
        language,
        level: "REQUIRED",
      },
    };
  }
  return {
    jobOffer: jobOfferWhere,
    createdAt: { gte: fromDate },
  };
}

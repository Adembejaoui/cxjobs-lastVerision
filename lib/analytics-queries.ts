import prisma from "@/lib/prisma";
import { CompanyAnalyticsAge } from "@/types/company-analytics";
import { buildJobWhere } from "@/lib/analytics-utils";

export interface CompanyKPIs {
  totalJobListings: number;
  activeJobListings: number;
  receivedApplications: number;
  totalViews: number;
}

export async function getCompanyKPIs(
  companyId: string,
  language: string,
  fromDate: Date,
  now: Date
): Promise<CompanyKPIs> {
  // Single round-trip SQL replacing the previous 4 concurrent Prisma
  // operations (two jobOffer.count, one application.count, one
  // jobOffer.aggregate). Semantics are identical:
  //  - totalJobListings: count of the company's jobs created >= fromDate
  //  - activeJobListings: above, PUBLISHED and (expiresAt IS NULL OR > now)
  //  - receivedApplications: applications on those jobs created >= fromDate
  //  - totalViews: SUM(views) over ALL jobs (NO createdAt filter, matching the
  //    prior aggregate's includeTimeWindow: false)
  // The language filter uses the `'all'` sentinel that buildJobWhere treats as
  // "no filter" so the EXISTS short-circuits to a no-op. Only user-supplied
  // values (companyId / language / dates) are parameterized; 'REQUIRED' and
  // 'PUBLISHED' are hardcoded constants.
  const rows = await prisma.$queryRaw<
    Array<{
      totalJobListings: number;
      activeJobListings: number;
      receivedApplications: number;
      totalViews: number;
    }>
  >`
    SELECT
      (SELECT COUNT(*)
       FROM "job_offers" jo
       WHERE jo."companyId" = ${companyId}
         AND jo."deletedAt" IS NULL
         AND jo."createdAt" >= ${fromDate}
         AND (${language} = 'all' OR EXISTS (
           SELECT 1 FROM "job_languages" jl
           WHERE jl."jobOfferId" = jo."id"
             AND jl."level" = 'REQUIRED'
             AND jl."language" = ${language}
         ))) AS "totalJobListings",
      (SELECT COUNT(*)
       FROM "job_offers" jo
       WHERE jo."companyId" = ${companyId}
         AND jo."deletedAt" IS NULL
         AND jo."createdAt" >= ${fromDate}
         AND jo."status" = 'PUBLISHED'
         AND (jo."expiresAt" IS NULL OR jo."expiresAt" > ${now})
         AND (${language} = 'all' OR EXISTS (
           SELECT 1 FROM "job_languages" jl
           WHERE jl."jobOfferId" = jo."id"
             AND jl."level" = 'REQUIRED'
             AND jl."language" = ${language}
         ))) AS "activeJobListings",
      (SELECT COALESCE(SUM(jo."views"), 0)
       FROM "job_offers" jo
       WHERE jo."companyId" = ${companyId}
         AND jo."deletedAt" IS NULL
         AND (${language} = 'all' OR EXISTS (
           SELECT 1 FROM "job_languages" jl
           WHERE jl."jobOfferId" = jo."id"
             AND jl."level" = 'REQUIRED'
             AND jl."language" = ${language}
         ))) AS "totalViews",
      (SELECT COUNT(*)
       FROM "applications" a
       JOIN "job_offers" jo ON a."jobOfferId" = jo."id"
       WHERE jo."companyId" = ${companyId}
         AND jo."deletedAt" IS NULL
         AND a."createdAt" >= ${fromDate}
         AND (${language} = 'all' OR EXISTS (
           SELECT 1 FROM "job_languages" jl
           WHERE jl."jobOfferId" = jo."id"
             AND jl."level" = 'REQUIRED'
             AND jl."language" = ${language}
         ))) AS "receivedApplications"
  `;

  const row = rows[0];
  return {
    totalJobListings: Number(row?.totalJobListings ?? 0),
    activeJobListings: Number(row?.activeJobListings ?? 0),
    receivedApplications: Number(row?.receivedApplications ?? 0),
    totalViews: Number(row?.totalViews ?? 0),
  };
}

interface GenderAndAgeRow {
  total: number;
  female: number;
  male: number;
  age_18_24: number;
  age_25_34: number;
  age_35_44: number;
  age_45_55: number;
  age_55_plus: number;
}

type GenderAndAgeResult = {
  gender: { total: number; female: number; male: number };
  age: CompanyAnalyticsAge;
};

const genderAgeCache = new Map<string, Promise<GenderAndAgeResult>>();

async function getGenderAndAgeData(
  companyId: string,
  language: string,
  fromDate: Date,
  now: Date = new Date()
): Promise<GenderAndAgeResult> {
  const key = `${companyId}:${language}:${fromDate.toISOString()}`;
  const cached = genderAgeCache.get(key);
  if (cached) return cached;

  // PostgreSQL returns COUNT(*)/SUM(int) as int8, which the `pg` driver
  // surfaces as JS BigInt (neither the project nor @prisma/adapter-pg enables
  // pg's parseInt8 opt-in). Number(...) mirrors the existing conversion used
  // by these queries and keeps BigInt out of the cache payload/JSON.
  const promise = (async () => {
    const rows = await prisma.$queryRaw<Array<GenderAndAgeRow>>`
      WITH applicants AS (
        SELECT DISTINCT a."candidateId" AS "candidateId"
        FROM applications a
        JOIN "job_offers" j ON a."jobOfferId" = j."id"
        WHERE j."companyId" = ${companyId}
          AND j."deletedAt" IS NULL
          AND a."createdAt" >= ${fromDate}
          AND a."candidateId" IS NOT NULL
          AND (${language} = 'all' OR EXISTS (
            SELECT 1 FROM "job_languages" jl
            WHERE jl."jobOfferId" = j."id"
              AND jl."language" = ${language}
              AND jl."level" = 'REQUIRED'
          ))
      )
      SELECT
        COUNT(*) FILTER (WHERE c."gender" IN ('Male', 'Female')) AS "total",
        COUNT(*) FILTER (WHERE c."gender" = 'Female') AS "female",
        COUNT(*) FILTER (WHERE c."gender" = 'Male') AS "male",
        SUM(CASE WHEN c."dateOfBirth" IS NOT NULL AND EXTRACT(YEAR FROM AGE(${now}, c."dateOfBirth")) BETWEEN 18 AND 24 THEN 1 ELSE 0 END) AS "age_18_24",
        SUM(CASE WHEN c."dateOfBirth" IS NOT NULL AND EXTRACT(YEAR FROM AGE(${now}, c."dateOfBirth")) BETWEEN 25 AND 34 THEN 1 ELSE 0 END) AS "age_25_34",
        SUM(CASE WHEN c."dateOfBirth" IS NOT NULL AND EXTRACT(YEAR FROM AGE(${now}, c."dateOfBirth")) BETWEEN 35 AND 44 THEN 1 ELSE 0 END) AS "age_35_44",
        SUM(CASE WHEN c."dateOfBirth" IS NOT NULL AND EXTRACT(YEAR FROM AGE(${now}, c."dateOfBirth")) BETWEEN 45 AND 55 THEN 1 ELSE 0 END) AS "age_45_55",
        SUM(CASE WHEN c."dateOfBirth" IS NOT NULL AND EXTRACT(YEAR FROM AGE(${now}, c."dateOfBirth")) > 55 THEN 1 ELSE 0 END) AS "age_55_plus"
      FROM applicants ap
      JOIN candidates c ON c."id" = ap."candidateId"
    `;

    const row = rows[0];
    return {
      gender: {
        total: Number(row?.total ?? 0),
        female: Number(row?.female ?? 0),
        male: Number(row?.male ?? 0),
      },
      age: {
        "18-24": Number(row?.age_18_24 ?? 0),
        "25-34": Number(row?.age_25_34 ?? 0),
        "35-44": Number(row?.age_35_44 ?? 0),
        "45-55": Number(row?.age_45_55 ?? 0),
        "55+": Number(row?.age_55_plus ?? 0),
      },
    };
  })();

  genderAgeCache.set(key, promise);
  promise.finally(() => {
    genderAgeCache.delete(key);
  });
  return promise;
}

/**
 * Distinct-applicant gender counts for a company. Delegates to the shared
 * getGenderAndAgeData() query (one DB round-trip shared with getAgeData).
 */
export async function getGenderData(
  companyId: string,
  language: string,
  fromDate: Date
): Promise<{ total: number; female: number; male: number }> {
  // Yield one microtask so a concurrent getAgeData() call — which carries the
  // request's authoritative `now` — registers the in-flight query first.
  // Gender is time-blind; the deferral only exists so age keeps the same
  // request-level `now` the previous two-query implementation used.
  await Promise.resolve();
  const { gender } = await getGenderAndAgeData(companyId, language, fromDate);
  return gender;
}

/**
 * Company applicant age-distribution buckets. Delegates to the shared
 * getGenderAndAgeData() query (one DB round-trip shared with getGenderData).
 * `now` is the application-supplied reference timestamp, bound as a parameter
 * (never a SQL NOW()).
 */
export async function getAgeData(
  companyId: string,
  language: string,
  fromDate: Date,
  now: Date = new Date()
): Promise<CompanyAnalyticsAge> {
  const { age } = await getGenderAndAgeData(companyId, language, fromDate, now);
  return age;
}

export interface DashboardJobPerformanceRow {
  id: string;
  title: string;
  status: string;
  customLocation: string | null;
  views: number | null;
  languages: { language: string }[];
  _count: { applications: number };
}

export async function getDashboardJobPerformance(
  companyId: string,
  language: string,
  fromDate: Date
): Promise<DashboardJobPerformanceRow[]> {
  return prisma.jobOffer.findMany({
    where: {
      ...buildJobWhere(companyId, language, fromDate, { includeTimeWindow: true }),
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
    orderBy: [
      { applications: { _count: "desc" } },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: 5,
  });
}

export async function getAvailableLanguages(companyId: string): Promise<string[]> {
  const rows = await prisma.jobLanguage.findMany({
    where: {
      level: "REQUIRED",
      jobOffer: {
        companyId,
        deletedAt: null,
      },
    },
    select: { language: true },
    distinct: ["language"],
  });

  return rows.map((r) => r.language).sort();
}
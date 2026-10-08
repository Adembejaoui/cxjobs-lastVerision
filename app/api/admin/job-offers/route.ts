import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { parsePaginationParams } from "@/lib/utils";
import { logger } from "@/lib/logger";

/**
 * GET /api/admin/job-offers
 *
 * Lazy-loads jobs for a single company (used by the Admin Company Job drawer).
 *
 * Query parameters:
 *   companyId  (required)  - verified to exist; only this company's jobs are returned
 *   page, limit              - server-side pagination
 *   search                   - free-text search on title
 *   status                   - filter by JobOfferStatus
 *   sort                     - allow-listed sort keys
 *
 * The application count is included in the same findMany via _count to avoid
 * a per-job count query (N+1).
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const adminUser = authResult.user;
    const LIST_LIMIT = { windowMs: 60_000, max: 60 };
    const rl = await checkRateLimitAsync(`admin-job-offers-list:${adminUser.id}`, LIST_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) },
      );
    }

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit"),
    );

    const rawCompanyId = searchParams.get("companyId")?.trim();
    if (!rawCompanyId) {
      return NextResponse.json(
        { success: false, error: "companyId is required", code: "BAD_REQUEST" },
        { status: 400 },
      );
    }

    const search = searchParams.get("search")?.trim() || undefined;
    const status = searchParams.get("status")?.trim().toUpperCase() || undefined;
    const sort = searchParams.get("sort") ?? "createdAt-desc";

    // Verify the target company exists. Admin has global access, but we still
    // need a concrete company to scope the job list and to prevent arbitrary
    // company IDs from producing misleading empty results.
    const company = await prisma.companies.findUnique({
      where: { id: rawCompanyId, deletedAt: null },
      select: { id: true, name: true },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const where: Record<string, unknown> = {
      companyId: company.id,
      deletedAt: null,
    };

    if (search) {
      where.title = { contains: search, mode: "insensitive" };
    }

    if (status) {
      where.status = status;
    }

    const orderBy = getJobOrderBy(sort);

    // One paginated query + one count. _count.applications is resolved in the
    // same query so no per-job count loop is needed.
    const [jobs, total] = await Promise.all([
      prisma.jobOffer.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          views: true,
          contractType: true,
          employmentType: true,
          isRemote: true,
          isHybrid: true,
          customLocation: true,
          salaryMin: true,
          salaryMax: true,
          salaryCurrency: true,
          activityType: true,
          activityCustom: true,
          featured: true,
          highlight: true,
          publishedAt: true,
          closedAt: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          description: true,
          requirements: true,
          technicalTools: true,
          softSkills: true,
          applicationType: true,
          externalApplyUrl: true,
          benefits: {
            select: {
              id: true,
              benefit: {
                select: { id: true, name: true },
              },
            },
          },
          languages: {
            select: { language: true, level: true },
          },
          _count: {
            select: { applications: true },
          },
        },
        skip,
        take: limit,
        orderBy,
      }),
      prisma.jobOffer.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      company: {
        id: company.id,
        name: company.name,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch admin job offers", { error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch job offers", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}

function getJobOrderBy(sort: string) {
  switch (sort) {
    case "title-asc":
      return { title: "asc" as const };
    case "title-desc":
      return { title: "desc" as const };
    case "createdAt-asc":
      return { createdAt: "asc" as const };
    case "createdAt-desc":
      return { createdAt: "desc" as const };
    case "views-asc":
      return { views: "asc" as const };
    case "views-desc":
      return { views: "desc" as const };
    default:
      return { createdAt: "desc" as const };
  }
}
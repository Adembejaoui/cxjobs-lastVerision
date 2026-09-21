import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import  prisma  from "@/lib/prisma";
import { createJobOfferSchema, contractTypeSchema, employmentTypeSchema, activityTypeSchema, jobStatusSchema } from "@/lib/validations/job";
import { parsePaginationParams } from "@/lib/utils";
import { unstable_cache } from "next/cache";
import { revalidateJobOffers } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";
import { getSortOrder, applyJobOfferFilters } from "@/lib/job-offers-utils";

// Cached function for fetching public job offers
async function getPublicJobOffers(filters: {
  page: number;
  limit: number;
  skip: number;
  companyId?: string;
  contractType?: string;
  employmentType?: string;
  activityType?: string;
  isRemote?: boolean;
  isHybrid?: boolean;
  location?: string;
  search?: string;
  salaryMin?: number;
  salaryMax?: number;
  sort?: string;
  language?: string;
}) {
  return unstable_cache(
    async () => {
      const now = new Date();

      const where: Record<string, unknown> = {
        deletedAt: null,
        status: "PUBLISHED",
      };

      if (filters.companyId) {
        where.companyId = filters.companyId;
      }

      const andConditions: object[] = [];

      applyJobOfferFilters(where, andConditions, filters, now);

      const [jobOffers, total] = await Promise.all([
        prisma.jobOffer.findMany({
          where,
          include: {
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                location: true,
                isRemoteFriendly: true,
                isHybridFriendly: true,
              },
            },
            _count: {
              select: {
                applications: true,
              },
            },
          },
          skip: filters.skip,
          take: filters.limit,
          orderBy: getSortOrder(filters.sort),
        }),
        prisma.jobOffer.count({ where }),
      ]);

      return { jobOffers, total };
    },
    [
      "public-job-offers",
      String(filters.page),
      String(filters.limit),
      String(filters.skip),
      filters.search ?? "",
      filters.contractType ?? "",
      filters.employmentType ?? "",
      filters.activityType ?? "",
      filters.location ?? "",
      filters.companyId ?? "",
      String(filters.isRemote ?? ""),
      String(filters.isHybrid ?? ""),
      String(filters.salaryMin ?? ""),
      String(filters.salaryMax ?? ""),
      filters.sort ?? "",
      filters.language ?? "",
    ],
    {
      revalidate: 60,
      tags: ["job-offers"],
    }
  )();
}

const LIST_LIMIT = { windowMs: 60_000, max: 60 };
const POST_LIMIT = { windowMs: 60_000, max: 10 };

// GET /api/job-offers - List job offers (public with filters)
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await checkRateLimitAsync(`job-offers-list:${ip}`, LIST_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const { searchParams } = new URL(request.url);

    const { page, limit, skip } = parsePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    );

    const filters = {
      page,
      limit,
      skip,
      companyId: searchParams.get("companyId") || undefined,
      status: searchParams.get("status") || undefined,
      contractType: searchParams.get("contractType") || undefined,
      employmentType: searchParams.get("employmentType") || undefined,
      activityType: searchParams.get("activityType") || undefined,
      isRemote: searchParams.get("isRemote") === "true" ? true : searchParams.get("isRemote") === "false" ? false : undefined,
      isHybrid: searchParams.get("isHybrid") === "true" ? true : searchParams.get("isHybrid") === "false" ? false : undefined,
      location: searchParams.get("location") || undefined,
      search: searchParams.get("search") || undefined,
      salaryMin: searchParams.get("salaryMin") ? parseInt(searchParams.get("salaryMin")!, 10) : undefined,
      salaryMax: searchParams.get("salaryMax") ? parseInt(searchParams.get("salaryMax")!, 10) : undefined,
      sort: searchParams.get("sort") || undefined,
      language: searchParams.get("language") || undefined,
    };

    const statusValidation = jobStatusSchema.safeParse(filters.status);
    if (!statusValidation.success && filters.status !== undefined) {
      return NextResponse.json(
        { success: false, error: "Invalid status parameter", code: "INVALID_PARAM" },
        { status: 400 }
      );
    }

    if (filters.contractType) {
      const contractTypes = filters.contractType.split(",").map((t) => t.trim()).filter(Boolean);
      const contractValidation = contractTypeSchema.array().safeParse(contractTypes);
      if (!contractValidation.success) {
        return NextResponse.json(
          { success: false, error: "Invalid contractType parameter", code: "INVALID_PARAM" },
          { status: 400 }
        );
      }
    }

    if (filters.employmentType) {
      const employmentTypes = filters.employmentType.split(",").map((t) => t.trim()).filter(Boolean);
      const employmentValidation = employmentTypeSchema.array().safeParse(employmentTypes);
      if (!employmentValidation.success) {
        return NextResponse.json(
          { success: false, error: "Invalid employmentType parameter", code: "INVALID_PARAM" },
          { status: 400 }
        );
      }
    }

    if (filters.activityType) {
      const activityTypes = filters.activityType.split(",").map((t) => t.trim()).filter(Boolean);
      const activityValidation = activityTypeSchema.array().safeParse(activityTypes);
      if (!activityValidation.success) {
        return NextResponse.json(
          { success: false, error: "Invalid activityType parameter", code: "INVALID_PARAM" },
          { status: 400 }
        );
      }
    }

    // Check if user is a company owner or admin (needs uncached results)
    const session = await auth();
    const isCompanyOwner = session?.user?.role === "COMPANY";
    const isAdmin = session?.user?.role === "ADMIN";

    // For public users, use cached results
    if (!isCompanyOwner && !isAdmin) {
      const { jobOffers, total } = await getPublicJobOffers({
        page: filters.page,
        limit: filters.limit,
        skip: filters.skip,
        companyId: filters.companyId,
        contractType: filters.contractType,
        employmentType: filters.employmentType,
        isRemote: filters.isRemote,
        isHybrid: filters.isHybrid,
        location: filters.location,
        search: filters.search,
        salaryMin: filters.salaryMin,
        salaryMax: filters.salaryMax,
        sort: filters.sort,
        language: filters.language,
      });

      return NextResponse.json({
        success: true,
        data: jobOffers,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages: Math.ceil(total / filters.limit),
        },
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        },
      });
    }

    // For company owners and admins, fetch uncached results
    const now = new Date();

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    // Admins can see all jobs including drafts, companies see only their own
    if (!isAdmin) {
      const company = await prisma.companies.findUnique({
        where: { userId: session!.user.id },
      });
      if (company) {
        where.companyId = company.id;
      }
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.companyId) {
      where.companyId = filters.companyId;
    }

    const andConditions: object[] = [];

    applyJobOfferFilters(where, andConditions, filters, now);

    const [jobOffers, total] = await Promise.all([
      prisma.jobOffer.findMany({
        where,
        include: {
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                location: true,
                isRemoteFriendly: true,
                isHybridFriendly: true,
              },
            },
          _count: {
            select: { applications: true },
          },
        },
        skip,
        take: filters.limit,
        orderBy: getSortOrder(filters.sort),
      }),
      prisma.jobOffer.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: jobOffers,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    });
  } catch (error) {
     logger.error("Get job offers error", { error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch job offers", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/job-offers - Create job offer (company only)
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await checkRateLimitAsync(`job-offers-create:${ip}`, POST_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    if (session.user.role !== "COMPANY") {
      return NextResponse.json(
        { success: false, error: "Only companies can create job offers", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Get company profile
    const company = await prisma.companies.findUnique({
      where: { userId: session.user.id },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company profile not found", code: "PROFILE_NOT_FOUND" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validationResult = createJobOfferSchema.safeParse(body);

    if (!validationResult.success) {
      logger.error("POST /api/job-offers validation failed", {
        fieldErrors: validationResult.error.flatten().fieldErrors,
        body,
        userId: session.user.id,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { slug, benefitIds, languages, ...jobData } = validationResult.data;

    // Verify all benefitIds belong to this company before creating the job
    if (benefitIds && benefitIds.length > 0) {
      const validBenefits = await prisma.companyBenefit.findMany({
        where: {
          id: { in: benefitIds },
          companyId: company.id,
        },
      });
      if (validBenefits.length !== benefitIds.length) {
        return NextResponse.json(
          { success: false, error: "One or more benefits are invalid or do not belong to your company", code: "INVALID_BENEFITS" },
          { status: 400 }
        );
      }
    }

    // Generate slug from title if not provided
    const baseSlug =
      slug ||
      (jobData.title as string)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    const jobSlug = `${baseSlug}-${Date.now().toString(36)}`;

    const now = new Date();

    const publishedAt = jobData.status === "PUBLISHED" ? now : null;
    let expiresAt: Date | null | undefined = jobData.expiresAt;
    if (jobData.status === "PUBLISHED" && !expiresAt) {
      const oneMonth = new Date(now);
      oneMonth.setMonth(oneMonth.getMonth() + 1);
      expiresAt = oneMonth;
    }

    let jobOffer: Awaited<ReturnType<typeof prisma.jobOffer.create>>;

    try {
      jobOffer = await prisma.jobOffer.create({
        data: {
          ...jobData,
          slug: jobSlug,
          companyId: company.id,
          publishedAt,
          expiresAt,
          ...(benefitIds && benefitIds.length > 0
            ? {
                benefits: {
                  create: benefitIds.map((benefitId) => ({
                    benefitId,
                  })),
                },
              }
            : {}),
          ...(languages && languages.length > 0
            ? {
                languages: {
                  create: languages.map((lang) => ({
                    language: lang.language,
                    level: lang.level,
                  })),
                },
              }
            : {}),
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
          benefits: {
            include: {
              benefit: true,
            },
          },
          languages: true,
        },
      });
    } catch (e: unknown) {
      if ((e as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { success: false, error: "A job with this slug already exists", code: "SLUG_EXISTS" },
          { status: 400 }
        );
      }
      throw e;
    }

    // Revalidate job offers cache
    revalidateJobOffers();

    return NextResponse.json(
      {
        success: true,
        message: "Job offer created successfully",
        data: jobOffer,
      },
      { status: 201 }
    );
  } catch (error) {
      logger.error("Create job offer error", { error });
    return NextResponse.json(
      { success: false, error: "Failed to create job offer", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

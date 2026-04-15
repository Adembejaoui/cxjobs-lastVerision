import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import  prisma  from "@/lib/prisma";
import { createJobOfferSchema, jobOfferFilterSchema } from "@/lib/validations/job";
import { parsePaginationParams } from "@/lib/utils";
import { unstable_cache } from "next/cache";
import { revalidateJobOffers } from "@/lib/cache";

// Cached function for fetching public job offers
const getPublicJobOffers = unstable_cache(
  async (filters: {
    page: number;
    limit: number;
    skip: number;
    companyId?: string;
    contractType?: "CDI" | "CDD" | "FREELANCE" | "INTERNSHIP" | "PART_TIME" | "APPRENTICESHIP";
    location?: string;
    search?: string;
  }) => {
    const where: Record<string, unknown> = {
      deletedAt: null,
      status: "PUBLISHED",
    };

    if (filters.companyId) {
      where.companyId = filters.companyId;
    }

    if (filters.contractType) {
      where.contractType = filters.contractType;
    }

    if (filters.location) {
      where.OR = [
        { customLocation: { contains: filters.location, mode: "insensitive" } },
        { company: { location: { contains: filters.location, mode: "insensitive" } } },
      ];
    }

    if (filters.search) {
      where.OR = [
        ...(Array.isArray(where.OR) ? where.OR : []),
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

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
              industry: true,
              location: true,
              isRemoteFriendly: true,
              isHybridFriendly: true,
            },
          },
          _count: {
            select: { applications: true },
          },
        },
        skip: filters.skip,
        take: filters.limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.jobOffer.count({ where }),
    ]);

    return { jobOffers, total };
  },
  ["public-job-offers"],
  { revalidate: 60, tags: ["job-offers"] }
);

// GET /api/job-offers - List job offers (public with filters)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Use safe pagination with enforced limits
    const { page, limit, skip } = parsePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    );

    const filters = {
      page,
      limit,
      skip,
      companyId: searchParams.get("companyId") || undefined,
      status: searchParams.get("status") as "DRAFT" | "PUBLISHED" | "ARCHIVED" | "CLOSED" | "EXPIRED" | undefined,
      contractType: searchParams.get("contractType") as "CDI" | "CDD" | "FREELANCE" | "INTERNSHIP" | "PART_TIME" | "APPRENTICESHIP" | undefined,
      location: searchParams.get("location") || undefined,
      search: searchParams.get("search") || undefined,
    };

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
        location: filters.location,
        search: filters.search,
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
      });
    }

    // For company owners and admins, fetch uncached results
    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    // Admins can see all jobs including drafts, companies see only their own
    if (!isAdmin) {
      const company = await prisma.company.findUnique({
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

    if (filters.contractType) {
      where.contractType = filters.contractType;
    }

    if (filters.location) {
      where.OR = [
        { customLocation: { contains: filters.location, mode: "insensitive" } },
        { company: { location: { contains: filters.location, mode: "insensitive" } } },
      ];
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

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
              industry: true,
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
        orderBy: { createdAt: "desc" },
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
    console.error("Get job offers error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: "Failed to fetch job offers", details: errorMessage, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/job-offers - Create job offer (company only)
export async function POST(request: NextRequest) {
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
        { success: false, error: "Only companies can create job offers", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Get company profile
    const company = await prisma.company.findUnique({
      where: { userId: session.user.id },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company profile not found", code: "PROFILE_NOT_FOUND" },
        { status: 404 }
      );
    }

    const body = await request.json();
    console.log("Job creation request body:", JSON.stringify(body, null, 2));
    const validationResult = createJobOfferSchema.safeParse(body);

    if (!validationResult.success) {
      console.log("Validation error:", JSON.stringify(validationResult.error.flatten(), null, 2));
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

    // Generate slug from title if not provided
    const jobSlug =
      slug ||
      (jobData.title as string)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
        "-" +
        Date.now().toString(36);

    // Check if slug is unique
    const existingSlug = await prisma.jobOffer.findUnique({
      where: { slug: jobSlug },
    });

    if (existingSlug) {
      return NextResponse.json(
        { success: false, error: "A job with this slug already exists", code: "SLUG_EXISTS" },
        { status: 400 }
      );
    }

    // Create job offer with benefits and languages
    const jobOffer = await prisma.jobOffer.create({
      data: {
        ...jobData,
        slug: jobSlug,
        companyId: company.id,
        publishedAt: jobData.status === "PUBLISHED" ? new Date() : null,
        // Handle benefits
        ...(benefitIds && benefitIds.length > 0
          ? {
              benefits: {
                create: benefitIds.map((benefitId) => ({
                  benefitId,
                })),
              },
            }
          : {}),
        // Handle languages
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
    console.error("Create job offer error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create job offer", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

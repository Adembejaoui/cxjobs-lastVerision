import { NextRequest, NextResponse } from "next/server";
import  prisma  from "@/lib/prisma";
import { parsePaginationParams } from "@/lib/utils";
import { logger } from "@/lib/logger";

function getOrderBy(sort?: string | null) {
  switch (sort) {
    case "most-jobs":
      return { count: { jobs: "desc" as const } }
    case "most-followers":
      return { count: { followers: "desc" as const } }
    case "newest":
      return { createdAt: "desc" as const }
    case "name-asc":
      return { name: "asc" as const }
    case "name-desc":
      return { name: "desc" as const }
    default:
      return { createdAt: "desc" as const }
  }
}

// GET /api/profile/allCompanies - List all companies (public)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const { page, limit, skip } = parsePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    );

    const location = searchParams.get("location");
    const companySize = searchParams.get("companySize");
    const sort = searchParams.get("sort");

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (location) {
      where.location = { contains: location, mode: "insensitive" as const };
    }

    if (companySize) {
      where.companySize = { contains: companySize, mode: "insensitive" as const };
    }

    const [companies, total] = await Promise.all([
      prisma.companies.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          logoUrl: true,
          coverImageUrl: true,
          companySize: true,
          location: true,
          createdAt: true,
          _count: {
            select: { jobs: true },
          },
        },
        skip,
        take: limit,
        orderBy: getOrderBy(sort),
      }),
      prisma.companies.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: companies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("Failed to fetch companies", { error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch companies", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

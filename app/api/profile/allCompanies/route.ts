import { NextRequest, NextResponse } from "next/server";
import  prisma  from "@/lib/prisma";
import { parsePaginationParams } from "@/lib/utils";

// GET /api/profile/allCompanies - List all companies (public)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Use safe pagination with enforced limits
    const { page, limit, skip } = parsePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    );
    
    const industry = searchParams.get("industry");
    const location = searchParams.get("location");

    const where = {
      deletedAt: null,
      ...(industry && { industry: { equals: industry } }),
      ...(location && { location: { contains: location, mode: "insensitive" as const } }),
    };

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
          industry: true,
          companySize: true,
          location: true,
          createdAt: true,
          _count: {
            select: { jobs: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
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
    console.error("Get companies error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch companies", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import  prisma  from "@/lib/prisma";

interface RouteParams {
  params: Promise<{
    slug: string
  }>
}

// GET /api/companies/[slug] - Get company by slug (public)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params

    const company = await prisma.companies.findUnique({
      where: { slug, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        mission: true,
        logoUrl: true,
        coverImageUrl: true,
        website: true,
        linkedinUrl: true,
        twitterUrl: true,
        facebookUrl: true,
        industry: true,
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
          }
        },
        culture: true,
        createdAt: true,
        _count: {
          select: { jobs: true },
        },
        jobs: {
          where: { status: "PUBLISHED" },
          select: {
            id: true,
            title: true,
            slug: true,
            customLocation: true,
            contractType: true,
            isRemote: true,
            isHybrid: true,
            salary: true,
            salaryMin: true,
            salaryMax: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    })

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: company,
    })
  } catch (error) {
    console.error("Get company error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch company", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}

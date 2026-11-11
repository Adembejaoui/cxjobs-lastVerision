import { NextRequest, NextResponse } from "next/server";
import  prisma  from "@/lib/prisma";
import { JobOfferStatus } from "@/app/generated/prisma/client";
import { logger } from "@/lib/logger";
import { activeCompanyWhere } from "@/lib/security/company-activity";
import { resolveCompanySlugRedirect } from "@/lib/server/company-slug"

/** Jobs that are publicly visible right now. */
function liveJobsWhere() {
  return {
    status: JobOfferStatus.PUBLISHED,
    deletedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
}

interface RouteParams {
  params: Promise<{
    slug: string
  }>
}

// GET /api/companies/[slug] - Get company by slug (public)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params

    // F-04: a suspended or deleted company has no public profile (404).
    const company = await prisma.companies.findFirst({
      where: { slug, ...activeCompanyWhere() },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        coverImageUrl: true,
        website: true,
        linkedinUrl: true,
        twitterUrl: true,
        facebookUrl: true,
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
        // Public endpoint: count and list only live jobs (counting every row
        // revealed how many drafts/deleted jobs a company has).
        _count: {
          select: { jobs: { where: liveJobsWhere() } },
        },
        jobs: {
          where: liveJobsWhere(),
          select: {
            id: true,
            title: true,
            slug: true,
            customLocation: true,
            contractType: true,
            employmentType: true,
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
      // A6: an old slug redirects to the company's current one.
      const current = await resolveCompanySlugRedirect(slug)
      if (current) {
        return NextResponse.redirect(new URL(`/api/companies/${encodeURIComponent(current)}`, request.url), 308)
      }
      return NextResponse.json(
        { success: false, error: "Company not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: company,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    })
  } catch (error) {
    logger.error("Failed to fetch company", { error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch company", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import  prisma from "@/lib/prisma";
import { unstable_cache } from "next/cache";

// Cached function for fetching a single published job offer by slug
const getPublicJobOfferBySlug = unstable_cache(
  async (slug: string) => {
    return prisma.jobOffer.findFirst({
      where: { 
        slug,
        deletedAt: null,
        status: "PUBLISHED"
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            industry: true,
            location: true,
            website: true,
            description: true,
            isRemoteFriendly: true,
            isHybridFriendly: true,
            benefits: {
              where: { scope: "CORE" },
            },
          },
        },
        benefits: {
          include: { benefit: true },
        },
        languages: true,
        _count: {
          select: { applications: true },
        },
      },
    });
  },
  ["public-job-offer-by-slug"],
  { revalidate: 60, tags: ["job-offer"] }
);

// GET /api/job-offers/by-slug/[slug] - Get single job offer by slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const session = await auth();

    // For public users and admins, use cached results for published jobs
    const isCompany = session?.user?.role === "COMPANY";
    const isAdmin = session?.user?.role === "ADMIN";
    
    if (!isCompany && !isAdmin) {
      const jobOffer = await getPublicJobOfferBySlug(slug);

      if (!jobOffer) {
        return NextResponse.json(
          { success: false, error: "Job offer not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: jobOffer,
      });
    }

    // For company users and admins, get full job details
    const jobOffer = await prisma.jobOffer.findFirst({
      where: { slug, deletedAt: null },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            industry: true,
            location: true,
            website: true,
            description: true,
            isRemoteFriendly: true,
            isHybridFriendly: true,
            benefits: {
              where: { scope: "CORE" },
            },
          },
        },
        benefits: {
          include: { benefit: true },
        },
        languages: true,
        _count: {
          select: { applications: true },
        },
      },
    });

    if (!jobOffer) {
      return NextResponse.json(
        { success: false, error: "Job offer not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check access - admins can see all, companies can only see their own
    if (!isAdmin && session?.user?.role === "COMPANY") {
      const userCompany = await prisma.companies.findFirst({
        where: { userId: session.user.id, id: jobOffer.companyId },
      });
      if (!userCompany) {
        return NextResponse.json(
          { success: false, error: "Job offer not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: jobOffer,
    });
  } catch (error) {
    console.error("Error fetching job offer:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch job offer" },
      { status: 500 }
    );
  }
}

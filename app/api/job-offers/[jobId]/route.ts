import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateJobOfferSchema } from "@/lib/validations/job";
import { unstable_cache } from "next/cache";
import { revalidateJobOffers } from "@/lib/cache";

// Cached function for fetching a single published job offer
const getPublicJobOffer = unstable_cache(
  async (jobId: string) => {
    return prisma.jobOffer.findUnique({
      where: { id: jobId },
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
  ["public-job-offer"],
  { revalidate: 60, tags: ["job-offer"] }
);

// GET /api/job-offers/[jobId] - Get single job offer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const session = await auth();

    // For public users and admins, use cached results for published jobs
    const isCompany = session?.user?.role === "COMPANY";
    const isAdmin = session?.user?.role === "ADMIN";
    
    if (!isCompany && !isAdmin) {
      const jobOffer = await getPublicJobOffer(jobId);

      console.log('Public job fetch - Job ID:', jobId);
      console.log('Job found:', jobOffer ? 'yes' : 'no');
      if (jobOffer) {
        console.log('Job deletedAt:', jobOffer.deletedAt);
        console.log('Job status:', jobOffer.status);
      }

      if (!jobOffer) {
        return NextResponse.json(
          { success: false, error: "Job offer not found", code: "NOT_FOUND", debug: "Job not found by ID" },
          { status: 404 }
        );
      }

      if (jobOffer.deletedAt) {
        return NextResponse.json(
          { success: false, error: "Job offer not found", code: "NOT_FOUND", debug: "Job was deleted" },
          { status: 404 }
        );
      }

      if (jobOffer.status !== "PUBLISHED") {
        return NextResponse.json(
          { success: false, error: "Job offer not found", code: "NOT_FOUND", debug: "Job is not published, status: " + jobOffer.status },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: jobOffer,
      });
    }

    // For company owners and admins, fetch uncached results
    const jobOffer = await prisma.jobOffer.findUnique({
      where: { id: jobId },
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

    if (!jobOffer || jobOffer.deletedAt) {
      return NextResponse.json(
        { success: false, error: "Job offer not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check access - admins can see all, companies can only see their own
    if (isAdmin) {
      return NextResponse.json({
        success: true,
        data: jobOffer,
      });
    }

    // For companies, check if they own the job
    // If not owned by them, treat as public - can only see PUBLISHED jobs
    const userCompany = await prisma.company.findFirst({
      where: { userId: session.user.id, id: jobOffer.companyId },
    });

    // If company owns this job, show it (regardless of status)
    if (userCompany) {
      return NextResponse.json({
        success: true,
        data: jobOffer,
      });
    }

    // If company doesn't own this job, only show if PUBLISHED
    if (jobOffer.status !== "PUBLISHED") {
      return NextResponse.json(
        { success: false, error: "Job offer not found", code: "NOT_FOUND", debug: "Job is not published" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: jobOffer,
    });
  } catch (error) {
    console.error("Get job offer error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch job offer", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// PUT /api/job-offers/[jobId] - Update job offer (company owner only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { jobId } = await params;
    const body = await request.json();

    const validationResult = updateJobOfferSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Get job offer and verify ownership
    const existingJob = await prisma.jobOffer.findUnique({
      where: { id: jobId },
      include: {
        company: true,
      },
    });

    if (!existingJob || existingJob.deletedAt) {
      return NextResponse.json(
        { success: false, error: "Job offer not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Verify user owns the company or is admin
    const isAdmin = session?.user?.role === "ADMIN";
    
    const userCompany = isAdmin ? null : await prisma.company.findFirst({
      where: { userId: session!.user.id, id: existingJob.companyId },
    });

    if (!isAdmin && !userCompany) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to update this job", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const updateData = validationResult.data;

    // Separate benefitIds and languages from updateData (they're not direct fields)
    const benefitIds = (updateData as Record<string, unknown>).benefitIds as string[] | undefined;
    const languages = (updateData as Record<string, unknown>).languages as { language: string; level: string }[] | undefined;
    
    // Remove benefitIds and languages from direct fields
    delete (updateData as Record<string, unknown>).benefitIds;
    delete (updateData as Record<string, unknown>).languages;

    // Handle status change
    if (updateData.status === "PUBLISHED" && existingJob.status !== "PUBLISHED") {
      (updateData as Record<string, unknown>).publishedAt = new Date();
    }

    // First update the job offer (without benefits/languages relations)
    const jobOffer = await prisma.jobOffer.update({
      where: { id: jobId },
      data: updateData as Record<string, unknown>,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
      },
    });

    // Handle benefits update (only if provided)
    if (benefitIds !== undefined) {
      // Delete existing benefits
      await prisma.jobOfferBenefit.deleteMany({
        where: { jobOfferId: jobId },
      });
      
      // Create new benefits only if array is not empty
      if (benefitIds.length > 0) {
        await prisma.jobOfferBenefit.createMany({
          data: benefitIds.map((benefitId) => ({
            jobOfferId: jobId,
            benefitId,
          })),
        });
      }
    }

    // Handle languages update (only if provided)
    if (languages !== undefined) {
      // Delete existing languages
      await prisma.jobLanguage.deleteMany({
        where: { jobOfferId: jobId },
      });
      
      // Create new languages only if array is not empty
      if (languages.length > 0) {
        await prisma.jobLanguage.createMany({
          data: languages.map((lang) => ({
            jobOfferId: jobId,
            language: lang.language,
            level: lang.level as "REQUIRED" | "PREFERRED" | "NICE_TO_HAVE",
          })),
        });
      }
    }

    // Refetch to get updated relations
    const updatedJobOffer = await prisma.jobOffer.findUnique({
      where: { id: jobId },
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
          include: { benefit: true },
        },
        languages: true,
      },
    });

    // Revalidate job offers cache
    revalidateJobOffers();

    return NextResponse.json({
      success: true,
      message: "Job offer updated successfully",
      data: updatedJobOffer,
    });
  } catch (error) {
    console.error("Update job offer error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: "Failed to update job offer", details: errorMessage, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// DELETE /api/job-offers/[jobId] - Soft delete job offer (company owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { jobId } = await params;

    // Get job offer and verify ownership
    const existingJob = await prisma.jobOffer.findUnique({
      where: { id: jobId },
      include: { company: true },
    });

    if (!existingJob || existingJob.deletedAt) {
      return NextResponse.json(
        { success: false, error: "Job offer not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Verify user owns the company or is admin
    const isAdmin = session?.user?.role === "ADMIN";
    
    const userCompany = isAdmin ? null : await prisma.company.findFirst({
      where: { userId: session!.user.id, id: existingJob.companyId },
    });

    if (!isAdmin && !userCompany) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to delete this job", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Soft delete
    await prisma.jobOffer.update({
      where: { id: jobId },
      data: { deletedAt: new Date() },
    });

    // Revalidate job offers cache
    revalidateJobOffers();

    return NextResponse.json({
      success: true,
      message: "Job offer deleted successfully",
    });
  } catch (error) {
    console.error("Delete job offer error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete job offer", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

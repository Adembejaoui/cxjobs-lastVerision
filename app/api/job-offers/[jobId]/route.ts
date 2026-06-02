import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import  prisma  from "@/lib/prisma";
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

      if (!jobOffer) {
        return NextResponse.json(
          { success: false, error: "Job offer not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }

      if (jobOffer.deletedAt) {
        return NextResponse.json(
          { success: false, error: "Job offer not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }

      if (jobOffer.status !== "PUBLISHED") {
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
    const userCompany = await prisma.companies.findFirst({
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
        { success: false, error: "Job offer not found", code: "NOT_FOUND" },
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

    const updateData = validationResult.data;
    const benefitIds = (updateData as Record<string, unknown>).benefitIds as string[] | undefined;
    const languages = (updateData as Record<string, unknown>).languages as { language: string; level: string }[] | undefined;
    delete (updateData as Record<string, unknown>).benefitIds;
    delete (updateData as Record<string, unknown>).languages;

    if (updateData.status === "PUBLISHED") {
      (updateData as Record<string, unknown>).publishedAt = new Date();
    }

    type TxResult =
      | { kind: "data"; data: Awaited<ReturnType<typeof prisma.jobOffer.findUnique>> }
      | { kind: "not_found" }
      | { kind: "forbidden" };

    let txResult: TxResult;

    txResult = await prisma.$transaction(async (tx) => {
      const existingJob = await tx.jobOffer.findUnique({
        where: { id: jobId },
        include: { company: true },
      });

      if (!existingJob || existingJob.deletedAt) {
        return { kind: "not_found" } as const;
      }

      const isAdmin = session.user.role === "ADMIN";
      const userCompany = isAdmin
        ? null
        : await tx.companies.findFirst({
            where: { userId: session.user.id, id: existingJob.companyId },
          });

      if (!isAdmin && !userCompany) {
        return { kind: "forbidden" } as const;
      }

      const jobOffer = await tx.jobOffer.update({
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

      if (benefitIds !== undefined) {
        await tx.jobOfferBenefit.deleteMany({ where: { jobOfferId: jobId } });
        if (benefitIds.length > 0) {
          await tx.jobOfferBenefit.createMany({
            data: benefitIds.map((benefitId) => ({ jobOfferId: jobId, benefitId })),
          });
        }
      }

      if (languages !== undefined) {
        await tx.jobLanguage.deleteMany({ where: { jobOfferId: jobId } });
        if (languages.length > 0) {
          await tx.jobLanguage.createMany({
            data: languages.map((lang) => ({ jobOfferId: jobId, language: lang.language, level: lang.level as "REQUIRED" | "PREFERRED" | "NICE_TO_HAVE" })),
          });
        }
      }

      return {
        kind: "data",
        data: await tx.jobOffer.findUnique({
          where: { id: jobId },
          include: {
            company: { select: { id: true, name: true, slug: true, logoUrl: true } },
            benefits: { include: { benefit: true } },
            languages: true,
          },
        }),
      };
    });

    if (txResult.kind === "not_found") {
      return NextResponse.json(
        { success: false, error: "Job offer not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (txResult.kind === "forbidden") {
      return NextResponse.json(
        { success: false, error: "You don't have permission to update this job", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    revalidateJobOffers();

    return NextResponse.json({
      success: true,
      message: "Job offer updated successfully",
      data: txResult.data,
    });
  } catch (error) {
    console.error("Update job offer error:", error);
    const errorMessage = process.env.NODE_ENV === "production"
      ? "Failed to update job offer"
      : error instanceof Error
        ? error.message
        : "Failed to update job offer";
    return NextResponse.json(
      { success: false, error: errorMessage, code: "INTERNAL_ERROR" },
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
    
    const userCompany = isAdmin ? null : await prisma.companies.findFirst({
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

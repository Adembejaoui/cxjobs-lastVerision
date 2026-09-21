import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import  prisma  from "@/lib/prisma";
import { updateJobOfferSchema, isValidStatusTransition, getInvalidTransitionError } from "@/lib/validations/job";
import { unstable_cache } from "next/cache";
import { revalidateJobOffers } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";

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
    const ip = getClientIp(request);
    const GET_SINGLE_LIMIT = { windowMs: 60_000, max: 120 };
    const rl = await checkRateLimitAsync(`job-offer-single:${ip}`, GET_SINGLE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

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
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        },
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
    logger.error("Get job offer error", { error });
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

    const UPDATE_LIMIT = { windowMs: 60_000, max: 20 };
    const rl = await checkRateLimitAsync(`job-offer-update:${session.user.id}`, UPDATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const { jobId } = await params;
    const body = await request.json();

    const validationResult = updateJobOfferSchema.safeParse(body);

    if (!validationResult.success) {
      logger.error("PUT /api/job-offers/[jobId] validation failed", {
        jobId,
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

    const updateData = validationResult.data;
    const benefitIds = (updateData as Record<string, unknown>).benefitIds as string[] | undefined;
    const languages = (updateData as Record<string, unknown>).languages as { language: string; level: string }[] | undefined;
    delete (updateData as Record<string, unknown>).benefitIds;
    delete (updateData as Record<string, unknown>).languages;

    const now = new Date();

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

    if (updateData.status !== undefined && updateData.status !== existingJob.status) {
      const currentStatus = existingJob.status;
      const newStatus = updateData.status as string;

      if (!isValidStatusTransition(currentStatus, newStatus)) {
        return NextResponse.json(
          {
            success: false,
            error: getInvalidTransitionError(currentStatus, newStatus),
            code: "INVALID_TRANSITION",
          },
          { status: 400 }
        );
      }

      if (newStatus === "PUBLISHED") {
        (updateData as Record<string, unknown>).publishedAt = now;
        if (!updateData.expiresAt) {
          const oneMonthFromNow = new Date(now);
          oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
          (updateData as Record<string, unknown>).expiresAt = oneMonthFromNow;
        }
      }

      if (newStatus === "CLOSED") {
        (updateData as Record<string, unknown>).closedAt = now;
      }

      if (newStatus === "DRAFT" && currentStatus === "ARCHIVED") {
        (updateData as Record<string, unknown>).closedAt = null;
        (updateData as Record<string, unknown>).publishedAt = null;
      }
    }

    type TxResult =
      | { kind: "data"; data: unknown }
      | { kind: "not_found" }
      | { kind: "forbidden" };

    const txResult: TxResult = await prisma.$transaction(async (tx): Promise<TxResult> => {
      const isAdmin = session.user.role === "ADMIN";
      const userCompany = isAdmin
        ? null
        : await tx.companies.findFirst({
            where: { userId: session.user.id, id: existingJob.companyId },
          });

      if (!isAdmin && !userCompany) {
        return { kind: "forbidden" } as const;
      }

      await tx.jobOffer.update({
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
    logger.error("Update job offer error", { error });
    return NextResponse.json(
      { success: false, error: "Failed to update job offer", code: "INTERNAL_ERROR" },
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

    const DELETE_LIMIT = { windowMs: 60_000, max: 10 };
    const rl = await checkRateLimitAsync(`job-offer-delete:${session.user.id}`, DELETE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
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
    logger.error("Delete job offer error", { error });
    return NextResponse.json(
      { success: false, error: "Failed to delete job offer", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

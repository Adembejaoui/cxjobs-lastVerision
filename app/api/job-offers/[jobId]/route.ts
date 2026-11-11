import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import  prisma  from "@/lib/prisma";
import { BenefitScope } from "@/app/generated/prisma/client";
import {
  updateJobOfferSchema,
  isValidStatusTransition,
  getInvalidTransitionError,
  validateEffectiveJobState,
  mergeJobState,
  type EffectiveJobState,
} from "@/lib/validations/job";
import { unstable_cache } from "next/cache";
import { revalidateJobOffers } from "@/lib/cache";
import { invalidateCompanyAnalytics } from "@/lib/local-cache";
import { logger } from "@/lib/logger";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";
import { validateBenefitOwnership, stripCompanyProtectedJobFields } from "@/lib/security/benefits";
import { publicJobWhere, isCompanyActive, COMPANY_ACTIVITY_SELECT } from "@/lib/security/company-activity";
import { companySuspendedResponse } from "@/lib/server/company-guard";

// Cached function for fetching a single published job offer
// F-04: only publicly visible jobs (published, not deleted, not expired,
// active company). Anything else is "not found" for the public.
const getPublicJobOffer = unstable_cache(
  async (jobId: string) => {
    return prisma.jobOffer.findFirst({
      where: { id: jobId, ...publicJobWhere() },
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
              where: { scope: BenefitScope.CORE },
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
    // Public read: fail open on limiter outage (NF-10).
    const GET_SINGLE_LIMIT = { windowMs: 60_000, max: 120, failOpen: true };
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
              where: { scope: BenefitScope.CORE },
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
      select: { id: true },
    });

    // If company owns this job, show it (regardless of status)
    if (userCompany) {
      return NextResponse.json({
        success: true,
        data: jobOffer,
      });
    }

    // If company doesn't own this job, apply the public visibility rules
    // (published, not expired, active company: F-04), read from the DB.
    const publiclyVisible =
      jobOffer.status === "PUBLISHED" &&
      (await prisma.jobOffer.count({ where: { id: jobId, ...publicJobWhere() } })) > 0;
    if (!publiclyVisible) {
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

    // Protected columns (promotion flags, lifecycle timestamps) are never
    // client-assignable by a company; lifecycle timestamps are derived from
    // status transitions below.
    const updateData =
      session.user.role === "ADMIN"
        ? validationResult.data
        : stripCompanyProtectedJobFields(validationResult.data as Record<string, unknown>) as typeof validationResult.data;
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

    // Cross-field rules apply to the job as it will be AFTER this partial
    // update (stored row + payload), so e.g. a status-only change can never
    // invalidate an EXTERNAL job and a lone salaryMax cannot undercut the
    // stored salaryMin.
    const effectiveErrors = validateEffectiveJobState(
      mergeJobState(existingJob, updateData as EffectiveJobState)
    );
    if (effectiveErrors) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: effectiveErrors },
        { status: 400 }
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
      | { kind: "forbidden" }
      | { kind: "suspended" }
      | { kind: "invalid_benefits" };

    const txResult: TxResult = await prisma.$transaction(async (tx): Promise<TxResult> => {
      const isAdmin = session.user.role === "ADMIN";
      const userCompany = isAdmin
        ? null
        : await tx.companies.findFirst({
            where: { userId: session.user.id, id: existingJob.companyId },
            select: { id: true, ...COMPANY_ACTIVITY_SELECT },
          });

      if (!isAdmin && !userCompany) {
        return { kind: "forbidden" } as const;
      }

      // F-04: a suspended company cannot edit or (re)publish its jobs. Read
      // inside the transaction, together with the ownership check.
      if (!isAdmin && !isCompanyActive(userCompany)) {
        return { kind: "suspended" } as const;
      }

      // Benefits must belong to the company that OWNS THE JOB (also when an
      // admin edits it). Validated inside the transaction, before any write,
      // so check and use cannot diverge.
      let validatedBenefitIds: string[] | undefined;
      if (benefitIds !== undefined) {
        const check = await validateBenefitOwnership(tx, existingJob.companyId, benefitIds);
        if (!check.ok) {
          return { kind: "invalid_benefits" } as const;
        }
        validatedBenefitIds = check.benefitIds;
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

      if (validatedBenefitIds !== undefined) {
        await tx.jobOfferBenefit.deleteMany({ where: { jobOfferId: jobId } });
        if (validatedBenefitIds.length > 0) {
          await tx.jobOfferBenefit.createMany({
            data: validatedBenefitIds.map((benefitId) => ({ jobOfferId: jobId, benefitId })),
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

    if (txResult.kind === "invalid_benefits") {
      return NextResponse.json(
        { success: false, error: "One or more benefits are invalid or do not belong to this company", code: "INVALID_BENEFITS" },
        { status: 400 }
      );
    }

    if (txResult.kind === "suspended") {
      return companySuspendedResponse();
    }

    if (txResult.kind === "forbidden") {
      return NextResponse.json(
        { success: false, error: "You don't have permission to update this job", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    revalidateJobOffers();

    // One increment covers the whole mutation (fields + status + languages).
    // existingJob.companyId comes from the database, so an admin editing
    // another company's job invalidates that company's analytics, never the
    // admin's own. Swallows Redis errors, so it cannot fail the update.
    await invalidateCompanyAnalytics(existingJob.companyId);

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
      select: { id: true },
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

    // The soft delete is committed. existingJob.companyId is DB-resolved, so
    // this targets the owning company even when an admin performs the delete.
    await invalidateCompanyAnalytics(existingJob.companyId);

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

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";
import { updateJobOfferSchema, isValidStatusTransition, getInvalidTransitionError } from "@/lib/validations/job";
import { revalidateJobOffers } from "@/lib/cache";
import { invalidateCompanyAnalytics } from "@/lib/local-cache";
import { logger } from "@/lib/logger";

const ALLOWED_FIELDS = [
  "title",
  "description",
  "status",
  "contractType",
  "employmentType",
  "isRemote",
  "isHybrid",
  "customLocation",
  "salaryMin",
  "salaryMax",
  "salaryCurrency",
  "activityType",
  "activityCustom",
  "requirements",
  "technicalTools",
  "softSkills",
  "featured",
  "highlight",
  "publishedAt",
  "closedAt",
  "expiresAt",
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Job ID is required", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

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

    // Strip benefit/language fields entirely — the admin editor does not
    // modify benefits or languages. They are not part of the allow-list and
    // must never trigger a deleteMany/createMany sync.
    delete (updateData as Record<string, unknown>).benefitIds;
    delete (updateData as Record<string, unknown>).languages;

    const filteredUpdateData: Record<string, unknown> = {};
    for (const key of Object.keys(updateData)) {
      if (ALLOWED_FIELDS.includes(key as (typeof ALLOWED_FIELDS)[number])) {
        filteredUpdateData[key] = (updateData as Record<string, unknown>)[key];
      }
    }

    if (Object.keys(filteredUpdateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "No allowed fields to update", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    const existingJob = await prisma.jobOffer.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        status: true,
        deletedAt: true,
        slug: true,
      },
    });

    if (!existingJob || existingJob.deletedAt) {
      return NextResponse.json(
        { success: false, error: "Job offer not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (filteredUpdateData.status !== undefined && filteredUpdateData.status !== existingJob.status) {
      const currentStatus = existingJob.status;
      const newStatus = filteredUpdateData.status as string;

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

      const now = new Date();

      if (newStatus === "PUBLISHED") {
        filteredUpdateData.publishedAt = now;
        if (!filteredUpdateData.expiresAt) {
          const oneMonthFromNow = new Date(now);
          oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
          filteredUpdateData.expiresAt = oneMonthFromNow;
        }
      }

      if (newStatus === "CLOSED") {
        filteredUpdateData.closedAt = now;
      }

      if (newStatus === "DRAFT" && currentStatus === "ARCHIVED") {
        filteredUpdateData.closedAt = null;
        filteredUpdateData.publishedAt = null;
      }
    }

    const txResult = await prisma.$transaction(async (tx) => {
      await tx.jobOffer.update({
        where: { id },
        data: filteredUpdateData,
      });

      return await tx.jobOffer.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          status: true,
          companyId: true,
          slug: true,
          contractType: true,
          employmentType: true,
          isRemote: true,
          isHybrid: true,
          customLocation: true,
          salaryMin: true,
          salaryMax: true,
          salaryCurrency: true,
          activityType: true,
          activityCustom: true,
          featured: true,
          highlight: true,
          publishedAt: true,
          closedAt: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    if (!txResult) {
      return NextResponse.json(
        { success: false, error: "Job offer not found after update", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    revalidateJobOffers();
    await invalidateCompanyAnalytics(existingJob.companyId);

    return NextResponse.json({
      success: true,
      message: "Job offer updated successfully",
      data: txResult,
    });
  } catch (error) {
    logger.error("Failed to update admin job offer", { error });
    return NextResponse.json(
      { success: false, error: "Failed to update job offer", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
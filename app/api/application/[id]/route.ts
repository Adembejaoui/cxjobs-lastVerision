import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import  prisma  from "@/lib/prisma";
import { updateApplicationSchema } from "@/lib/validations/job";
import { logger } from "@/lib/logger";
import { COMPANY_ACTIVITY_SELECT, isCompanyActive } from "@/lib/security/company-activity";
import { companySuspendedResponse } from "@/lib/server/company-guard";
import { CANDIDATE_APPLICATION_SCALARS, stripRecruiterOnlyFields } from "@/lib/security/application-fields";
import { canTransitionApplication, statusOptionsFrom, APPLICATION_STATUS_LABELS, isApplicationStatus } from "@/lib/application-status";
import { notifyApplicationStatusChange } from "@/lib/server/notifications";
import { invalidateCompanyAnalytics } from "@/lib/local-cache";

class StatusConflictError extends Error {}

function statusLabel(status: string): string {
  return isApplicationStatus(status) ? APPLICATION_STATUS_LABELS[status] : status;
}

// GET /api/application/[id] - Get single application
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (session.user.role === "CANDIDATE") {
      // Resolve candidate ID for ownership enforcement
      const candidate = await prisma.candidate.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!candidate) {
        return NextResponse.json(
          { success: false, error: "Candidate profile not found", code: "PROFILE_NOT_FOUND" },
          { status: 404 }
        );
      }

      // Enforce ownership at query level + narrow candidate relations.
      // Candidates viewing their own application do not need their full
      // skills, experiences, languages, or education.
      const application = await prisma.application.findFirst({
        where: {
          id,
          candidateId: candidate.id,
        },
        // Explicit allow-list: recruiter `notes` are never selected for a
        // candidate (an `include` would return every scalar column).
        select: {
          ...CANDIDATE_APPLICATION_SCALARS,
          candidate: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          jobOffer: {
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  logoUrl: true,
                  location: true,
                },
              },
            },
          },
        },
      });

      if (!application) {
        return NextResponse.json(
          { success: false, error: "Application not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: stripRecruiterOnlyFields(application),
      });
    }

    // Only the owning company and administrators may see the full record
    // (including recruiter notes). Any other role is denied outright.
    if (session.user.role !== "COMPANY" && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // COMPANY / ADMIN: full query with all candidate relations
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        candidate: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
            skills: true,
            experiences: { orderBy: { startDate: "desc" } },
            languages: true,
            education: { orderBy: { startDate: "desc" } },
          },
        },
        jobOffer: {
          include: {
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                location: true,
              },
            },
          },
        },
      },
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check access rights for COMPANY role
    if (session.user.role === "COMPANY") {
      const company = await prisma.companies.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!company || application.jobOffer?.companyId !== company.id) {
        return NextResponse.json(
          { success: false, error: "Access denied", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: application,
    });
  } catch (error) {
    logger.error("Failed to fetch application", { error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch application", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// PUT /api/application/[id] - Update application status (company only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    if (session.user.role !== "COMPANY") {
      return NextResponse.json(
        { success: false, error: "Only companies can update application status", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const validationResult = updateApplicationSchema.safeParse(body);

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

    const { status, notes, isSaved } = validationResult.data;

    // Get application and verify ownership
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        jobOffer: {
          include: { company: true },
        },
      },
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Verify user owns the company
    const userCompany = await prisma.companies.findFirst({
      where: { userId: session.user.id, id: application.jobOffer.companyId },
      select: { id: true, ...COMPANY_ACTIVITY_SELECT },
    });

    if (!userCompany) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to update this application", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // F-04: a suspended company cannot process applications (read access to
    // its history is unaffected).
    if (!isCompanyActive(userCompany)) {
      return companySuspendedResponse();
    }

    // A7: status changes follow the documented workflow (e.g. never
    // Rejected → Hired), are recorded in the history, notify the candidate
    // and refresh the company's analytics.
    const statusChanges = status !== undefined && status !== application.status;
    if (statusChanges && !canTransitionApplication(application.status, status)) {
      return NextResponse.json(
        {
          success: false,
          error: `An application cannot move from "${statusLabel(application.status)}" to "${statusLabel(status)}".`,
          code: "INVALID_STATUS_TRANSITION",
          details: { from: application.status, allowed: statusOptionsFrom(application.status) },
        },
        { status: 409 }
      );
    }

    const updatedApplication = await prisma.$transaction(async (tx) => {
      if (statusChanges) {
        // Optimistic concurrency: only applies if nobody changed the status
        // since it was read; a concurrent recruiter update gets a 409.
        const moved = await tx.application.updateMany({
          where: { id, status: application.status },
          data: { status },
        });
        if (moved.count === 0) throw new StatusConflictError();
        await tx.applicationStatusHistory.create({
          data: { applicationId: id, fromStatus: application.status, toStatus: status, changedById: session.user.id },
        });
        const candidate = await tx.candidate.findUnique({
          where: { id: application.candidateId },
          select: { userId: true },
        });
        if (candidate) {
          await notifyApplicationStatusChange(tx, {
            candidateUserId: candidate.userId,
            jobTitle: application.jobOffer.title,
            status,
          });
        }
      }

      return tx.application.update({
        where: { id },
        data: {
          ...(notes !== undefined && { notes }),
          ...(isSaved !== undefined && { isSaved }),
        },
        include: {
          candidate: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          jobOffer: {
            select: {
              id: true,
              title: true,
              company: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });
    }).catch((error: unknown) => {
      if (error instanceof StatusConflictError) return null;
      throw error;
    });

    if (!updatedApplication) {
      return NextResponse.json(
        {
          success: false,
          error: "This application was updated by someone else. Reload to see its current status.",
          code: "CONFLICT",
        },
        { status: 409 }
      );
    }

    if (statusChanges) {
      // Status counts feed the company analytics (A7: update at once).
      await invalidateCompanyAnalytics(application.jobOffer.companyId);
    }

    return NextResponse.json({
      success: true,
      message: "Application updated successfully",
      data: updatedApplication,
    });
  } catch (error) {
    logger.error("Failed to update application", { error });
    return NextResponse.json(
      { success: false, error: "Failed to update application", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

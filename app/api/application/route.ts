import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { createApplicationSchema, applicationStatusSchema } from "@/lib/validations/job";
import { parsePaginationParams } from "@/lib/utils";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/utils";
import { invalidateCompanyAnalytics } from "@/lib/local-cache";
import { COMPANY_ACTIVITY_SELECT, isCompanyActive, type CompanyActivityState } from "@/lib/security/company-activity";
import { candidateCompleteness } from "@/lib/candidate-profile-completeness";
import { notifyNewApplication } from "@/lib/server/notifications";

const APPLICATION_LIMIT = { windowMs: 60_000, max: 10 };

type JobAvailability = {
  deletedAt: Date | null;
  status: string;
  expiresAt: Date | null;
  applicationType: string;
  company: CompanyActivityState | null;
};

/** What `rejectionFor` needs, read from the DB at the time of the request. */
const JOB_AVAILABILITY_SELECT = {
  companyId: true,
  deletedAt: true,
  status: true,
  expiresAt: true,
  applicationType: true,
  company: { select: COMPANY_ACTIVITY_SELECT },
} as const;

/**
 * Server-side gate for internal applications. The UI redirects EXTERNAL jobs
 * to their external URL, but the API must not rely on that: EXTERNAL jobs,
 * expired jobs (before the expiry job flips their status) and unpublished or
 * deleted jobs never accept an internal application.
 */
function rejectionFor(job: JobAvailability | null, now: Date): "NOT_FOUND" | "EXTERNAL_APPLICATION" | null {
  if (!job || job.deletedAt || job.status !== "PUBLISHED") return "NOT_FOUND";
  if (job.expiresAt && job.expiresAt <= now) return "NOT_FOUND";
  // F-04: a suspended or deleted company receives no new applications. The
  // generic NOT_FOUND does not reveal the suspension.
  if (!isCompanyActive(job.company)) return "NOT_FOUND";
  if (job.applicationType === "EXTERNAL") return "EXTERNAL_APPLICATION";
  return null;
}

function rejectionResponse(reason: "NOT_FOUND" | "EXTERNAL_APPLICATION") {
  return reason === "EXTERNAL_APPLICATION"
    ? NextResponse.json(
        { success: false, error: "This job accepts applications on the employer's website only", code: "EXTERNAL_APPLICATION" },
        { status: 400 }
      )
    : NextResponse.json(
        { success: false, error: "Job offer not found or no longer available", code: "NOT_FOUND" },
        { status: 404 }
      );
}

// GET /api/application - List applications (role-filtered)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rawStatus = searchParams.get("status");
    const jobId = searchParams.get("jobId");

    // Enum and UUID filters are validated here: an arbitrary string reaching
    // Prisma raises a validation error that used to surface as a 500.
    const statusResult = rawStatus ? applicationStatusSchema.safeParse(rawStatus) : null;
    if (statusResult && !statusResult.success) {
      return NextResponse.json(
        { success: false, error: "Invalid status parameter", code: "INVALID_PARAM" },
        { status: 400 }
      );
    }
    const status = statusResult?.data;
    if (jobId && !z.string().uuid().safeParse(jobId).success) {
      return NextResponse.json(
        { success: false, error: "Invalid jobId parameter", code: "INVALID_PARAM" },
        { status: 400 }
      );
    }
    // The total row count is opt-in. The candidate applications client and the
    // job detail "already applied" check both read only `data`, and the client
    // derives page counts from the server-rendered `initialTotal`. Running the
    // COUNT unconditionally also held a second pooled connection open in
    // parallel with the list query, doubling this route's concurrent demand
    // against the shared pool.
    const withCount = searchParams.get("withCount") === "1";

    // Use safe pagination with enforced limits
    const { page, limit, skip } = parsePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    );

    if (session.user.role === "CANDIDATE") {
      // Get candidate's applications
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

      const where: Record<string, unknown> = { candidateId: candidate.id };
      if (status) {
        where.status = status;
      }
      if (jobId) {
        where.jobOfferId = jobId;
      }

      const [applications, total] = await Promise.all([
        prisma.application.findMany({
          where,
          select: {
            id: true,
            status: true,
            createdAt: true,
            jobOffer: {
              select: {
                id: true,
                title: true,
                slug: true,
                customLocation: true,
                isRemote: true,
                isHybrid: true,
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
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        withCount ? prisma.application.count({ where }) : Promise.resolve(null),
      ]);

      return NextResponse.json({
        success: true,
        data: applications,
        pagination: {
          page,
          limit,
          total,
          totalPages: total === null ? null : Math.ceil(total / limit),
        },
      });
    } else if (session.user.role === "COMPANY") {
      // Get company's job applications
      const company = await prisma.companies.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!company) {
        return NextResponse.json(
          { success: false, error: "Company profile not found", code: "PROFILE_NOT_FOUND" },
          { status: 404 }
        );
      }

      const where: Record<string, unknown> = {
        jobOffer: { companyId: company.id },
      };
      if (status) {
        where.status = status;
      }
      if (jobId) {
        where.jobOfferId = jobId;
      }

      const [applications, total] = await Promise.all([
        prisma.application.findMany({
          where,
          include: {
            jobOffer: {
              select: {
                id: true,
                title: true,
                customLocation: true,
                contractType: true,
                employmentType: true,
              },
            },
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
                skills: { take: 5 },
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.application.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: applications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid role", code: "INVALID_ROLE" },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error("Get applications error", { error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch applications", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/application - Submit application (candidate only)
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await checkRateLimitAsync(`application:${ip}`, APPLICATION_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    if (session.user.role !== "CANDIDATE") {
      return NextResponse.json(
        { success: false, error: "Only candidates can submit applications", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Get candidate profile
    const candidate = await prisma.candidate.findUnique({
      where: { userId: session.user.id },
      include: { _count: { select: { skills: true, languages: true, experiences: true } } },
    });

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: "Please complete your profile first", code: "PROFILE_NOT_FOUND" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validationResult = createApplicationSchema.safeParse(body);

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

    const { jobOfferId, coverLetter } = validationResult.data;

    // Check if job offer exists, is published and its company is active
    const jobOffer = await prisma.jobOffer.findUnique({
      where: { id: jobOfferId },
      select: JOB_AVAILABILITY_SELECT,
    });

    const preCheck = rejectionFor(jobOffer, new Date());
    if (preCheck || !jobOffer) {
      return rejectionResponse(preCheck ?? "NOT_FOUND");
    }

    // Check for duplicate application
    const existingApplication = await prisma.application.findUnique({
      where: {
        candidateId_jobOfferId: {
          candidateId: candidate.id,
          jobOfferId,
        },
      },
    });

    if (existingApplication) {
      return NextResponse.json(
        { success: false, error: "You have already applied to this job", code: "DUPLICATE_APPLICATION" },
        { status: 409 }
      );
    }

    // A1: the completed-profile requirement is enforced here, not only in
    // the apply page (which shows the same rule). Checked after the job and
    // duplicate checks so "job gone" / "already applied" take precedence.
    const completeness = candidateCompleteness({
      ...candidate,
      skillsCount: candidate._count.skills,
      languagesCount: candidate._count.languages,
      experiencesCount: candidate._count.experiences,
    });
    if (!completeness.canApply) {
      return NextResponse.json(
        {
          success: false,
          error: "Please complete your profile before applying",
          code: "PROFILE_INCOMPLETE",
          details: { missingRequired: completeness.missingRequired, percent: completeness.percent },
        },
        { status: 400 }
      );
    }

    // Submit atomically inside a transaction to prevent race conditions.
    // The unique constraint on [candidateId, jobOfferId] is the final guard;
    // P2002 is handled as an idempotent duplicate response.
    let application;
    try {
      application = await prisma.$transaction(async (tx) => {
        // Re-validate job availability (incl. company activity) inside the
        // transaction, immediately before the insert.
        const job = await tx.jobOffer.findUnique({
          where: { id: jobOfferId },
          select: JOB_AVAILABILITY_SELECT,
        });
        const reason = rejectionFor(job, new Date());
        if (reason) {
          throw new Error(reason === "EXTERNAL_APPLICATION" ? "JOB_EXTERNAL" : "JOB_NOT_AVAILABLE");
        }

        const created = await tx.application.create({
          data: {
            candidateId: candidate.id,
            jobOfferId,
            coverLetter: coverLetter || "",
            cvUrl: candidate.resumeUrl,
            status: "NOUVEAU",
          },
          include: {
            jobOffer: {
              select: {
                id: true,
                title: true,
                company: {
                  select: {
                    id: true,
                    name: true,
                    userId: true,
                  },
                },
              },
            },
          },
        });

        // A7: the history starts with the submission, and the company is
        // notified in the same transaction.
        await tx.applicationStatusHistory.create({
          data: { applicationId: created.id, fromStatus: null, toStatus: "NOUVEAU", changedById: session.user.id },
        });
        if (created.jobOffer.company?.userId) {
          await notifyNewApplication(tx, {
            companyUserId: created.jobOffer.company.userId,
            jobOfferId,
            jobTitle: created.jobOffer.title,
          });
        }

        // The owner's user id is internal; it is not part of the response.
        const { userId: _ownerId, ...company } = created.jobOffer.company;
        void _ownerId;
        return { ...created, jobOffer: { ...created.jobOffer, company } };
      });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === "P2002") {
        return NextResponse.json(
          { success: false, error: "You have already applied to this job", code: "DUPLICATE_APPLICATION" },
          { status: 409 }
        );
      }
      if (err.message === "JOB_NOT_AVAILABLE") {
        return rejectionResponse("NOT_FOUND");
      }
      if (err.message === "JOB_EXTERNAL") {
        return rejectionResponse("EXTERNAL_APPLICATION");
      }
      throw e;
    }

    // The application is committed. jobOffer.companyId is the owning company
    // resolved from the database above, never taken from request data, and no
    // cross-company lookup is performed. Swallows Redis errors.
    await invalidateCompanyAnalytics(jobOffer.companyId);

    return NextResponse.json(
      {
        success: true,
        message: "Application submitted successfully",
        data: application,
      },
      { status: 201 }
    );
  } catch (error) {
     logger.error("Create application error", { error });
    return NextResponse.json(
      { success: false, error: "Failed to submit application", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

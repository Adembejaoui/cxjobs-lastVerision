import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import  prisma  from "@/lib/prisma";
import { parsePaginationParams } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { Prisma, type ApplicationStatus } from "@/app/generated/prisma/client";

/**
 * Server-side allow-list for the `status` query parameter.
 *
 * An unknown value is ignored rather than forwarded, so a malformed query
 * string can never reach Prisma as an invalid enum and surface as a 500.
 */
const ALLOWED_STATUSES = [
  "NOUVEAU",
  "EN_COURS_EXAMEN",
  "ENTRETIEN",
  "EMBAUCHES",
  "REFUSE",
] as const satisfies readonly ApplicationStatus[];

const MAX_SEARCH_LENGTH = 100;

/**
 * Prisma `contains` compiles to LIKE/ILIKE, where `%` and `_` are wildcards.
 * The list UI filters with `String.includes`, where they are ordinary
 * characters, so they are escaped here to keep both paths equivalent and to
 * stop user input from widening the match. The backslash is escaped first so
 * that an escaped wildcard is not re-escaped.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function parseStatus(raw: string | null): ApplicationStatus | undefined {
  if (!raw) return undefined;
  const candidate = raw.toUpperCase();
  return (ALLOWED_STATUSES as readonly string[]).includes(candidate)
    ? (candidate as ApplicationStatus)
    : undefined;
}

function parseIsSaved(raw: string | null): boolean | undefined {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return undefined;
}

function parseSearch(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().slice(0, MAX_SEARCH_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

// GET /api/job-offers/[jobId]/applications - Get applications for a job (company owner only)
export async function GET(
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

    const APPLICATIONS_LIMIT = { windowMs: 60_000, max: 30 };
    const rl = await checkRateLimitAsync(`job-applications:${session.user.id}`, APPLICATIONS_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const { jobId } = await params;
    const { searchParams } = new URL(request.url);
    const status = parseStatus(searchParams.get("status"));
    const isSaved = parseIsSaved(searchParams.get("isSaved"));
    const search = parseSearch(searchParams.get("search"));
    
    // Use safe pagination with enforced limits
    const { page, limit, skip } = parsePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    );

    // Get job offer and verify ownership (only fields needed for the checks)
    const jobOffer = await prisma.jobOffer.findUnique({
      where: { id: jobId },
      select: { id: true, companyId: true, deletedAt: true },
    });

    if (!jobOffer || jobOffer.deletedAt) {
      return NextResponse.json(
        { success: false, error: "Job offer not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Verify user owns the company (companies.userId is unique)
    const userCompany = await prisma.companies.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!userCompany || userCompany.id !== jobOffer.companyId) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to view these applications", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Build where clause.
    // `jobOfferId` is fixed to the authorized job and is never replaced by a
    // filter; every other condition is ANDed onto it, so search / status /
    // isSaved can only narrow the result set, never widen the job scope.
    // The exact same object is used by findMany and count so the reported
    // total always matches the returned rows.
    const where: Prisma.ApplicationWhereInput = {
      jobOfferId: jobId,
      ...(status !== undefined && { status }),
      ...(isSaved !== undefined && { isSaved }),
      ...(search !== undefined && {
        candidate: {
          is: {
            user: {
              is: {
                OR: [
                  { name: { contains: escapeLikePattern(search), mode: "insensitive" } },
                  { email: { contains: escapeLikePattern(search), mode: "insensitive" } },
                ],
              },
            },
          },
        },
      }),
    };

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        select: {
          id: true,
          status: true,
          isSaved: true,
          createdAt: true,
          candidate: {
            select: {
              id: true,
              avatarUrl: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
              skills: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
  } catch (error) {
    logger.error("Failed to fetch applications", { error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch applications", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

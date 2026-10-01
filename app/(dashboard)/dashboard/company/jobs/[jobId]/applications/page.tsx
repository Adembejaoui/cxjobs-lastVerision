import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma, type ApplicationStatus } from "@/app/generated/prisma/client";
import {
  JobApplicationsClient,
  type ApplicationFilter,
  type ApplicationsSearchParams,
} from "./job-applications-client";

/**
 * Pagination defaults.
 *
 * Declared here rather than imported from the client module: a runtime value
 * imported from a "use client" file becomes a client reference in a Server
 * Component, not the literal number.
 */
const PAGE_SIZE = 25;
const MAX_SEARCH_LENGTH = 100;

/**
 * Server-side allow-lists.
 *
 * These are intentionally duplicated instead of imported from the client
 * module: the values below come from an untrusted query string, so the set of
 * accepted values must be defined by the server, not by the client bundle.
 *
 * `SAVED` is not an ApplicationStatus — it is a UI sentinel that maps to
 * `isSaved = true` with no status constraint.
 */
const ALLOWED_STATUSES = [
  "NOUVEAU",
  "EN_COURS_EXAMEN",
  "ENTRETIEN",
  "EMBAUCHES",
  "REFUSE",
] as const satisfies readonly ApplicationStatus[];

/**
 * Explicit narrow selection, shared by the SSR page and the list API so page 1
 * and every later page return the exact same row shape. Cover letter, CV and
 * notes are deliberately excluded: they stay lazy-detail data served by
 * GET /api/application/[id].
 */
const APPLICATION_LIST_SELECT = {
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
} as const satisfies Prisma.ApplicationSelect;

/**
 * Deterministic ordering, identical to the list API. The `id` tiebreaker keeps
 * rows with an identical `createdAt` in a stable position across the SSR/API
 * boundary and across page transitions.
 */
const APPLICATION_ORDER_BY: Prisma.ApplicationOrderByWithRelationInput[] = [
  { createdAt: "desc" },
  { id: "desc" },
];

function readParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw : undefined;
}

function parsePage(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

/**
 * Duplicated from the list API on purpose: both call sites build their own
 * `where` from untrusted input, and the escape rule must stay identical in
 * each so the SSR page and the API page agree on what a search term matches.
 *
 * `String.includes` in the list UI treats `%` and `_` as ordinary characters,
 * so they are escaped here rather than being allowed to act as wildcards.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function parseSearch(raw: string | undefined): string {
  if (!raw) return "";
  return raw.trim().slice(0, MAX_SEARCH_LENGTH);
}

/**
 * Resolves the single dropdown value the UI shows.
 *
 * The dropdown is mutually exclusive by design, so `isSaved` and `status`
 * never combine: a saved selection wins and the status is dropped.
 */
function parseFilter(status: string | undefined, isSaved: string | undefined): ApplicationFilter {
  if (isSaved === "true") return "SAVED";
  if (!status) return "ALL";

  const candidate = status.toUpperCase();
  if (candidate === "SAVED") return "SAVED";

  return (ALLOWED_STATUSES as readonly string[]).includes(candidate)
    ? (candidate as ApplicationFilter)
    : "ALL";
}

export default async function JobApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<ApplicationsSearchParams>;
}) {
  const session = await auth();

  if (!session || session.user.role !== "COMPANY") {
    redirect("/login");
  }

  const { jobId } = await params;

  const [company, jobOffer] = await Promise.all([
    prisma.companies.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    }),
    prisma.jobOffer.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        customLocation: true,
        companyId: true,
        deletedAt: true,
      },
    }),
  ]);

  if (!company || !jobOffer || jobOffer.deletedAt || jobOffer.companyId !== company.id) {
    redirect("/dashboard/company/jobs");
  }

  const sp = await searchParams;

  const requestedPage = parsePage(readParam(sp.page));
  const search = parseSearch(readParam(sp.search));
  const filter = parseFilter(readParam(sp.status), readParam(sp.isSaved));

  // Data scope is pinned to the authorized job. The untrusted query string can
  // only narrow it, never replace jobOfferId.
  const where: Prisma.ApplicationWhereInput = {
    jobOfferId: jobId,
    ...(filter === "SAVED"
      ? { isSaved: true }
      : filter !== "ALL"
        ? { status: filter satisfies ApplicationStatus }
        : {}),
    ...(search !== "" && {
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

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [applications, total, unfilteredTotal, recentApplications, statusCounts] =
    await Promise.all([
      prisma.application.findMany({
        where,
        select: APPLICATION_LIST_SELECT,
        orderBy: APPLICATION_ORDER_BY,
        skip: (requestedPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      // Same `where` object as findMany, so the reported total always matches
      // the rows that were actually returned.
      prisma.application.count({ where }),
      // Stats are job-scoped, unfiltered, SSR aggregates by design.
      prisma.application.count({ where: { jobOfferId: jobId } }),
      prisma.application.count({
        where: { jobOfferId: jobId, createdAt: { gte: weekAgo } },
      }),
      prisma.application.groupBy({
        by: ["status"],
        where: { jobOfferId: jobId },
        _count: true,
      }),
    ]);

  const byStatus = (status: string) =>
    statusCounts.find((s: { status: string; _count: number }) => s.status === status)?._count ?? 0;

  const stats = {
    total: unfilteredTotal,
    new: byStatus("NOUVEAU"),
    inReview: byStatus("EN_COURS_EXAMEN"),
    interview: byStatus("ENTRETIEN"),
    hired: byStatus("EMBAUCHES"),
    rejected: byStatus("REFUSE"),
    recent: recentApplications,
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  // Never render an empty page: an out-of-range request is clamped to the last
  // populated page (page 1 when there are no rows at all).
  const currentPage = Math.min(requestedPage, Math.max(totalPages, 1));

  // Re-query only when the requested page was out of range, so the rendered
  // rows and the pagination metadata always describe the same page.
  const pageApplications =
    currentPage === requestedPage
      ? applications
      : await prisma.application.findMany({
          where,
          select: APPLICATION_LIST_SELECT,
          orderBy: APPLICATION_ORDER_BY,
          skip: (currentPage - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        });

  return (
    <JobApplicationsClient
      jobOffer={jobOffer}
      applications={pageApplications}
      stats={stats}
      filters={{ filter, search }}
      pagination={{ page: currentPage, total, totalPages, pageSize: PAGE_SIZE }}
    />
  );
}

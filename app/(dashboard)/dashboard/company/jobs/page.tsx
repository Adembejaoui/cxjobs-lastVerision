import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import {
  CompanyJobsClient,
  type CompanyJobsSearchParams,
  type JobsSort,
  type JobsStatusFilter,
} from "./company-jobs-client";

/**
 * Pagination defaults.
 *
 * Declared here rather than imported from the client module: a runtime value
 * imported from a "use client" file becomes a client reference in a Server
 * Component, not the literal number.
 */
const DEFAULT_PAGE_SIZE = 20;
const MIN_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 100;

/**
 * Server-side allow-lists.
 *
 * These are intentionally duplicated instead of imported from the client
 * module: the values below come from an untrusted query string, so the set of
 * accepted values must be defined by the server, not by the client bundle.
 */
const ALLOWED_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
  "CLOSED",
  "EXPIRED",
] as const;

const ALLOWED_SORTS = [
  "createdAt_desc",
  "createdAt_asc",
  "title_asc",
  "title_desc",
] as const satisfies readonly JobsSort[];

const SORT_ORDER_BY: Record<JobsSort, Prisma.JobOfferOrderByWithRelationInput[]> = {
  createdAt_desc: [{ createdAt: "desc" }, { id: "asc" }],
  createdAt_asc: [{ createdAt: "asc" }, { id: "asc" }],
  title_asc: [{ title: "asc" }, { id: "asc" }],
  title_desc: [{ title: "desc" }, { id: "asc" }],
};

/**
 * Explicit narrow selection. Only the fields the current jobs table,
 * search, sort, and applicant links actually consume.
 */
const JOB_OFFER_SELECT = {
  id: true,
  title: true,
  slug: true,
  customLocation: true,
  status: true,
  isRemote: true,
  isHybrid: true,
  activityType: true,
  activityCustom: true,
  createdAt: true,
  _count: {
    select: { applications: true },
  },
  company: {
    select: {
      location: true,
      isRemoteFriendly: true,
      isHybridFriendly: true,
    },
  },
} as const;

function readParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw : undefined;
}

function parsePage(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function parsePageSize(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, parsed));
}

function parseSearch(raw: string | undefined): string {
  if (!raw) return "";
  return raw.trim().slice(0, MAX_SEARCH_LENGTH);
}

function parseStatus(raw: string | undefined): JobsStatusFilter {
  if (!raw) return "ALL";
  const candidate = raw.toUpperCase();
  return (ALLOWED_STATUSES as readonly string[]).includes(candidate)
    ? (candidate as JobsStatusFilter)
    : "ALL";
}

function parseSort(raw: string | undefined): JobsSort {
  if (!raw) return "createdAt_desc";
  return (ALLOWED_SORTS as readonly string[]).includes(raw)
    ? (raw as JobsSort)
    : "createdAt_desc";
}

export default async function CompanyJobsPage({
  searchParams,
}: {
  searchParams: Promise<CompanyJobsSearchParams>;
}) {
  const session = await auth();

  if (!session || session.user.role !== "COMPANY") {
    redirect("/login");
  }

  // Company is resolved from the authenticated session only.
  const company = await prisma.companies.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!company) {
    if (session.user.isOnboarded) {
      redirect("/dashboard/company");
    }
    redirect("/onboarding/company");
  }

  const sp = await searchParams;

  const requestedPage = parsePage(readParam(sp.page));
  const pageSize = parsePageSize(readParam(sp.pageSize));
  const search = parseSearch(readParam(sp.search));
  const status = parseStatus(readParam(sp.status));
  const sort = parseSort(readParam(sp.sort));

  // Data scope is pinned to the authenticated company and never widened by
  // any query-string parameter.
  const baseWhere: Prisma.JobOfferWhereInput = {
    companyId: company.id,
    deletedAt: null,
  };

  const statusFilter: Prisma.JobOfferWhereInput =
    status === "ALL" ? {} : { status };

  const where: Prisma.JobOfferWhereInput = search
    ? {
        ...baseWhere,
        ...statusFilter,
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { customLocation: { contains: search, mode: "insensitive" } },
          {
            company: {
              is: { location: { contains: search, mode: "insensitive" } },
            },
          },
        ],
      }
    : { ...baseWhere, ...statusFilter };

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [jobs, totalFiltered, jobStats, totalApplicants, recentApplicants] =
    await Promise.all([
      prisma.jobOffer.findMany({
        where,
        select: JOB_OFFER_SELECT,
        orderBy: SORT_ORDER_BY[sort],
        skip: (requestedPage - 1) * pageSize,
        take: pageSize,
      }),
      prisma.jobOffer.count({ where }),
      prisma.jobOffer.groupBy({
        by: ["status"],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.application.count({
        where: { jobOffer: { companyId: company.id, deletedAt: null } },
      }),
      prisma.application.count({
        where: {
          jobOffer: { companyId: company.id },
          createdAt: { gte: weekAgo },
        },
      }),
    ]);

  // Global stats are company-wide and deliberately ignore search/status.
  let activeJobs = 0;
  let totalJobs = 0;
  for (const stat of jobStats) {
    const count = stat._count._all;
    totalJobs += count;
    if (stat.status === "PUBLISHED") {
      activeJobs = count;
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);

  // Re-query only when the requested page was out of range (for example the
  // user deleted the last job on the final page).
  const pageJobs =
    currentPage === requestedPage
      ? jobs
      : await prisma.jobOffer.findMany({
          where,
          select: JOB_OFFER_SELECT,
          orderBy: SORT_ORDER_BY[sort],
          skip: (currentPage - 1) * pageSize,
          take: pageSize,
        });

  return (
    <CompanyJobsClient
      jobs={pageJobs}
      stats={{
        activeJobs,
        totalApplicants,
        totalJobs,
        recentApplicants,
      }}
      filters={{ search, status, sort, pageSize }}
      pagination={{ currentPage, totalPages, totalFiltered, pageSize }}
    />
  );
}

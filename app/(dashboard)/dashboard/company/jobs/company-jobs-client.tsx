"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { PlusCircle, Eye, Edit, Trash2, MapPin, Search, ChevronDown, Users, CheckCircle, Lock, Archive, RotateCcw } from "lucide-react";
import { JobPostFlow } from "@/components/dashboard/job-post-flow";
import { JobFormDialog } from "@/components/dashboard/job-form-dialog";
import { showSuccess, showError, showWarning } from "@/lib/toast";

export const DEFAULT_PAGE_SIZE = 20;

export const JOB_STATUS_OPTIONS = [
  "ALL",
  "PUBLISHED",
  "DRAFT",
  "ARCHIVED",
  "CLOSED",
  "EXPIRED",
] as const;

export const JOB_SORT_VALUES = [
  "createdAt_desc",
  "createdAt_asc",
  "title_asc",
  "title_desc",
] as const;

export const JOB_SORT_OPTIONS = [
  { value: "createdAt_desc", label: "Newest First" },
  { value: "createdAt_asc", label: "Oldest First" },
  { value: "title_asc", label: "Title A-Z" },
] as const satisfies readonly { value: JobsSort; label: string }[];

export type JobsStatusFilter = (typeof JOB_STATUS_OPTIONS)[number];
export type JobsSort = (typeof JOB_SORT_VALUES)[number];

export interface CompanyJobsSearchParams {
  page?: string | string[] | undefined;
  pageSize?: string | string[] | undefined;
  search?: string | string[] | undefined;
  status?: string | string[] | undefined;
  sort?: string | string[] | undefined;
}

interface JobOffer {
  id: string;
  title: string;
  slug: string;
  customLocation: string | null;
  status: string;
  isRemote: boolean;
  isHybrid: boolean;
  activityType: string | null;
  activityCustom: string | null;
  createdAt: Date;
  _count?: {
    applications: number;
  };
  company?: {
    location: string | null;
    isRemoteFriendly: boolean;
    isHybridFriendly: boolean;
  };
}

interface Stats {
  activeJobs: number;
  totalApplicants: number;
  totalJobs: number;
  recentApplicants: number;
}

interface JobsFilters {
  search: string;
  status: JobsStatusFilter;
  sort: JobsSort;
  pageSize: number;
}

interface JobsPagination {
  currentPage: number;
  totalPages: number;
  totalFiltered: number;
  pageSize: number;
}

interface CompanyJobsClientProps {
  jobs: JobOffer[];
  stats: Stats;
  filters: JobsFilters;
  pagination: JobsPagination;
}

/**
 * Single source of truth for every filter/sort/page URL change.
 *
 * Any change to search, status, sort, or pageSize resets the page to 1 so the
 * user never lands on an out-of-range page. Only page changes preserve the
 * current filters.
 */
function buildJobsUrl(
  next: Partial<JobsFilters> & { page?: number },
  current: JobsFilters,
): string {
  const merged = { ...current, ...next };
  const params = new URLSearchParams();

  if (merged.search) {
    params.set("search", merged.search);
  }
  if (merged.status !== "ALL") {
    params.set("status", merged.status);
  }
  if (merged.sort !== "createdAt_desc") {
    params.set("sort", merged.sort);
  }
  if (merged.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(merged.pageSize));
  }

  const page = next.page ?? 1;
  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `/dashboard/company/jobs?${query}` : "/dashboard/company/jobs";
}

export function CompanyJobsClient({
  jobs,
  stats,
  filters,
  pagination,
}: CompanyJobsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createParam = searchParams.get("create");
  const autoOpenPhase = createParam === "true" ? "choice" : undefined;

  // Local input state only, for typing responsiveness. The URL remains the
  // source of truth and is updated on a debounce.
  const [searchInput, setSearchInput] = useState(filters.search);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobOffer | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  // Keep the input in sync when the server changes filters (reset, back/forward).
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    const currentSearch = filtersRef.current.search;
    if (searchInput === currentSearch) return;

    const timer = setTimeout(() => {
      router.replace(
        buildJobsUrl({ search: searchInput || undefined, page: 1 }, filtersRef.current),
      );
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, router]);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "PUBLISHED": return "bg-emerald-50 text-emerald-600";
      case "DRAFT":     return "bg-amber-50 text-amber-600";
      case "ARCHIVED":  return "bg-blue-50 text-blue-600";
      case "CLOSED":    return "bg-slate-100 text-slate-500";
      case "EXPIRED":   return "bg-red-50 text-red-600";
      default:          return "bg-slate-100 text-slate-500";
    }
  };

  const activityTypeLabel = (type: string | null, custom: string | null): string => {
    if (!type) return '';
    const labels: Record<string, string> = {
      CUSTOMER_SERVICE: 'Customer Service',
      SALES_LEAD_GENERATION: 'Sales & Lead Generation',
      TECHNICAL_IT_SUPPORT: 'Technical & IT Support',
      DEBT_COLLECTION_LITIGATION: 'Debt Collection & Litigation',
      BACK_OFFICE_DIGITAL_SERVICES: 'Back-office & Digital Services',
      SURVEYS_MARKET_RESEARCH: 'Surveys & Market Research',
      OTHER: custom || 'Other',
    };
    return labels[type] || type;
  };

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as JobsStatusFilter;
    router.replace(buildJobsUrl({ status: value, page: 1 }, filters));
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as JobsSort;
    router.replace(buildJobsUrl({ sort: value, page: 1 }, filters));
  };

  const handleDeleteJob = async (jobId: string, jobTitle: string) => {
    showWarning(`Are you sure you want to delete "${jobTitle}"?`, {
      description: "This action cannot be undone.",
      action: {
        label: "Delete",
        onClick: async () => {
          setDeletingJobId(jobId);
          try {
            const response = await fetch(`/api/job-offers/${jobId}`, { method: "DELETE" });
            if (!response.ok) {
              const data = await response.json();
              throw new Error(data.error || "Failed to delete job");
            }
            showSuccess("Job deleted successfully", { description: `"${jobTitle}" has been removed.` });
            router.refresh();
           } catch (error) {
             showError("Failed to delete job", { description: error instanceof Error ? error.message : "Please try again later." });
          } finally {
            setDeletingJobId(null);
          }
        },
      },
    });
  };

  // ─── Stats cards ────────────────────────────────────────────────────────────

  const handleJobStatusChange = async (jobId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/job-offers/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update status");
      }

      const statusLabels: Record<string, string> = {
        PUBLISHED: "published",
        CLOSED: "closed",
        ARCHIVED: "archived",
        DRAFT: "restored",
      };
      showSuccess(`Job ${statusLabels[newStatus] || "updated"} successfully`, {
        description: "The job status has been updated.",
      });
      router.refresh();
    } catch (error) {
      showError("Failed to update job status", {
        description: error instanceof Error ? error.message : "Please try again later.",
      });
    }
  };

  const statsCards = [
    { title: "Active Jobs", value: stats.activeJobs.toString(), change: "Currently published", icon: "▣" },
    { title: "Total Applicants", value: stats.totalApplicants.toString(), change: `${stats.recentApplicants} this week`, icon: "👥" },
    { title: "Total Jobs", value: stats.totalJobs.toString(), change: "All listings", icon: "◉" },
  ];

  const { currentPage, totalPages, totalFiltered } = pagination;
  const hasNoJobsAtAll = stats.totalJobs === 0;
  const hasNoFilterMatches = !hasNoJobsAtAll && totalFiltered === 0;
  const showList = !hasNoJobsAtAll && !hasNoFilterMatches;

  const prevHref =
    currentPage > 1
      ? buildJobsUrl({ page: currentPage - 1 }, filters)
      : null;
  const nextHref =
    currentPage < totalPages
      ? buildJobsUrl({ page: currentPage + 1 }, filters)
      : null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-900">
      <main className="mx-auto max-w-360 px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Manage Jobs</h1>
            <p className="mt-1 text-sm text-slate-500">
              Overview of your current job listings and recruitment performance.
            </p>
          </div>
          <JobPostFlow defaultPhase={autoOpenPhase} />
        </div>

        {/* Stats Cards */}
        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {statsCards.map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex items-start justify-between">
                <p className="text-xs font-semibold tracking-wide text-slate-400">{card.title}</p>
                <span className="text-lg text-emerald-500">{card.icon}</span>
              </div>
              <div className="text-3xl font-semibold leading-none tracking-tight">{card.value}</div>
              <div className="mt-2 text-xs text-slate-500">{card.change}</div>
            </div>
          ))}
        </section>

        {/* Search & Filters */}
        <section className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex flex-1 items-center">
            <Search className="absolute left-3 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search job titles, locations..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10 rounded-xl border border-slate-200 bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status dropdown */}
            <div className="relative">
              <select
                value={filters.status}
                onChange={handleStatusChange}
                className="appearance-none rounded-lg border border-slate-200 bg-white px-4 py-2 pr-8 text-sm text-slate-700 shadow-sm cursor-pointer w-full"
              >
                {JOB_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "ALL" ? "All Status" : option.charAt(0) + option.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <select
                value={filters.sort}
                onChange={handleSortChange}
                className="appearance-none rounded-lg border border-slate-200 bg-white px-4 py-2 pr-8 text-sm text-slate-700 shadow-sm cursor-pointer w-full"
              >
                {JOB_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </section>

        {/* Jobs List */}
        {showList ? (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1fr_0.8fr_1fr_0.8fr_0.6fr] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
               <div>Job Title</div>
               <div>Activity Type</div>
               <div>Status</div>
               <div>Posted Date</div>
               <div>Applicants</div>
               <div className="text-right">Actions</div>
             </div>

             {jobs.map((job) => (
               <div
                 key={job.id}
                 className="grid grid-cols-[2fr_1fr_0.8fr_1fr_0.8fr_0.6fr] items-center gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 hover:bg-slate-50"
               >
                 <div>
                   <Link
                     href={`/jobs/${job.slug}`}
                     className="text-sm font-semibold text-slate-900 hover:text-primary hover:underline"
                   >
                     {job.title}
                   </Link>
                   <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                     <MapPin className="h-3 w-3" />
                     {job.customLocation || job.company?.location || "Location not specified"}
                     {job.isRemote && " (Remote)"}
                     {job.isHybrid && " (Hybrid)"}
                   </div>
                 </div>

                 <div>
                   <span className="inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700">
                     {activityTypeLabel(job.activityType, job.activityCustom)}
                   </span>
                 </div>

                 <div>
                   <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${getStatusStyle(job.status)}`}>
                     {job.status}
                   </span>
                 </div>

                 <div className="text-sm text-slate-600">{formatDate(job.createdAt)}</div>

                 <Link
                   href={`/dashboard/company/jobs/${job.id}/applications`}
                   className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                   title="View applicants"
                 >
                   <Users className="h-4 w-4" />
                   {job._count?.applications}
                 </Link>

                 <div className="flex items-center justify-end gap-1 text-slate-500">
                   <Link
                     href={`/jobs/${job.slug}`}
                     className="rounded p-1.5 hover:bg-slate-100"
                     title="View"
                   >
                     <Eye className="h-4 w-4" />
                   </Link>
                   {(job.status === "DRAFT" || job.status === "PUBLISHED") && (
                     <button
                       onClick={() => {
                         setEditingJob(job);
                         setIsEditDialogOpen(true);
                       }}
                       className="rounded p-1.5 hover:bg-slate-100"
                       title="Edit"
                     >
                       <Edit className="h-4 w-4" />
                     </button>
                   )}
                   {job.status === "DRAFT" && (
                     <>
                       <button
                         onClick={() => handleJobStatusChange(job.id, "PUBLISHED")}
                         className="rounded p-1.5 hover:bg-emerald-100"
                         title="Publish"
                       >
                         <CheckCircle className="h-4 w-4 text-emerald-600" />
                       </button>
                       <button
                         onClick={() => handleDeleteJob(job.id, job.title)}
                         disabled={deletingJobId === job.id}
                         className="rounded p-1.5 hover:bg-slate-100 disabled:opacity-50"
                         title="Delete"
                       >
                         <Trash2 className="h-4 w-4 text-red-500" />
                       </button>
                     </>
                   )}
                   {job.status === "PUBLISHED" && (
                     <>
                       <button
                         onClick={() => handleJobStatusChange(job.id, "CLOSED")}
                         className="rounded p-1.5 hover:bg-slate-100"
                         title="Close"
                       >
                         <Lock className="h-4 w-4 text-amber-600" />
                       </button>
                       <button
                         onClick={() => handleJobStatusChange(job.id, "ARCHIVED")}
                         className="rounded p-1.5 hover:bg-blue-100"
                         title="Archive"
                       >
                         <Archive className="h-4 w-4 text-blue-600" />
                       </button>
                     </>
                   )}
                   {job.status === "CLOSED" && (
                     <button
                       onClick={() => handleJobStatusChange(job.id, "ARCHIVED")}
                       className="rounded p-1.5 hover:bg-blue-100"
                       title="Archive"
                     >
                       <Archive className="h-4 w-4 text-blue-600" />
                     </button>
                   )}
                   {job.status === "ARCHIVED" && (
                     <button
                       onClick={() => handleJobStatusChange(job.id, "DRAFT")}
                       className="rounded p-1.5 hover:bg-emerald-100"
                       title="Restore"
                     >
                       <RotateCcw className="h-4 w-4 text-emerald-600" />
                     </button>
                   )}
                 </div>
              </div>
            ))}

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-500">
                Showing {jobs.length} of {totalFiltered} jobs
              </p>
              <div className="flex items-center gap-1 text-xs">
                {prevHref ? (
                  <Link
                    href={prevHref}
                    scroll={false}
                    className="rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-100"
                  >
                    Prev
                  </Link>
                ) : (
                  <button className="rounded border border-slate-200 px-2 py-1 text-slate-300" disabled>
                    Prev
                  </button>
                )}
                <span className="px-2 text-slate-600">
                  Page {currentPage} of {totalPages}
                </span>
                {nextHref ? (
                  <Link
                    href={nextHref}
                    scroll={false}
                    className="rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-100"
                  >
                    Next
                  </Link>
                ) : (
                  <button className="rounded border border-slate-200 px-2 py-1 text-slate-300" disabled>
                    Next
                  </button>
                )}
              </div>
            </div>
          </section>
        ) : (
          /* ─── Empty state ─── */
          <section className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <PlusCircle className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">
              {hasNoJobsAtAll
                ? "No jobs posted yet"
                : "No jobs match your filters"}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {hasNoJobsAtAll
                ? "Create your first job listing to start receiving applications"
                : "Try adjusting your search or filters"}
            </p>

            {!hasNoJobsAtAll && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchInput("");
                  router.replace(
                    buildJobsUrl({ search: undefined, status: "ALL", sort: "createdAt_desc", page: 1 }, filters),
                  );
                }}
                className="mt-4"
              >
                Clear Filters
              </Button>
            )}
          </section>
        )}
      </main>

      {/* ─── Edit Job Dialog ─── */}
      <JobFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        job={editingJob}
        onSuccess={() => {
          setIsEditDialogOpen(false);
          setEditingJob(null);
          showSuccess("Job updated successfully!", {
            description: "Your changes have been saved.",
          });
          router.refresh();
        }}
      />
    </div>
  );
}

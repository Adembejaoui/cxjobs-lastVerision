"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { PlusCircle, Eye, Edit, Trash2, MapPin, Search, ChevronDown, Users, CheckCircle, Lock, Archive, RotateCcw } from "lucide-react";
import { JobPostFlow } from "@/components/dashboard/job-post-flow";
import { JobFormDialog } from "@/components/dashboard/job-form-dialog";
import { showSuccess, showError, showWarning } from "@/lib/toast";

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

interface CompanyJobsClientProps {
  jobs: JobOffer[];
  stats: Stats;
}

export function CompanyJobsClient({ jobs: initialJobs, stats }: CompanyJobsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createParam = searchParams.get("create");
  const autoOpenPhase = createParam === "true" ? "choice" : undefined;
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title">("newest");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobOffer | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  // ─── Filter & sort ────────────────────────────────────────────────────────

  const filteredJobs = useMemo(() => {
    let result = [...initialJobs];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (job) =>
          job.title.toLowerCase().includes(q) ||
          (job.customLocation?.toLowerCase().includes(q) ?? false) ||
          (job.company?.location?.toLowerCase().includes(q) ?? false)
      );
    }

    if (statusFilter !== "ALL") {
      result = result.filter((job) => job.status === statusFilter);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "title":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return result;
  }, [initialJobs, searchQuery, statusFilter, sortBy]);

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

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setStatusFilter(e.target.value);

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setSortBy(e.target.value as "newest" | "oldest" | "title");

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

  // ─── Stats cards ───────────────────────────────────────────────────────────

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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl border border-slate-200 bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={handleStatusChange}
                className="appearance-none rounded-lg border border-slate-200 bg-white px-4 py-2 pr-8 text-sm text-slate-700 shadow-sm cursor-pointer w-full"
              >
                <option value="ALL">All Status</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
                <option value="CLOSED">Closed</option>
                <option value="EXPIRED">Expired</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={handleSortChange}
                className="appearance-none rounded-lg border border-slate-200 bg-white px-4 py-2 pr-8 text-sm text-slate-700 shadow-sm cursor-pointer w-full"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Title A-Z</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </section>

        {/* Jobs List */}
        {filteredJobs.length > 0 ? (
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

             {filteredJobs.map((job) => (
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

            {/* Pagination placeholder */}
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-500">
                Showing {filteredJobs.length} of {initialJobs.length} jobs
              </p>
              <div className="flex items-center gap-1 text-xs">
                <button className="rounded border border-slate-200 px-2 py-1 text-slate-300" disabled>Prev</button>
                <button className="rounded bg-[#162f67] px-2 py-1 font-semibold text-white">1</button>
                <button className="rounded border border-slate-200 px-2 py-1 text-slate-600">Next</button>
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
              {searchQuery || statusFilter !== "ALL" ? "No jobs match your filters" : "No jobs posted yet"}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {searchQuery || statusFilter !== "ALL"
                ? "Try adjusting your search or filters"
                : "Create your first job listing to start receiving applications"}
            </p>
          
            {(searchQuery || statusFilter !== "ALL") && (
              <Button
                variant="outline"
                onClick={() => { setSearchQuery(""); setStatusFilter("ALL"); }}
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

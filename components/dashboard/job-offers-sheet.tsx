"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Pagination } from "@/components/pagination";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JobFormDialog } from "@/components/dashboard/job-form-dialog";
import { Search } from "lucide-react";
import { showError, showSuccess } from "@/lib/toast";
import { isValidStatusTransition } from "@/lib/validations/job";

interface JobOffer {
  id: string;
  title: string;
  status: string;
  views: number;
  contractType: string;
  employmentType: string;
  isRemote: boolean;
  isHybrid: boolean;
  customLocation: string | null;
  location?: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  activityType: string | null;
  activityCustom: string | null;
  featured: boolean;
  highlight: boolean;
  publishedAt: string | null;
  closedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  description: string | null;
  requirements: string[];
  benefitIds?: string[];
  technicalTools: string[];
  softSkills: string[];
  applicationType: string;
  externalApplyUrl: string | null;
  benefits: {
    id: string;
    benefit: { id: string; name: string };
  }[];
  languages: { language: string; level: string }[];
  _count: {
    applications: number;
  };
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ApiResponse {
  success: boolean;
  data: JobOffer[];
  pagination: PaginationData;
  company: {
    id: string;
    name: string;
  };
  error?: string;
  code?: string;
}

interface JobOffersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | undefined;
  companyName: string | undefined;
  admin?: boolean;
}

const DEFAULT_LIMIT = 10;
const SORT_OPTIONS = [
  { value: "createdAt-desc", label: "Newest" },
  { value: "createdAt-asc", label: "Oldest" },
  { value: "title-asc", label: "Title A-Z" },
  { value: "title-desc", label: "Title Z-A" },
  { value: "views-asc", label: "Views (low to high)" },
  { value: "views-desc", label: "Views (high to low)" },
] as const;

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
  { value: "CLOSED", label: "Closed" },
  { value: "EXPIRED", label: "Expired" },
] as const;

function getStatusBadge(status: string) {
  const variants: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
    DRAFT: "secondary",
    PUBLISHED: "success",
    ARCHIVED: "default",
    CLOSED: "destructive",
    EXPIRED: "warning",
  };
  return (
    <Badge variant={variants[status] || "default"} className="text-xs">
      {status}
    </Badge>
  );
}

function formatDate(dateString: string | null) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function JobOffersSheet({
  open,
  onOpenChange,
 companyId,
  companyName,
  admin = false,
}: JobOffersSheetProps) {
  const [jobs, setJobs] = useState<JobOffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: DEFAULT_LIMIT,
    total: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState("createdAt-desc");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Partial<JobOffer> | null>(null);

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closingJobId, setClosingJobId] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set("companyId", companyId || "");
    params.set("page", String(pagination.page));
    params.set("limit", String(pagination.limit));
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    if (sort !== "createdAt-desc") params.set("sort", sort);
    return params.toString();
  }, [companyId, pagination.page, pagination.limit, debouncedSearch, statusFilter, sort]);

  const fetchJobs = useCallback(async () => {
    if (!companyId) return;

    setIsLoading(true);
    try {
      const queryString = buildQueryString();
      const response = await fetch(`/api/admin/job-offers?${queryString}`);
      const data: ApiResponse = await response.json();

      if (data.success) {
        setJobs(data.data);
        setPagination(data.pagination);
      } else {
        showError(data.error || "Failed to fetch job offers");
        setJobs([]);
        setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
      }
    } catch {
      showError("Failed to fetch job offers");
      setJobs([]);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
    } finally {
      setIsLoading(false);
    }
  }, [buildQueryString, companyId]);

  useEffect(() => {
    if (open && companyId) {
      fetchJobs();
    }
  }, [open, companyId, fetchJobs]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSortChange = (value: string) => {
    setSort(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const handleEditClick = (job: JobOffer) => {
    setEditingJob({
      id: job.id,
      title: job.title,
      description: job.description || "",
      customLocation: job.customLocation || "",
      location: "",
      contractType: job.contractType,
      isRemote: job.isRemote,
      isHybrid: job.isHybrid,
      employmentType: job.employmentType,
      activityType: job.activityType || "CUSTOMER_SERVICE",
      activityCustom: job.activityCustom,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency || "USD",
      requirements: job.requirements || [],
      benefitIds: job.benefits?.map((b) => b.benefit.id) || [],
      languages: job.languages || [],
      technicalTools: job.technicalTools || [],
      softSkills: job.softSkills || [],
      status: job.status,
      applicationType: job.applicationType || "INTERNAL",
      externalApplyUrl: job.externalApplyUrl,
      expiresAt: job.expiresAt ? new Date(job.expiresAt).toISOString().split("T")[0] : "",
    });
    setEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    fetchJobs();
  };

  const canClose = (status: string) => isValidStatusTransition(status, "CLOSED");

  const handleCloseClick = (job: JobOffer) => {
    if (!canClose(job.status)) return;
    setClosingJobId(job.id);
    setCloseDialogOpen(true);
  };

  const handleCloseConfirm = async () => {
    if (!closingJobId) return;

    setIsClosing(true);
    try {
      const response = await fetch(`/api/admin/job-offers/${closingJobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });

      const data = await response.json();

      if (data.success) {
        showSuccess("Job offer closed successfully");
        // Optimistically update the job status
        setJobs((prev) =>
          prev.map((job) =>
            job.id === closingJobId ? { ...job, status: "CLOSED" } : job
          )
        );
      } else {
        showError(data.error || "Failed to close job offer");
      }
    } catch {
      showError("Failed to close job offer");
    } finally {
      setIsClosing(false);
      setCloseDialogOpen(false);
      setClosingJobId(null);
    }
  };

  if (!open) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-4xl">
        <SheetHeader className="pb-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-white">
                {companyName} - Job Offers
              </SheetTitle>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search by title..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-400 focus:border-[#162f67]"
              />
            </div>
            <div className="flex items-center gap-3">
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[180px] bg-white/5 border-white/10 text-white focus:border-[#162f67]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={handleSortChange}>
                <SelectTrigger className="w-[200px] bg-white/5 border-white/10 text-white focus:border-[#162f67]">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-slate-300">Title</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-slate-300">Views</TableHead>
                      <TableHead className="text-slate-300">Applications</TableHead>
                      <TableHead className="text-slate-300">Created</TableHead>
                      <TableHead className="text-slate-300 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><div className="h-4 w-3/4 bg-white/10 animate-pulse rounded" /></TableCell>
                        <TableCell><div className="h-5 w-20 bg-white/10 animate-pulse rounded" /></TableCell>
                        <TableCell><div className="h-4 w-16 bg-white/10 animate-pulse rounded" /></TableCell>
                        <TableCell><div className="h-4 w-16 bg-white/10 animate-pulse rounded" /></TableCell>
                        <TableCell><div className="h-4 w-24 bg-white/10 animate-pulse rounded" /></TableCell>
                        <TableCell className="text-right"><div className="h-8 w-20 bg-white/10 animate-pulse rounded mx-auto" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400">No job offers found</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-slate-300">Title</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-slate-300">Views</TableHead>
                      <TableHead className="text-slate-300">Applications</TableHead>
                      <TableHead className="text-slate-300">Created</TableHead>
                      <TableHead className="text-slate-300 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium text-white">{job.title}</TableCell>
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                        <TableCell className="text-slate-300">{job.views}</TableCell>
                        <TableCell className="text-slate-300">{job._count.applications}</TableCell>
                        <TableCell className="text-slate-300">{formatDate(job.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(job)}
                              className="text-slate-300 hover:text-white hover:bg-white/10"
                            >
                              Edit
                            </Button>
                            {canClose(job.status) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCloseClick(job)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                disabled={isClosing}
                              >
                                Close
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {pagination.totalPages > 1 && (
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  onPageChange={handlePageChange}
                />
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>

    <JobFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        job={editingJob}
        admin={admin}
        onSuccess={handleEditSuccess}
      />

    <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Close Job Offer</DialogTitle>
          <DialogDescription>
            Are you sure you want to close this job offer? This will prevent new applications
            and mark the job as closed. This action can be reversed by an admin if needed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCloseDialogOpen(false)} disabled={isClosing}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleCloseConfirm} disabled={isClosing}>
            {isClosing ? "Closing..." : "Close Job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
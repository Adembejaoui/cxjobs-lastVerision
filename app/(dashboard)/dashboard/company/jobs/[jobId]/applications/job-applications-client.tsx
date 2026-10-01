"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Search,
  User,
  MapPin,
  Bookmark,
  ChevronDown,
  Eye,
  Download,
} from "lucide-react";
import { CandidateReviewModal } from "./candidate-review-modal";
import type { Candidate, Application } from "./types";
import { logger } from "@/lib/logger";

interface Stats {
  total: number;
  new: number;
  inReview: number;
  interview: number;
  hired: number;
  rejected: number;
  recent: number;
}

interface JobOffer {
  id: string;
  title: string;
  customLocation: string | null;
}

/**
 * Prisma ApplicationStatus values, restated as a type union so the dropdown
 * value type is defined in one place. `ALL` and `SAVED` are UI sentinels —
 * `SAVED` is not an ApplicationStatus and maps to `isSaved = true` with no
 * status constraint.
 */
export type ApplicationStatusValue =
  | "NOUVEAU"
  | "EN_COURS_EXAMEN"
  | "ENTRETIEN"
  | "EMBAUCHES"
  | "REFUSE";

export type ApplicationFilter = "ALL" | "SAVED" | ApplicationStatusValue;

export interface ApplicationsSearchParams {
  page?: string | string[] | undefined;
  status?: string | string[] | undefined;
  isSaved?: string | string[] | undefined;
  search?: string | string[] | undefined;
}

/** Current filter state, always mirrored in the URL. */
export interface ApplicationsFilters {
  filter: ApplicationFilter;
  search: string;
}

/** Pagination for the filtered dataset only. */
export interface ApplicationsPagination {
  page: number;
  total: number;
  totalPages: number;
  pageSize: number;
}

interface JobApplicationsClientProps {
  jobOffer: JobOffer;
  applications: Application[];
  stats: Stats;
  filters: ApplicationsFilters;
  pagination: ApplicationsPagination;
}

const SEARCH_DEBOUNCE_MS = 300;

interface FullApplicationDetail {
  coverLetter: string | null;
  cvUrl: string | null;
  notes: string | null;
  candidate: Candidate;
}

/**
 * Single source of truth for every filter and page URL change.
 *
 * Any change to the dropdown or the search resets the page to 1 so the
 * recruiter never lands on an out-of-range page. Only a page change preserves
 * the current filters.
 */
function buildApplicationsUrl(
  next: Partial<ApplicationsFilters> & { page?: number },
  current: ApplicationsFilters,
  pathname: string,
): string {
  const merged = { ...current, ...next };
  const params = new URLSearchParams();

  // The dropdown is mutually exclusive: SAVED writes isSaved and no status,
  // a status writes status and no isSaved, ALL writes neither.
  if (merged.filter === "SAVED") {
    params.set("isSaved", "true");
  } else if (merged.filter !== "ALL") {
    params.set("status", merged.filter);
  }

  if (merged.search) {
    params.set("search", merged.search);
  }

  const page = next.page ?? 1;
  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function JobApplicationsClient({
  jobOffer,
  applications: initialApplications,
  stats,
  filters,
  pagination: initialPagination,
}: JobApplicationsClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Rows always come from the server, already filtered and already paginated.
  // The client never filters or slices the dataset itself.
  const [applications, setApplications] = useState(initialApplications);
  const [page, setPage] = useState(initialPagination.page);
  const [total, setTotal] = useState(initialPagination.total);
  const [totalPages, setTotalPages] = useState(initialPagination.totalPages);
  const [loading, setLoading] = useState(false);

  // Local input state only, for typing responsiveness. The URL is the source
  // of truth and is updated on a debounce.
  const [searchInput, setSearchInput] = useState(filters.search);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // The candidate under review is identified by application id, never by list position.
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);

  // Full application detail keyed by application id — populated on-demand when the modal opens
  const [fullCandidates, setFullCandidates] = useState<Record<string, FullApplicationDetail>>({});

  // Only one export may be in flight at a time. The ref is the authoritative
  // guard: a rapid second click is dispatched before React has re-rendered with
  // the new state, so state alone would still let a duplicate request start.
  // The state exists only to drive the button's disabled appearance.
  const [isExporting, setIsExporting] = useState(false);
  const exportInFlight = useRef(false);

  // Refs used to avoid duplicate in-flight requests / stale rollbacks
  const detailRequestsInFlight = useRef<Set<string>>(new Set());
  const statusUpdateSeq = useRef<Record<string, number>>({});
  // Monotonic id + abort handle so a slow page response can never overwrite a
  // newer one.
  const listRequestSeq = useRef(0);
  const listRequestAbort = useRef<AbortController | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest committed filters, readable from timers and callbacks that would
  // otherwise close over a stale render.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const pageSize = initialPagination.pageSize;
  const hasActiveFilters = filters.filter !== "ALL" || filters.search !== "";

  // Adopt server-rendered data whenever the server re-renders for a new URL.
  // This is also what completes a filter or page navigation started below.
  useEffect(() => {
    setApplications(initialApplications);
    setPage(initialPagination.page);
    setTotal(initialPagination.total);
    setTotalPages(initialPagination.totalPages);
    setLoading(false);
    // Keep the input in sync with the server (Clear Filters, back/forward), but
    // never overwrite text the recruiter is still typing: a response for the
    // previously committed search must not eat the keystrokes typed after it.
    if (searchTimer.current === null) {
      setSearchInput(filters.search);
    }
  }, [initialApplications, initialPagination, filters.search]);

  const clearSearchTimer = useCallback(() => {
    if (searchTimer.current !== null) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
  }, []);

  // A filter or page change replaces the dataset, so the open candidate may no
  // longer exist in the navigable rows. Closing the modal is the only safe
  // outcome: pinning or falling back would silently review a different person.
  const closeReviewModal = useCallback(() => {
    setIsModalOpen(false);
    setActiveApplicationId(null);
  }, []);

  // Commit a filter/search change. The Server Component re-renders page 1 of
  // the new dataset; the pending search debounce is dropped so the same input
  // is never committed twice.
  const applyFilters = useCallback(
    (next: ApplicationsFilters) => {
      clearSearchTimer();
      closeReviewModal();
      setLoading(true);
      router.replace(buildApplicationsUrl({ ...next, page: 1 }, filtersRef.current, pathname));
    },
    [clearSearchTimer, closeReviewModal, router, pathname],
  );

  // Search is server-side now, so typing must not issue a request per keystroke.
  useEffect(() => {
    const currentSearch = filtersRef.current.search;
    if (searchInput === currentSearch) return;

    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      applyFilters({ filter: filtersRef.current.filter, search: searchInput });
    }, SEARCH_DEBOUNCE_MS);

    return clearSearchTimer;
  }, [searchInput, applyFilters, clearSearchTimer]);

  // Derived navigation position of the active candidate inside the current rows
  const activeIndex = useMemo(() => {
    if (!activeApplicationId) return -1;
    return applications.findIndex((app) => app.id === activeApplicationId);
  }, [applications, activeApplicationId]);

  // The active candidate can leave the rows when its status/isSaved changes.
  // It is then pinned from the page-level rows so the modal never switches candidate.
  const pinnedApplication = useMemo(() => {
    if (!activeApplicationId || activeIndex !== -1) return undefined;
    return applications.find((app) => app.id === activeApplicationId);
  }, [applications, activeApplicationId, activeIndex]);

  const loadPage = useCallback(
    async (pageNum: number) => {
      if (pageNum < 1 || pageNum > totalPages) return;
      closeReviewModal();
      setLoading(true);

      // Keep the URL authoritative so the page survives a refresh or a deep link.
      router.replace(buildApplicationsUrl({ page: pageNum }, filtersRef.current, pathname));

      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      params.set("limit", String(pageSize));
      const current = filtersRef.current;
      if (current.filter === "SAVED") {
        params.set("isSaved", "true");
      } else if (current.filter !== "ALL") {
        params.set("status", current.filter);
      }
      if (current.search) {
        params.set("search", current.search);
      }

      // Latest-wins: abort the previous page request and tag this one, so a
      // slower earlier response can never overwrite a newer result.
      const seq = listRequestSeq.current + 1;
      listRequestSeq.current = seq;
      listRequestAbort.current?.abort();
      const controller = new AbortController();
      listRequestAbort.current = controller;

      try {
        const res = await fetch(
          `/api/job-offers/${jobOffer.id}/applications?${params.toString()}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (seq !== listRequestSeq.current) return;
        const json = await res.json();
        if (seq !== listRequestSeq.current) return;

        if (json.success) {
          // Ignore a response the server has since clamped away; the URL
          // navigation above re-renders the correct page in that case.
          if (json.pagination.totalPages >= 1 && json.pagination.page > json.pagination.totalPages) {
            return;
          }
          setApplications(json.data);
          setPage(json.pagination.page);
          setTotal(json.pagination.total);
          setTotalPages(json.pagination.totalPages);
          setFullCandidates({});
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch {
        // Aborted or offline — the router navigation still renders the page.
      } finally {
        if (seq === listRequestSeq.current) {
          setLoading(false);
        }
      }
    },
    [jobOffer.id, pageSize, totalPages, closeReviewModal, router, pathname],
  );

  const handleStatusUpdate = useCallback(
    async (applicationId: string, status: string, notes?: string | null) => {
      const previousApp = applications.find((app) => app.id === applicationId);
      const seq = (statusUpdateSeq.current[applicationId] ?? 0) + 1;
      statusUpdateSeq.current[applicationId] = seq;

      // Capture the persisted note before mutating, so a failed save can restore it.
      // `detailWasCached` keeps rollback from creating a cache entry that never existed.
      const detailWasCached = fullCandidates[applicationId] !== undefined;
      const previousDetailNotes = fullCandidates[applicationId]?.notes ?? null;

      setApplications((prev) =>
        prev.map((app) =>
          app.id === applicationId ? { ...app, status, notes: notes ?? null } : app
        )
      );

      // Keep the lazily cached detail note in sync so returning to this candidate
      // shows the saved note instead of the value fetched before the save.
      if (notes !== undefined) {
        setFullCandidates((prev) => {
          const existing = prev[applicationId];
          if (!existing || existing.notes === notes) return prev;
          return { ...prev, [applicationId]: { ...existing, notes } };
        });
      }

      try {
        const response = await fetch(`/api/application/${applicationId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          // Omitting notes leaves the stored recruiter notes untouched
          body: JSON.stringify({ status, notes: notes ?? undefined }),
        });

        if (!response.ok) throw new Error("Failed to update status");
      } catch {
        logger.error("Failed to update application status");
        // Only roll back if no newer update for this application has started
        if (statusUpdateSeq.current[applicationId] === seq) {
          if (previousApp) {
            setApplications((prev) =>
              prev.map((app) => (app.id === applicationId ? previousApp : app))
            );
          }
          // Restore the cached detail note so both local stores agree again
          if (detailWasCached && notes !== undefined) {
            setFullCandidates((prev) => {
              const existing = prev[applicationId];
              if (!existing || existing.notes === previousDetailNotes) return prev;
              return { ...prev, [applicationId]: { ...existing, notes: previousDetailNotes } };
            });
          }
        }
      }
    },
    [applications, fullCandidates]
  );

  // Loads (at most once) the full application + candidate detail used by the review modal
  const ensureApplicationDetail = useCallback(
    async (applicationId: string) => {
      // Already cached
      if (fullCandidates[applicationId]) return;

      // Already being fetched — do not duplicate the request
      if (detailRequestsInFlight.current.has(applicationId)) return;
      detailRequestsInFlight.current.add(applicationId);

      try {
        const res = await fetch(`/api/application/${applicationId}`, { cache: "no-store" });
        const json = await res.json();
        if (json.success && json.data?.candidate) {
          setFullCandidates((prev) => ({
            ...prev,
            [applicationId]: {
              coverLetter: json.data.coverLetter ?? null,
              cvUrl: json.data.cvUrl ?? null,
              notes: json.data.notes ?? null,
              candidate: json.data.candidate,
            },
          }));
        }
      } catch {
        // Silently fail — modal will show whatever we have
      } finally {
        // Always release so a later attempt can retry
        detailRequestsInFlight.current.delete(applicationId);
      }
    },
    [fullCandidates]
  );

  // NEW -> IN_REVIEW whenever an application becomes the active candidate under review.
  // Any other status is left untouched, and existing notes are preserved.
  const markActiveAsInReview = useCallback(
    (app: Application | undefined) => {
      if (!app || app.status !== "NOUVEAU") return;

      const existingNotes =
        fullCandidates[app.id]?.notes ??
        applications.find((candidate) => candidate.id === app.id)?.notes ??
        undefined;

      void handleStatusUpdate(app.id, "EN_COURS_EXAMEN", existingNotes);
    },
    [fullCandidates, applications, handleStatusUpdate]
  );

  // Open the review modal for an application id: load its detail, then auto-advance NEW -> IN_REVIEW
  const handleOpenModal = useCallback(
    (applicationId: string) => {
      setActiveApplicationId(applicationId);
      setIsModalOpen(true);

      const app = applications.find((candidate) => candidate.id === applicationId);
      if (!app) return;

      void ensureApplicationDetail(applicationId);
      markActiveAsInReview(app);
    },
    [applications, ensureApplicationDetail, markActiveAsInReview]
  );

  // Next/Previous activates an application id — always resolved from that id, never a
  // raw index, so a mutation that reorders the rows cannot retarget navigation.
  const handleNavigate = useCallback(
    (applicationId: string) => {
      setActiveApplicationId(applicationId);

      const nextApp = applications.find((candidate) => candidate.id === applicationId);
      if (!nextApp) return;

      void ensureApplicationDetail(applicationId);
      markActiveAsInReview(nextApp);
    },
    [applications, ensureApplicationDetail, markActiveAsInReview]
  );

  const handleToggleSaved = async (applicationId: string, isSaved: boolean) => {
    setApplications((prev) =>
      prev.map((app) => (app.id === applicationId ? { ...app, isSaved } : app))
    );

    try {
      const response = await fetch(`/api/application/${applicationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSaved }),
      });

      if (!response.ok) throw new Error("Failed to toggle saved status");
    } catch {
      logger.error("Failed to toggle saved status");
      setApplications((prev) =>
        prev.map((app) => (app.id === applicationId ? { ...app, isSaved: !isSaved } : app))
      );
    }
  };

  // Single source of truth for the modal: merges lazy detail onto the lean list rows.
  // Rows whose detail has not loaded yet fall back to the list values plus empty collections.
  // The active candidate is always present — pinned at the front when it no longer
  // matches the active filter — so the modal can never lose the candidate it is reviewing.
  const modalApplications = useMemo(() => {
    const navigable =
      pinnedApplication && !applications.some((app) => app.id === pinnedApplication.id)
        ? [pinnedApplication, ...applications]
        : applications;

    return navigable.map((app) => {
      const detail = fullCandidates[app.id];
      if (detail) {
        return {
          ...app,
          coverLetter: detail.coverLetter,
          cvUrl: detail.cvUrl,
          notes: detail.notes,
          candidate: detail.candidate,
        };
      }

      const leanCandidate = app.candidate;
      return {
        ...app,
        // Lazy-detail fields are not part of the lean list payload; they stay
        // null until GET /api/application/[id] fills them in.
        coverLetter: null,
        cvUrl: null,
        notes: null,
        candidate: leanCandidate
          ? { ...leanCandidate, languages: [], experiences: [], education: [], preferredJobTypes: [] }
          : undefined,
      };
    });
  }, [applications, pinnedApplication, fullCandidates]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "NOUVEAU":
        return "bg-blue-50 text-blue-600";
      case "EN_COURS_EXAMEN":
        return "bg-amber-50 text-amber-600";
      case "ENTRETIEN":
        return "bg-purple-50 text-purple-600";
      case "EMBAUCHES":
        return "bg-emerald-50 text-emerald-600";
      case "REFUSE":
        return "bg-red-50 text-red-600";
      default:
        return "bg-slate-100 text-slate-500";
    }
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case "NOUVEAU":
        return "New";
      case "EN_COURS_EXAMEN":
        return "In Review";
      case "ENTRETIEN":
        return "Interview";
      case "EMBAUCHES":
        return "Hired";
      case "REFUSE":
        return "Rejected";
      default:
        return status;
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const exportCandidates = useCallback(async () => {
    // Synchronous guard, checked before any await: blocks a second click that
    // lands while the first export is still running.
    if (exportInFlight.current) return;
    exportInFlight.current = true;
    setIsExporting(true);
    try {
      // Export the rows the recruiter is actually looking at, across every page.
    // The active filters are forwarded with the same mapping the list URL and
    // the paged list request already use; pagination is deliberately omitted so
    // the workbook covers every matching application, not just the visible page.
    const params = new URLSearchParams();
    const current = filtersRef.current;
    if (current.filter === "SAVED") {
      params.set("isSaved", "true");
    } else if (current.filter !== "ALL") {
      params.set("status", current.filter);
    }
    if (current.search) {
      params.set("search", current.search);
    }
    const query = params.toString();
    const res = await fetch(
      `/api/job-offers/${jobOffer.id}/applications/export${query ? `?${query}` : ""}`,
      { cache: "no-store" }
    );
      if (!res.ok) throw new Error("Failed to export");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const contentDisposition = res.headers.get("Content-Disposition");
      const fileNameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
      a.download = fileNameMatch ? fileNameMatch[1] : "candidates.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error("Failed to export candidates", { error });
    } finally {
      // Always released, so a failed or slow export cannot leave the button
      // permanently disabled.
      exportInFlight.current = false;
      setIsExporting(false);
    }
  }, [jobOffer.id]);

  const statsCards = [
    { title: "Total Applicants", value: stats.total.toString(), change: `${stats.recent} this week`, icon: "👥" },
    { title: "New", value: stats.new.toString(), change: "Awaiting review", icon: "🆕" },
    { title: "In Review", value: stats.inReview.toString(), change: "Being reviewed", icon: "👀" },
    { title: "Interview", value: stats.interview.toString(), change: "Scheduled", icon: "📅" },
  ];

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-900">
      <main className="mx-auto max-w-[1440px] px-6 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard/company/jobs"
            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Jobs
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {jobOffer.title}
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                <MapPin className="h-4 w-4" />
                {jobOffer.customLocation || "Location not specified"}
              </p>
            </div>
            <Button
              onClick={exportCandidates}
              disabled={isExporting}
              aria-busy={isExporting}
              className="inline-flex items-center gap-2 rounded-xl bg-[#162f67] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#162f67]/90 transition-colors shrink-0"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statsCards.map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex items-start justify-between">
                <p className="text-xs font-semibold tracking-wide text-slate-400">
                  {card.title}
                </p>
                <span className="text-lg">{card.icon}</span>
              </div>
              <div className="text-3xl font-semibold leading-none tracking-tight">
                {card.value}
              </div>
              <div className="mt-2 text-xs text-slate-500">{card.change}</div>
            </div>
          ))}
        </section>

        <section className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex flex-1 items-center">
            <Search className="absolute left-3 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search candidates by name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10 rounded-xl border-slate-200 bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select
                value={filters.filter}
                onChange={(e) => applyFilters({ filter: e.target.value as ApplicationFilter, search: searchInput })}
                className="appearance-none rounded-lg border border-slate-200 bg-white px-4 py-2 pr-8 text-sm text-slate-700 shadow-sm cursor-pointer"
              >
                <option value="ALL">All Status</option>
                <option value="SAVED">Saved</option>
                <option value="NOUVEAU">New</option>
                <option value="EN_COURS_EXAMEN">In Review</option>
                <option value="ENTRETIEN">Interview</option>
                <option value="EMBAUCHES">Hired</option>
                <option value="REFUSE">Rejected</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </section>

        {applications.length > 0 ? (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-[2fr_1.5fr_1fr_0.6fr_0.5fr_0.5fr_0.5fr] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <div>Candidate</div>
              <div>Contact</div>
              <div>Skills</div>
              <div>Status</div>
              <div>Applied</div>
              <div>Saved</div>
              <div>Action</div>
            </div>

            {applications.map((app) => {
              const candidate = app.candidate;

              return (
                <div
                  key={app.id}
                  className="grid grid-cols-[2fr_1.5fr_1fr_0.6fr_0.5fr_0.5fr_0.5fr] items-center gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200">
                      {candidate?.avatarUrl || candidate?.user?.image ? (
                        <img
                          src={candidate.avatarUrl || candidate.user?.image || ""}
                          alt={candidate?.user?.name || "Candidate"}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {candidate?.user?.name || "No name"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="flex items-center gap-1.5 text-xs text-slate-600">
                      {candidate?.user?.email ? (
                        <span className="truncate">{candidate.user.email}</span>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {candidate?.skills?.slice(0, 3).map((skill: { id: string; name: string }) => (
                      <span
                        key={skill.id}
                        className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                      >
                        {skill.name}
                      </span>
                    ))}
                    {candidate?.skills && candidate.skills.length > 3 && (
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        +{candidate.skills.length - 3}
                      </span>
                    )}
                  </div>

                  <div>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${getStatusStyle(
                        app.status
                      )}`}
                    >
                      {formatStatus(app.status)}
                    </span>
                  </div>

                  <div className="text-sm text-slate-500">
                    {formatDate(app.createdAt)}
                  </div>

                  <div className="flex items-center justify-center">
                    <button
                      onClick={() => handleToggleSaved(app.id, !app.isSaved)}
                      className={`rounded-lg p-1.5 transition-colors ${
                        app.isSaved
                          ? "text-amber-500 hover:text-amber-600"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                      title={app.isSaved ? "Remove from saved" : "Save candidate"}
                    >
                      <Bookmark className={`h-5 w-5 ${app.isSaved ? "fill-current" : ""}`} />
                    </button>
                  </div>

                  <div>
                    <button
                      onClick={() => handleOpenModal(app.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#162f67] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#162f67]/90 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Review
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-500">
                Showing {applications.length} of {total} applicants
                {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1 || loading}
                    onClick={() => loadPage(page - 1)}
                    className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages || loading}
                    onClick={() => loadPage(page + 1)}
                    className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <User className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">
              {hasActiveFilters
                ? "No applicants match your filters"
                : "No applicants yet"}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {hasActiveFilters
                ? "Try adjusting your search or filters"
                : "Applicants for this job will appear here"}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={() => applyFilters({ filter: "ALL", search: "" })}
                className="mt-4"
              >
                Clear Filters
              </Button>
            )}
          </section>
        )}
      </main>

      {/* Candidate Review Modal — receives the enriched application (full details fetched on demand) */}
      <CandidateReviewModal
        isOpen={isModalOpen}
        onClose={closeReviewModal}
        applications={modalApplications}
        activeApplicationId={activeApplicationId}
        onNavigate={handleNavigate}
        onStatusUpdate={handleStatusUpdate}
        onToggleSaved={handleToggleSaved}
      />
    </div>
  );
}

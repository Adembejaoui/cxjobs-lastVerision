"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
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

} from "lucide-react";
import { CandidateReviewModal } from "./candidate-review-modal";
import type { Candidate, Application } from "./types";

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

interface JobApplicationsClientProps {
  jobOffer: JobOffer;
  applications: Application[];
  stats: Stats;
  initialTotal: number;
  initialPage: number;
  pageSize: number;
}

export function JobApplicationsClient({
  jobOffer,
  applications: initialApplications,
  stats,
  initialTotal,
  initialPage,
  pageSize,
}: JobApplicationsClientProps) {
  const [applications, setApplications] = useState(initialApplications);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentAppIndex, setCurrentAppIndex] = useState(0);

  // Full candidate details keyed by application id — populated on-demand when the modal opens
  const [fullCandidates, setFullCandidates] = useState<Record<string, Candidate>>({});

  const totalPages = Math.ceil(initialTotal / pageSize);

  const filteredWithIndices = useMemo(() => {
    return applications
      .map((app, index) => ({ app, originalIndex: index }))
      .filter(({ app }) => {
        const matchesSearch =
          !searchQuery ||
          (app.candidate?.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            app.candidate?.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()));

        let matchesFilter = true;
        if (statusFilter === "ALL") {
          matchesFilter = true;
        } else if (statusFilter === "SAVED") {
          matchesFilter = app.isSaved === true;
        } else {
          matchesFilter = app.status === statusFilter;
        }

        return matchesSearch && matchesFilter;
      });
  }, [applications, searchQuery, statusFilter]);

  const loadPage = useCallback(
    async (pageNum: number) => {
      if (pageNum < 1 || pageNum > totalPages || loading) return;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/job-offers/${jobOffer.id}/applications?page=${pageNum}&limit=${pageSize}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (json.success) {
          setApplications(json.data);
          setPage(pageNum);
          setFullCandidates({});
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } finally {
        setLoading(false);
      }
    },
    [jobOffer.id, pageSize, totalPages, loading]
  );

  // Lazy-load full candidate data when the review modal is opened
  const handleOpenModal = useCallback(
    async (originalIndex: number) => {
      setCurrentAppIndex(originalIndex);
      setIsModalOpen(true);

      const app = filteredWithIndices[originalIndex]?.app;
      if (!app) return;

      // If we already fetched full details for this candidate, no need to refetch
      if (fullCandidates[app.id]) return;

      try {
        const res = await fetch(`/api/application/${app.id}`);
        const json = await res.json();
        if (json.success && json.data?.candidate) {
          setFullCandidates((prev) => ({
            ...prev,
            [app.id]: json.data.candidate,
          }));
        }
      } catch {
        // Silently fail — modal will show whatever we have
      }
    },
    [filteredWithIndices, fullCandidates]
  );

  const handleNavigate = useCallback((newIndex: number) => {
    setCurrentAppIndex(newIndex);
  }, []);

  const handleStatusUpdate = async (applicationId: string, status: string, notes: string) => {
    const previousApp = applications.find((app) => app.id === applicationId);
    setApplications((prev) =>
      prev.map((app) => (app.id === applicationId ? { ...app, status, notes } : app))
    );

    try {
      const response = await fetch(`/api/application/${applicationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });

      if (!response.ok) throw new Error("Failed to update status");
    } catch (error) {
      console.error("Failed to update application status:", error);
      if (previousApp) {
        setApplications((prev) =>
          prev.map((app) => (app.id === applicationId ? previousApp : app))
        );
      }
    }
  };

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
    } catch (error) {
      console.error("Failed to toggle saved status:", error);
      setApplications((prev) =>
        prev.map((app) => (app.id === applicationId ? { ...app, isSaved: !isSaved } : app))
      );
    }
  };

  // Merge full candidate details onto the lean list row for the modal
  const getEnrichedApplication = useCallback(
    (filteredIndex: number) => {
      const { app } = filteredWithIndices[filteredIndex];
      if (!app) return null;
      const full = fullCandidates[app.id];
      return {
        ...app,
        candidate: full
          ? {
              ...app.candidate,
              ...full,
            }
          : app.candidate,
      };
    },
    [filteredWithIndices, fullCandidates]
  );

  const filteredApplications = filteredWithIndices.map(({ app }) => app);

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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl border border-slate-200 bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
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

        {filteredApplications.length > 0 ? (
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

            {filteredWithIndices.map(({ app, originalIndex }) => {
              const enriched = getEnrichedApplication(originalIndex);
              const candidate = enriched?.candidate;

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
                      onClick={() => handleOpenModal(originalIndex)}
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
                Showing {filteredApplications.length} of {initialTotal} applicants
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
              {searchQuery || statusFilter !== "ALL"
                ? "No applicants match your filters"
                : "No applicants yet"}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {searchQuery || statusFilter !== "ALL"
                ? "Try adjusting your search or filters"
                : "Applicants for this job will appear here"}
            </p>
            {(searchQuery || statusFilter !== "ALL") && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                }}
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
        onClose={() => setIsModalOpen(false)}
        applications={filteredWithIndices.map(({ app }) => {
          const full = fullCandidates[app.id];
          if (!full) {
            const leanCandidate = app.candidate;
            return {
              ...app,
              candidate: leanCandidate
                ? { ...leanCandidate, languages: [], experiences: [], education: [], preferredJobTypes: [] }
                : undefined,
            };
          }
          return {
            ...app,
            candidate: full,
          };
        })}
        currentIndex={currentAppIndex}
        onNavigate={handleNavigate}
        onStatusUpdate={handleStatusUpdate}
        onToggleSaved={handleToggleSaved}
      />
    </div>
  );
}

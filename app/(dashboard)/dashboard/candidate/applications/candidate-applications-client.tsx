"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Briefcase, Clock, CheckCircle, XCircle, ExternalLink, ChevronDown, FileText } from "lucide-react";

interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  location: string | null;
}

interface JobOffer {
  id: string;
  title: string;
  slug: string;
  customLocation: string | null;
  contractType: string;
  isRemote: boolean;
  isHybrid: boolean;
  company: Company;
}

interface Application {
  id: string;
  status: string;
  coverLetter: string | null;
  cvUrl: string | null;
  createdAt: Date;
  jobOffer?: JobOffer;
}

interface CandidateApplicationsClientProps {
  applications: Application[];
  initialTotal: number;
  initialPage: number;
  pageSize: number;
}

export function CandidateApplicationsClient({
  applications: initialApplications,
  initialTotal,
  initialPage,
  pageSize,
}: CandidateApplicationsClientProps) {
  const [applications, setApplications] = useState(initialApplications);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const totalPages = Math.ceil(initialTotal / pageSize);

  // Filter applications based on search and status
  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      !searchQuery ||
      (app.jobOffer?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.jobOffer?.company?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.jobOffer?.customLocation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.jobOffer?.company?.location?.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesFilter = statusFilter === "ALL" || app.status === statusFilter;

    return matchesSearch && matchesFilter;
  });

  const loadPage = useCallback(
    async (pageNum: number) => {
      if (pageNum < 1 || pageNum > totalPages || loading) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/application?page=${pageNum}&limit=${pageSize}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (json.success) {
          setApplications(json.data);
          setPage(pageNum);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } finally {
        setLoading(false);
      }
    },
    [totalPages, pageSize, loading]
  );

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "nouveau":
        return <Clock className="h-4 w-4 text-amber-500" />;
      case "en_cours_examen":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "entretien":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "refuse":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "embauches":
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      default:
        return <Clock className="h-4 w-4 text-slate-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "nouveau":
        return "bg-amber-100 text-amber-800";
      case "en_cours_examen":
        return "bg-blue-100 text-blue-800";
      case "entretien":
        return "bg-green-100 text-green-800";
      case "refuse":
        return "bg-red-100 text-red-800";
      case "embauches":
        return "bg-emerald-100 text-emerald-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const formatStatus = (status: string) => {
    switch (status.toLowerCase()) {
      case "nouveau":
        return "New";
      case "en_cours_examen":
        return "In Review";
      case "entretien":
        return "Interview";
      case "refuse":
        return "Rejected";
      case "embauches":
        return "Hired";
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Applications</h1>
          <p className="text-slate-600">Track the status of your job applications</p>
        </div>
        <Link href="/jobs">
          <Button className="bg-[#071738] hover:bg-[#0d224d] text-white">
            Browse More Jobs
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex flex-1 items-center">
          <Search className="absolute left-3 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by job title, company, or location..."
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
              <option value="NOUVEAU">New</option>
              <option value="EN_COURS_EXAMEN">In Review</option>
              <option value="ENTRETIEN">Interview</option>
              <option value="EMBAUCHES">Hired</option>
              <option value="REFUSE">Rejected</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {filteredApplications.length > 0 ? (
        <div className="space-y-4">
          {filteredApplications.map((app) => (
            <Card key={app.id}>
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-4">
                    <div className="rounded-lg bg-slate-100 p-3">
                      <Briefcase className="h-6 w-6 text-slate-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{app.jobOffer?.title}</h3>
                      <p className="text-sm text-slate-500">{app.jobOffer?.company?.name}</p>
                      {(app.jobOffer?.customLocation || app.jobOffer?.company?.location) && (
                        <p className="text-xs text-slate-400 mt-1">
                          {app.jobOffer?.customLocation || app.jobOffer?.company?.location}
                          {app.jobOffer?.isRemote && " (Remote)"}
                          {app.jobOffer?.isHybrid && " (Hybrid)"}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-slate-400">Applied on {formatDate(app.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(app.status)}`}>
                      {getStatusIcon(app.status)}
                      {formatStatus(app.status)}
                    </span>
                    <Link href={`/jobs/${app.jobOffer?.slug}`}>
                      <Button variant="ghost" size="icon">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-slate-100 p-4">
              <FileText className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">
              {searchQuery || statusFilter !== "ALL"
                ? "No applications match your filters"
                : "No applications yet"}
            </h3>
            <p className="mt-2 text-center text-sm text-slate-500">
              {searchQuery || statusFilter !== "ALL"
                ? "Try adjusting your search or filters"
                : "Start applying to jobs to track your applications here"}
            </p>
            {searchQuery || statusFilter !== "ALL" ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                }}
                className="mt-6"
              >
                Clear Filters
              </Button>
            ) : (
              <Link href="/jobs" className="mt-6">
                <Button className="bg-[#071738] hover:bg-[#0d224d] text-white">
                  Find Jobs to Apply
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-500">
          Showing {filteredApplications.length} of {initialTotal} applications
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
    </div>
  );
}

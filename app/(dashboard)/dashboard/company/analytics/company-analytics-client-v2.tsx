"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CompanyAnalyticsData } from "@/types/company-analytics";
import {
  DoughnutChart,
  DoughnutSlice,
} from "@/components/analytics/doughnut-chart";
import {
  Briefcase,
  Eye,
  FileText,
  RefreshCw,
  ChevronDown,
  ArrowUpRight,
  Download,
} from "lucide-react";

const PERIOD_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 14, label: "Last 14 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

function KpiCard({
  icon: Icon,
  label,
  value,
  iconColor = "text-slate-600",
  bgColor = "bg-slate-100",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  iconColor?: string;
  bgColor?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <div className={`rounded-lg p-1.5 ${bgColor}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

const AGE_COLORS = ["#1D355E", "#42B883", "#1D355E", "#42B883", "#1D355E"];

export function CompanyAnalyticsClientV2({
  data,
  defaultDays = 30,
}: {
  data: CompanyAnalyticsData;
  defaultDays?: number;
}) {
  const router = useRouter();
  const [days, setDays] = useState(defaultDays);
  const [language, setLanguage] = useState<string>(data.period.language ?? "all");
  const [currentData, setCurrentData] = useState(data);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(
    async (newDays: number, newLang: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("days", String(newDays));
        params.set("language", newLang);
        const res = await fetch(`/api/dashboard/company/analytics?${params.toString()}`, {
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error("Failed to fetch analytics");
        const json = await res.json();
        if (json.success && json.data) {
          setCurrentData(json.data);
        } else {
          throw new Error(json.error || "Failed");
        }
      } catch {
        router.push(`/dashboard/company/analytics?days=${newDays}&language=${newLang}`);
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  const handlePeriodChange = useCallback(
    (newDays: number) => {
      setDays(newDays);
      fetchData(newDays, language);
    },
    [language, fetchData]
  );

  const handleLanguageChange = useCallback(
    (newLang: string) => {
      setLanguage(newLang);
      fetchData(days, newLang);
    },
    [days, fetchData]
  );

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("days", String(days));
      params.set("language", language);
      params.set("refresh", "true");
      const res = await fetch(`/api/dashboard/company/analytics?${params.toString()}`, {
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to refresh");
      const json = await res.json();
      if (json.success && json.data) {
        setCurrentData(json.data);
      }
    } catch {
      /* keep existing data */
    } finally {
      setLoading(false);
    }
  }, [days, language]);

  const handleExport = useCallback(() => {
    const params = new URLSearchParams();
    params.set("days", String(days));
    params.set("language", language);
    window.location.href = `/api/dashboard/company/analytics/export?${params.toString()}`;
  }, [days, language]);

  const { mainKpis, gender, age, jobPerformance, filters, period } = currentData;

  const genderSlices: DoughnutSlice[] = [
    ...(gender.male.count > 0
      ? [
          {
            label: "Male",
            value: gender.male.count,
            percentage: gender.male.percentage,
            color: "#1D355E",
          },
        ]
      : []),
    ...(gender.female.count > 0
      ? [
          {
            label: "Female",
            value: gender.female.count,
            percentage: gender.female.percentage,
            color: "#42B883",
          },
        ]
      : []),
  ];

  const ageBars = [
    { label: "18-24", count: age["18-24"] },
    { label: "25-34", count: age["25-34"] },
    { label: "35-44", count: age["35-44"] },
    { label: "45-55", count: age["45-55"] },
    { label: "55+", count: age["55+"] },
  ];
  const maxAgeCount = Math.max(...ageBars.map((a) => a.count), 1);

  return (
    <div className="space-y-8">
      {/* ─── Header + Filters ────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:items-center sm:justify-between sm:flex-row">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500">
            {period.language ? `${period.language} • ` : ""}
            {period.days}-day overview
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => handlePeriodChange(Number(e.target.value))}
            disabled={loading}
            className="appearance-none rounded-lg border border-slate-200 bg-white px-3.5 py-2 pr-9 text-sm text-slate-700 shadow-sm transition-colors focus:border-[#42B883] focus:outline-none focus:ring-1 focus:ring-[#42B883] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none -ml-9 relative h-4 w-4 -translate-y-1/2 text-slate-400" />

          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            disabled={loading}
            className="appearance-none rounded-lg border border-slate-200 bg-white px-3.5 py-2 pr-9 text-sm text-slate-700 shadow-sm transition-colors focus:border-[#42B883] focus:outline-none focus:ring-1 focus:ring-[#42B883] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="all">All Languages</option>
            {filters.availableLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none -ml-9 relative h-4 w-4 -translate-y-1/2 text-slate-400" />

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-[#42B883] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Refresh data"
            title="Refresh analytics"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#42B883] shadow-sm transition-colors hover:bg-[#42B883]/5 focus:outline-none focus:ring-1 focus:ring-[#42B883]"
            title="Export as Excel"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* ─── KPI Cards ─────────────────────────────────── */}
      <section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={Eye}
            label="Total Views"
            value={mainKpis.totalViews}
            iconColor="text-[#42B883]"
            bgColor="bg-[#42B883]/5"
          />
          <KpiCard
            icon={Briefcase}
            label="Total Job Listings"
            value={mainKpis.totalJobListings}
            iconColor="text-[#1D355E]"
            bgColor="bg-[#1D355E]/5"
          />
          <KpiCard
            icon={Briefcase}
            label="Active Job Listings"
            value={mainKpis.activeJobListings}
            iconColor="text-[#42B883]"
            bgColor="bg-[#42B883]/5"
          />
          <KpiCard
            icon={FileText}
            label="Received Applications"
            value={mainKpis.receivedApplications}
            iconColor="text-[#1D355E]"
            bgColor="bg-[#1D355E]/5"
          />
        </div>
      </section>

      {/* ─── Gender + Age ────────────────────────────── */}
      <section>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Gender Distribution */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Gender Distribution</h2>
            {gender.totalAnalyzed > 0 ? (
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center justify-center">
                  <DoughnutChart
                    data={genderSlices}
                    size={220}
                    strokeWidth={42}
                    centerLabel={String(gender.totalAnalyzed)}
                    centerSublabel="candidates"
                    emptyMessage="No gender data available"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-3 sm:ml-6">
                  {genderSlices.map((s) => (
                    <div key={s.label} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-lg font-medium text-slate-700">{s.label}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-900">{s.value}</span>
                        <span className="ml-2 text-xs text-slate-400">({s.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-slate-400">No gender data available</div>
            )}
          </div>

          {/* Age Distribution */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Age Distribution</h2>
            <div className="space-y-3">
              {ageBars.map((a, i) => (
                <div key={a.label} className="flex items-center gap-3">
                  <span className="w-12 text-lg font-medium text-slate-600">{a.label}</span>
                  <div className="flex-1">
                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(a.count / maxAgeCount) * 100}%`, backgroundColor: AGE_COLORS[i] }}
                      />
                    </div>
                  </div>
                  <span className="w-10 text-right text-sm font-semibold text-slate-900">{a.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Job Performance Table ─────────────────────── */}
      <section>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Job Performance</h2>
            <a
              href="/dashboard/company/jobs"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-[#42B883]"
            >
              Manage Jobs
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-6 py-3 font-semibold text-slate-600">#</th>
                  <th className="px-6 py-3 font-semibold text-slate-600">Job Title</th>
                  <th className="px-6 py-3 font-semibold text-slate-600">Language</th>
                  <th className="px-6 py-3 font-semibold text-slate-600">Location</th>
                  <th className="px-6 py-3 font-semibold text-slate-600">Views</th>
                  <th className="px-6 py-3 font-semibold text-slate-600">Applications</th>
                  <th className="px-6 py-3 font-semibold text-slate-600">Conversion</th>
                  <th className="px-6 py-3 font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {jobPerformance.length > 0 ? (
                  jobPerformance.map((job, index) => (
                    <tr key={job.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            index === 0
                              ? "bg-amber-100 text-amber-700"
                              : index === 1
                              ? "bg-slate-200 text-slate-700"
                              : index === 2
                              ? "bg-orange-100 text-orange-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-medium text-slate-900">{job.title}</td>
                      <td className="px-6 py-3 text-slate-600">{job.primaryLanguage}</td>
                      <td className="px-6 py-3 text-slate-600">{job.location || "—"}</td>
                      <td className="px-6 py-3 text-slate-900">{job.views}</td>
                      <td className="px-6 py-3">
                        <span className="text-base font-bold text-[#42B883]">{job.applications}</span>
                      </td>
                      <td className="px-6 py-3 text-slate-900">
                        {job.conversionRate > 0 ? `${job.conversionRate}%` : "N/A"}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                            job.status === "PUBLISHED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : job.status === "DRAFT"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : job.status === "ARCHIVED"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : job.status === "CLOSED"
                              ? "bg-slate-100 text-slate-600 border border-slate-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {job.status === "PUBLISHED" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          )}
                          {job.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-400">
                      No jobs found for the selected filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {loading && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-lg bg-white px-5 py-3 shadow-lg">
            <RefreshCw className="h-5 w-5 animate-spin text-[#42B883]" />
            <span className="text-sm font-medium text-slate-700">Refreshing analytics…</span>
          </div>
        </div>
      )}
    </div>
  );
}

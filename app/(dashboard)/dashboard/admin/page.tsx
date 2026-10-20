"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  FileText,
  Briefcase,
  Building2,
  Key,
  Download,
  Eye,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface OverviewData {
  landingPageUniqueVisitors: number;
  candidateAccounts: number;
  cvExports: number;
  totalApplications: number;
  hiredApplications: number;
  invitationTokensGenerated: number;
  totalCompanies: number;
  activeCompanies: number;
  totalJobListings: number;
  activeJobListings: number;
}

const fmt = (n: number) => n.toLocaleString();

const percent = (part: number, whole: number): string =>
  whole > 0 ? `${((part / whole) * 100).toFixed(1).replace(/\.0$/, "")}%` : "–";

const ratio = (part: number, whole: number): string =>
  whole > 0 ? (part / whole).toFixed(1).replace(/\.0$/, "") : "–";

const share = (part: number, whole: number): number =>
  whole > 0 ? Math.min(100, Math.max(0, (part / whole) * 100)) : 0;

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-6 border-t border-slate-200 py-10 lg:grid-cols-[240px_1fr] lg:gap-12">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 max-w-xs text-sm leading-relaxed text-slate-500">
          {description}
        </p>
      </div>
      <div>{children}</div>
    </section>
  );
}

function ActiveSplit({
  icon: Icon,
  label,
  active,
  total,
  barColor,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  active: number;
  total: number;
  barColor: string;
  iconColor: string;
}) {
  const activeShare = share(active, total);
  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Icon className={`h-4 w-4 ${iconColor}`} aria-hidden />
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tabular-nums tracking-tight text-slate-900">
          {fmt(active)}
        </span>
        <span className="text-sm text-slate-500">active of {fmt(total)}</span>
      </div>
      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={`${percent(active, total)} active`}
      >
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${activeShare}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>{percent(active, total)} active</span>
        <span>{fmt(Math.max(total - active, 0))} inactive</span>
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || "Failed to load overview data");
      }
    } catch {
      setError("Failed to load overview data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-4 pb-10 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 animate-pulse rounded bg-slate-200" />
              </CardContent>
            </Card>
          ))}
        </div>
        {[2, 2].map((cols, s) => (
          <div
            key={s}
            className="grid gap-6 border-t border-slate-200 py-10 lg:grid-cols-[240px_1fr] lg:gap-12"
          >
            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-48 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="grid gap-8 sm:grid-cols-2">
              {Array.from({ length: cols }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                  <div className="h-9 w-20 animate-pulse rounded bg-slate-200" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-5xl">
        <div
          role="alert"
          className="flex items-start gap-3 border-l-4 border-red-500 bg-red-50 px-4 py-4"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-800">
              {error ?? "Failed to load overview data"}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={fetchOverview}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const journey = [
    {
      icon: Eye,
      label: "Landing page visitors",
      value: data.landingPageUniqueVisitors,
      iconColor: "text-blue-600",
      note: "Unique anonymous browsers since tracking began.",
    },
    {
      icon: Users,
      label: "Candidate accounts",
      value: data.candidateAccounts,
      iconColor: "text-teal-600",
      note: `${percent(
        data.candidateAccounts,
        data.landingPageUniqueVisitors
      )} of visitors`,
    },
    {
      icon: FileText,
      label: "Applications",
      value: data.totalApplications,
      iconColor: "text-indigo-600",
      note: `${ratio(
        data.totalApplications,
        data.candidateAccounts
      )} per candidate account`,
    },
    {
      icon: CheckCircle,
      label: "Hired",
      value: data.hiredApplications,
      iconColor: "text-green-600",
      note: `${percent(
        data.hiredApplications,
        data.totalApplications
      )} of applications`,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-4 pb-10 sm:grid-cols-2 lg:grid-cols-4">
        {journey.map((step) => {
          const Icon = step.icon;
          return (
            <Card key={step.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  {step.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${step.iconColor}`} aria-hidden />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
                  {fmt(step.value)}
                </div>
                <p className="mt-1 text-xs text-slate-500">{step.note}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Section
        title="Companies and listings"
        description="The hiring side of the platform and how much of it is currently live."
      >
        <div className="grid gap-10 sm:grid-cols-2">
          <ActiveSplit
            icon={Building2}
            label="Companies"
            active={data.activeCompanies}
            total={data.totalCompanies}
            barColor="bg-emerald-500"
            iconColor="text-emerald-600"
          />
          <ActiveSplit
            icon={Briefcase}
            label="Job listings"
            active={data.activeJobListings}
            total={data.totalJobListings}
            barColor="bg-cyan-500"
            iconColor="text-cyan-600"
          />
        </div>
        <p className="mt-8 border-t border-slate-100 pt-4 text-sm text-slate-500">
          <span className="font-medium text-slate-700">
            {ratio(data.activeJobListings, data.activeCompanies)}
          </span>{" "}
          active listings per active company ·{" "}
          <span className="font-medium text-slate-700">
            {ratio(data.totalApplications, data.activeJobListings)}
          </span>{" "}
          applications per active listing
        </p>
      </Section>

      <Section
        title="Platform activity"
        description="Actions that show candidates and companies engaging beyond sign-up."
      >
        <dl className="divide-y divide-slate-100">
          <div className="flex items-start justify-between gap-6 py-4 first:pt-0">
            <div className="flex gap-3">
              <Download
                className="mt-1 h-4 w-4 shrink-0 text-purple-600"
                aria-hidden
              />
              <div>
                <dt className="text-sm font-medium text-slate-900">CV exports</dt>
                <dd className="mt-0.5 text-sm text-slate-500">
                  Recorded authorized exports since tracking began ·{" "}
                  {ratio(data.cvExports, data.candidateAccounts)} per candidate
                </dd>
              </div>
            </div>
            <div className="text-2xl font-semibold tabular-nums text-slate-900">
              {fmt(data.cvExports)}
            </div>
          </div>
          <div className="flex items-start justify-between gap-6 py-4 last:pb-0">
            <div className="flex gap-3">
              <Key
                className="mt-1 h-4 w-4 shrink-0 text-amber-600"
                aria-hidden
              />
              <div>
                <dt className="text-sm font-medium text-slate-900">
                  Invitation tokens generated
                </dt>
                <dd className="mt-0.5 text-sm text-slate-500">
                  {ratio(data.invitationTokensGenerated, data.totalCompanies)}{" "}
                  per company
                </dd>
              </div>
            </div>
            <div className="text-2xl font-semibold tabular-nums text-slate-900">
              {fmt(data.invitationTokensGenerated)}
            </div>
          </div>
        </dl>
      </Section>
    </div>
  );
}
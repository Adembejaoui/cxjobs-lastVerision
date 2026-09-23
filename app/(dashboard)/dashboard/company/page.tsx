/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Briefcase,
  Users,
  FileText,
  PlusCircle,
  Calendar,
  CheckCircle,
  XCircle,
  Archive,
  Edit,
  TrendingUp,
  Building2,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  NOUVEAU: "New",
  EN_COURS_EXAMEN: "In Review",
  ENTRETIEN: "Interview",
  EMBAUCHES: "Hired",
  REFUSE: "Rejected",
};

const APPLICATION_STATUS_BADGE: Record<
  string,
  "success" | "warning" | "destructive" | "secondary" | "outline" | "default"
> = {
  NOUVEAU: "warning",
  EN_COURS_EXAMEN: "secondary",
  ENTRETIEN: "default",
  EMBAUCHES: "success",
  REFUSE: "destructive",
};

interface JobStatusCardConfig {
  label: string;
  icon: LucideIcon;
  iconBgColor: string;
  iconColor: string;
}

const JOB_STATUS_CARDS: Record<string, JobStatusCardConfig> = {
  PUBLISHED: {
    label: "Published",
    icon: CheckCircle,
    iconBgColor: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
  ARCHIVED: {
    label: "Archived",
    icon: Archive,
    iconBgColor: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  CLOSED: {
    label: "Closed",
    icon: XCircle,
    iconBgColor: "bg-slate-100",
    iconColor: "text-slate-600",
  },
  DRAFT: {
    label: "Draft",
    icon: Edit,
    iconBgColor: "bg-amber-100",
    iconColor: "text-amber-600",
  },
};

interface StatCardConfig {
  label: string;
  icon: LucideIcon;
  color: string;
}

const STAT_CARDS: StatCardConfig[] = [
  { label: "Active Jobs", icon: Briefcase, color: "text-teal-600" },
  { label: "Total Applicants", icon: Users, color: "text-blue-600" },
  { label: "Total Jobs", icon: FileText, color: "text-purple-600" },
  { label: "New Applications", icon: TrendingUp, color: "text-green-600" },
];

interface QuickActionConfig {
  label: string;
  icon: LucideIcon;
  href: string;
}

const QUICK_ACTIONS: QuickActionConfig[] = [
  {
    label: "Create Job Offer",
    icon: PlusCircle,
    href: "/dashboard/company/jobs?create=true",
  },
  {
    label: "Manage Job Offers",
    icon: Briefcase,
    href: "/dashboard/company/jobs",
  },
  {
    label: "Update Company Profile",
    icon: Building2,
    href: "/dashboard/company/profile",
  },
  {
    label: "View Analytics",
    icon: ChartNoAxesCombined,
    href: "/dashboard/company/analytics",
  },
];

interface RecentApplication {
  id: string;
  status: string;
  createdAt: Date;
  candidate: {
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    user: {
      name: string | null;
      email: string;
      image: string | null;
    };
  };
  jobOffer: {
    id: string;
    title: string;
    customLocation: string | null;
  };
}

const PAGE_SIZE = 10;

function getCandidateName(application: RecentApplication): string {
  const { user, firstName, lastName } = application.candidate;
  if (user?.name) return user.name;
  const parts = [firstName, lastName].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return user.email;
}

function getCandidateAvatar(application: RecentApplication): string | null {
  return application.candidate.user.image || application.candidate.avatarUrl;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 1) return `${diffDays} days ago`;
  if (diffDays === 1) return "1 day ago";
  if (diffHours > 1) return `${diffHours} hours ago`;
  if (diffHours === 1) return "1 hour ago";
  if (diffMins > 1) return `${diffMins} minutes ago`;
  return "just now";
}

function getApplicationStatusLabel(status: string): string {
  return APPLICATION_STATUS_LABELS[status] ?? status;
}

function getApplicationStatusBadgeVariant(
  status: string,
): "success" | "warning" | "destructive" | "secondary" | "outline" | "default" {
  return APPLICATION_STATUS_BADGE[status] ?? "secondary";
}

interface SearchParams {
  page?: string | string[] | undefined;
}

export default async function CompanyDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();

  if (!session || session.user.role !== "COMPANY") {
    redirect("/login");
  }

  const company = await prisma.companies.findUnique({
    where: { userId: session.user.id },
    select: { id: true, name: true },
  });

  if (!company) {
    redirect("/onboarding/company");
  }

  const sp = await searchParams;
  const pageParam = sp.page;
  const currentPage = Array.isArray(pageParam)
    ? parseInt(pageParam[0] ?? "1", 10)
    : parseInt(pageParam ?? "1", 10);
  const safePage = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1;
  const skip = (safePage - 1) * PAGE_SIZE;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [
    jobStats,
    totalApplications,
    totalJobs,
    newApplicationsCount,
    recentApplicationsResult,
    totalNewApplications,
  ] = await Promise.all([
    prisma.jobOffer.groupBy({
      by: ["status"],
      where: {
        companyId: company.id,
        deletedAt: null,
      },
      _count: { _all: true },
    }),
    prisma.application.count({
      where: {
        jobOffer: { companyId: company.id },
      },
    }),
    prisma.jobOffer.count({
      where: {
        companyId: company.id,
        deletedAt: null,
      },
    }),
    prisma.application.count({
      where: {
        jobOffer: { companyId: company.id },
        createdAt: { gte: weekAgo },
      },
    }),
    prisma.application.findMany({
      where: {
        jobOffer: { companyId: company.id },
        status: "NOUVEAU",
      },
      take: PAGE_SIZE,
      skip,
      orderBy: { createdAt: "desc" },
      include: {
        candidate: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        jobOffer: {
          select: {
            id: true,
            title: true,
            customLocation: true,
          },
        },
      },
    }),
    prisma.application.count({
      where: {
        jobOffer: { companyId: company.id },
        status: "NOUVEAU",
      },
    }),
  ]);

  const jobStatsMap: Record<string, number> = {
    DRAFT: 0,
    PUBLISHED: 0,
    ARCHIVED: 0,
    CLOSED: 0,
    EXPIRED: 0,
  };

  for (const stat of jobStats) {
    jobStatsMap[stat.status as keyof typeof jobStatsMap] = stat._count._all;
  }

  const recentApplicationsTyped =
    recentApplicationsResult as unknown as RecentApplication[];

  const totalPages = Math.ceil(totalNewApplications / PAGE_SIZE);

  const buildPageUrl = (pageNum: number) =>
    `/dashboard/company?page=${pageNum}`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600">
            Welcome back to {company.name}! Here&apos;s your company overview.
          </p>
        </div>
      
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((stat) => {
          const Icon = stat.icon;
          const value =
            stat.label === "Active Jobs"
              ? jobStatsMap.PUBLISHED
              : stat.label === "Total Applicants"
                ? totalApplications
                : stat.label === "Total Jobs"
                  ? totalJobs
                  : newApplicationsCount;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  {stat.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">{value}</div>
                {stat.label === "New Applications" && (
                  <p className="text-xs text-slate-500">
                    Applications received in the last 7 days
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions + Job Offer Status Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Quick access to your most used actions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  href={action.href}
                  key={action.label}
                  className="block"
                >
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {action.label}
                  </Button>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {/* Job Offer Status Cards - vertical stack */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">
            Job Offer Status
          </h2>
          <div className="space-y-4">
            {Object.entries(JOB_STATUS_CARDS).map(([status, config]) => {
              const Icon = config.icon;
              const count = jobStatsMap[status] ?? 0;
              return (
                <Card
                  key={status}
                  className="border border-slate-200 transition-shadow hover:shadow-md"
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600">
                          {config.label}
                        </p>
                        <p className="mt-1 text-3xl font-bold text-slate-900">
                          {count}
                        </p>
                      </div>
                      <div
                        className={`rounded-full ${config.iconBgColor} p-3`}
                      >
                        <Icon
                          className={`h-5 w-5 ${config.iconColor}`}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Applications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Applications</CardTitle>
              <CardDescription>
                New applications received (status: New)
              </CardDescription>
            </div>
            <Link href="/dashboard/company/jobs">
              <Button
                variant="ghost"
                size="sm"
                className="text-[#47d79d] hover:text-[#0d224d]"
              >
                <Calendar className="mr-2 h-4 w-4" />
                View All Applications
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentApplicationsTyped.length > 0 ? (
            <div className="space-y-4">
              {recentApplicationsTyped.map((app) => {
                const candidateName = getCandidateName(app);
                const avatarUrl = getCandidateAvatar(app);
                const statusLabel = getApplicationStatusLabel(app.status);
                const statusVariant = getApplicationStatusBadgeVariant(
                  app.status,
                );
                const time = timeAgo(app.createdAt);

                return (
                  <div
                    key={app.id}
                    className="flex items-center gap-4 rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50"
                  >
                    <Avatar className="h-10 w-10">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={candidateName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <AvatarFallback>
                          {getInitials(candidateName)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {candidateName}
                      </p>
                      <p className="text-sm text-slate-500 truncate">
                        {app.jobOffer.title}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge variant={statusVariant} className="text-xs">
                        {statusLabel}
                      </Badge>
                      <p className="text-xs text-slate-500">{time}</p>
                      <p className="hidden text-xs text-slate-400 sm:inline">
                        {new Date(app.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Users className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">
                No new applications yet.
              </p>
            </div>
          )}
        </CardContent>
        {totalPages > 1 && (
          <CardFooter className="flex items-center justify-between border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Showing {recentApplicationsTyped.length} of {totalNewApplications}{" "}
              applications
            </span>
            <div className="flex items-center gap-2">
              {safePage > 1 && (
                <Link href={buildPageUrl(safePage - 1)}>
                  <Button variant="outline" size="sm">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </Link>
              )}
              <span className="text-sm text-slate-700">
                Page {safePage} of {totalPages}
              </span>
              {safePage < totalPages && (
                <Link href={buildPageUrl(safePage + 1)}>
                  <Button variant="outline" size="sm">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

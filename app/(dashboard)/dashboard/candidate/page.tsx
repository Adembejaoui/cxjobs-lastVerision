/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  FileText,
  Bookmark,
  Search,
  Briefcase,
  Calendar,
  CheckCircle,
  Clock,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { CardFooter } from "@/components/ui/card";
import { getAllCareerGuides } from "@/lib/career-guides";

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

interface StatCardConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  getValue: (
    total: number,
    statsMap: Record<string, number>,
    savedCount: number,
  ) => number;
}

const STAT_CARDS: StatCardConfig[] = [
  {
    label: "Applications Sent",
    icon: FileText,
    color: "text-teal-600",
    getValue: (total) => total,
  },
  {
    label: "Saved Jobs",
    icon: Bookmark,
    color: "text-blue-600",
    getValue: (_total, _stats, saved) => saved,
  },
  {
    label: "In Review",
    icon: Clock,
    color: "text-amber-600",
    getValue: (_total, stats) =>
      (stats.NOUVEAU ?? 0) + (stats.EN_COURS_EXAMEN ?? 0),
  },
  {
    label: "Hired",
    icon: CheckCircle,
    color: "text-green-600",
    getValue: (_total, stats) => stats.EMBAUCHES ?? 0,
  },
];

interface QuickActionConfig {
  label: string;
  icon: LucideIcon;
  href: string;
}

const QUICK_ACTIONS: QuickActionConfig[] = [
  { label: "Search for Jobs", icon: Search, href: "/jobs" },
  {
    label: "View My Applications",
    icon: Briefcase,
    href: "/dashboard/candidate/applications",
  },
  { label: "Update Profile", icon: Bookmark, href: "/dashboard/candidate/profile" },
];

interface RecentApplication {
  id: string;
  status: string;
  createdAt: Date;
  jobOffer: {
    id: string;
    title: string;
    customLocation: string | null;
    company: {
      id: string;
      name: string;
      logoUrl: string | null;
    };
  };
}

function getApplicationStatusLabel(status: string): string {
  return APPLICATION_STATUS_LABELS[status] ?? status;
}

function getApplicationStatusBadgeVariant(
  status: string,
): "success" | "warning" | "destructive" | "secondary" | "outline" | "default" {
  return APPLICATION_STATUS_BADGE[status] ?? "secondary";
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

function getCompanyLogo(company: RecentApplication["jobOffer"]["company"]): string | null {
  return company.logoUrl || null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default async function CandidateDashboardPage() {
  const session = await auth();

  if (!session || session.user.role !== "CANDIDATE") {
    redirect("/login");
  }

  const candidate = await prisma.candidate.findUnique({
    where: { userId: session.user.id },
    select: { id: true, firstName: true, lastName: true, headline: true },
  });

  if (!candidate) {
    redirect("/onboarding/candidate");
  }

  const [applicationStats, totalApplications, savedCount, recentApplicationsResult] =
    await Promise.all([
      prisma.application.groupBy({
        by: ["status"],
        where: { candidateId: candidate.id },
        _count: { _all: true },
      }),
      prisma.application.count({
        where: { candidateId: candidate.id },
      }),
      prisma.application.count({
        where: { candidateId: candidate.id, isSaved: true },
      }),
      prisma.application.findMany({
        where: { candidateId: candidate.id },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          jobOffer: {
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                  logoUrl: true,
                },
              },
            },
          },
        },
      }),
    ]);

  const statsMap: Record<string, number> = {
    NOUVEAU: 0,
    EN_COURS_EXAMEN: 0,
    ENTRETIEN: 0,
    EMBAUCHES: 0,
    REFUSE: 0,
  };

  for (const stat of applicationStats) {
    statsMap[stat.status as keyof typeof statsMap] = stat._count._all;
  }

  const recentApplications =
    recentApplicationsResult as unknown as RecentApplication[];

  // Career Guides data (static, no DB needed)
  const careerGuides = getAllCareerGuides();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Dashboard</h1>
          <p className="text-slate-600">
            Track your job applications and activity.
          </p>
        </div>
        <Link href="/jobs">
          <Button className="bg-[#071738] hover:bg-[#0d224d] text-white">
            <Search className="mr-2 h-4 w-4" />
            Browse Jobs
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((stat) => {
          const Icon = stat.icon;
          const value = stat.getValue(totalApplications, statsMap, savedCount);
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
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions & Recent Applications */}
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

        {/* Recent Applications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Applications</CardTitle>
                <CardDescription>
                  Your latest job applications
                </CardDescription>
              </div>
              {recentApplications.length > 0 && (
                <Link href="/dashboard/candidate/applications">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#47d79d] hover:text-[#0d224d]"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    View All Applications
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {recentApplications.length > 0 ? (
              <div className="space-y-4">
                {recentApplications.map((app) => {
                  const company = app.jobOffer.company;
                  const logoUrl = getCompanyLogo(company);
                  const statusLabel = getApplicationStatusLabel(app.status);
                  const statusVariant =
                    getApplicationStatusBadgeVariant(app.status);
                  const time = timeAgo(app.createdAt);

                  return (
                    <div
                      key={app.id}
                      className="flex items-center gap-4 rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt={company.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            className={`flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600`}
                          >
                            {getInitials(company.name)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {app.jobOffer.title}
                        </p>
                        <p className="text-sm text-slate-500 truncate">
                          {company.name}
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
                <FileText className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">
                  No applications yet. Start browsing jobs to apply!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Career Guide Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Career Guide</h2>
            <p className="text-slate-600">
              Expert advice to improve your job search and career
            </p>
          </div>
          <Link href="/career-guide">
            <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700">
              View All Guides
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {careerGuides.map((guide) => {
            const Icon = guide.icon;
            return (
              <Link
                key={guide.slug}
                href={`/career-guide/${guide.slug}`}
                className="block"
              >
                <Card className={`h-full transition-all duration-300 hover:shadow-lg border-slate-200 ${guide.bgColor}`}>
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div
                        className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${guide.color.replace("text-", "bg-").replace("600", "100")} ${guide.color} group-hover:scale-110 transition-transform`}
                      >
                        <Icon className="h-6 w-6" strokeWidth={2} />
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-slate-500">
                        <Clock className="h-4 w-4" />
                        <span>{guide.readingTime}</span>
                      </div>
                    </div>
                    <CardTitle className="mt-4 text-lg font-semibold text-slate-900 group-hover:text-teal-600 transition-colors">
                      {guide.title}
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-600">
                      {guide.shortDescription}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-2 text-sm text-slate-600" role="list">
                      {guide.sections.slice(0, 3).map((section, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                          {section.title}
                        </li>
                      ))}
                      {guide.sections.length > 3 && (
                        <li className="flex items-center gap-2 text-teal-600 font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                          +{guide.sections.length - 3} more topics
                        </li>
                      )}
                    </ul>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-slate-100">
                    <Button
                      variant="outline"
                      className="w-full group-hover:bg-teal-50 group-hover:border-teal-300 group-hover:text-teal-700 transition-colors"
                    >
                      Read Guide
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </CardFooter>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
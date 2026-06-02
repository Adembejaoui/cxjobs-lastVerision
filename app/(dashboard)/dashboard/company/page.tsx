import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Briefcase, 
  Users, 
  Eye, 
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  PlusCircle
} from "lucide-react";
import { JobPostFlow } from "@/components/dashboard/job-post-flow";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function CompanyDashboardPage() {
  const session = await auth();

  if (!session || session.user.role !== "COMPANY") {
    redirect("/login");
  }

  // Mock stats - in real app, fetch from database
  const stats = [
    { label: "Active Jobs", value: 0, icon: Briefcase, color: "text-teal-600" },
    { label: "Total Applicants", value: 0, icon: Users, color: "text-blue-600" },
    { label: "Profile Views", value: 0, icon: Eye, color: "text-purple-600" },
    { label: "Hiring Rate", value: "0%", icon: TrendingUp, color: "text-green-600" },
  ];

  const recentActivity = [
    { id: 1, type: "application", message: "New application for Senior React Developer", time: "2 hours ago" },
    { id: 2, type: "view", message: "Your company profile was viewed", time: "5 hours ago" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600">Welcome back! Here's what's happening with your jobs.</p>
        </div>
<JobPostFlow
  trigger={
    <span className="flex items-center gap-2 rounded-xl bg-[#071738] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#071738]/20 hover:bg-[#0d224d] transition-colors">
      Post New Job
    </span>
  }
/>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  {stat.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-slate-500">
                  +0% from last month
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/dashboard/company/jobs/new" className="block">
              <Button variant="outline" className="w-full justify-start">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New Job Listing
              </Button>
            </Link>
            <Link href="/dashboard/company/applicants" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                View All Applicants
              </Button>
            </Link>
            <Link href="/dashboard/company/profile" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Briefcase className="mr-2 h-4 w-4" />
                Update Company Profile
              </Button>
            </Link>
            <Link href="/dashboard/company/analytics" className="block">
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="mr-2 h-4 w-4" />
                View Analytics
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="mt-1">
                      {activity.type === "application" ? (
                        <Users className="h-4 w-4 text-[#47d79d]" />
                      ) : (
                        <Eye className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-700">{activity.message}</p>
                      <p className="text-xs text-slate-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No recent activity. Start by posting a job!
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Job Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Job Status Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-4">
              <div className="rounded-full bg-green-100 p-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">0</p>
                <p className="text-sm text-slate-500">Active Jobs</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-4">
              <div className="rounded-full bg-amber-100 p-2">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">0</p>
                <p className="text-sm text-slate-500">Pending Review</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-4">
              <div className="rounded-full bg-red-100 p-2">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">0</p>
                <p className="text-sm text-slate-500">Closed Jobs</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

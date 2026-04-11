import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Calendar, Eye } from "lucide-react";
import Link from "next/link";
import { CompanyProfileForm } from "@/components/dashboard/company-profile-form";

export default async function CompanyProfilePage() {
  const session = await auth();

  if (!session || session.user.role !== "COMPANY") {
    redirect("/login");
  }

  // Fetch company data with all fields
  const company = await prisma.company.findFirst({
    where: {
      userId: session.user.id,
    },
    include: {
      user: true,
      benefits: true,
      _count: {
        select: { jobs: true },
      },
    },
  });

  if (!company) {
    // If no company exists, redirect to onboarding
    redirect("/onboarding/company");
  }

  // Get active jobs count
  const activeJobsCount = await prisma.jobOffer.count({
    where: {
      companyId: company.id,
      status: "PUBLISHED",
      deletedAt: null,
    },
  });

  // Get total applicants count
  const totalApplicantsCount = await prisma.application.count({
    where: {
      jobOffer: {
        companyId: company.id,
      },
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Company Profile</h1>
          <p className="text-slate-600">Manage your company information and public profile</p>
        </div>
        <Link href={`/companies/${company.slug}`}>
          <Button variant="outline" className="gap-2">
            <Eye className="h-4 w-4" />
            View Public Profile
          </Button>
        </Link>
      </div>

      {/* Profile Preview Card */}
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            {/* Logo */}
            <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-[#071738] text-2xl font-bold text-white overflow-hidden">
              {company.logoUrl ? (
                <img 
                  src={company.logoUrl} 
                  alt={company.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                company.name.charAt(0).toUpperCase()
              )}
            </div>
            
            {/* Company Info */}
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-slate-900">{company.name}</h2>
              <p className="text-sm text-slate-500">{company.industry || "Industry not set"}</p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                {company.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {company.location}
                  </span>
                )}
                {company.companySize && (
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {getCompanySizeDisplay(company.companySize)}
                  </span>
                )}
                {company.foundedYear && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Founded {company.foundedYear}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-2xl font-bold text-slate-900">{activeJobsCount}</p>
                <p className="text-xs text-slate-500">Active Jobs</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{totalApplicantsCount}</p>
                <p className="text-xs text-slate-500">Total Applicants</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Form */}
      <CompanyProfileForm company={company} />
    </div>
  );
}

function getCompanySizeDisplay(size: string | null): string {
  switch (size) {
    case 'STARTUP':
      return '1-10 employees';
    case 'SMALL':
      return '11-50 employees';
    case 'MEDIUM':
      return '51-200 employees';
    case 'LARGE':
      return '201-1000 employees';
    case 'ENTERPRISE':
      return '1000+ employees';
    default:
      return 'Size not set';
  }
}

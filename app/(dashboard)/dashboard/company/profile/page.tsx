import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Calendar, Eye } from "lucide-react";
import Link from "next/link";
import { CompanyProfileForm } from "@/components/dashboard/company-profile-form";
import { CompanyBenefit } from "@/app/generated/prisma/client";
import { Prisma } from "@/app/generated/prisma/client";

/* eslint-disable @next/next/no-img-element */

interface SearchParams {
  welcome?: string;
}

interface Company {
  id: string;
  userId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  companySize: string | null;
  location: string | null;
  website: string | null;
  foundedYear: number | null;
  description: string | null;
  culture: string | null;
  isRemoteFriendly: boolean;
  isHybridFriendly: boolean;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  facebookUrl: string | null;
  emailCompany: string | null;
  isVerified: boolean;
  verifiedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  benefits: Omit<CompanyBenefit, 'companyId'>[];
}

const COMPANY_SELECT = {
  id: true,
  userId: true,
  name: true,
  slug: true,
  logoUrl: true,
  coverImageUrl: true,
  companySize: true,
  location: true,
  website: true,
  foundedYear: true,
  description: true,
  culture: true,
  isRemoteFriendly: true,
  isHybridFriendly: true,
  linkedinUrl: true,
  twitterUrl: true,
  facebookUrl: true,
  emailCompany: true,
  isVerified: true,
  verifiedAt: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  benefits: {
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      category: true,
      scope: true,
      createdAt: true,
      updatedAt: true,
    },
  },
};

export default async function CompanyProfilePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();

  if (!session || session.user.role !== "COMPANY") {
    redirect("/login");
  }

  const sp = await searchParams;
  const showWelcome = sp.welcome === "1";

  const userId = session.user.id;
  const baseName = session.user.name || "My Company";
  const slugBase = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Generate a sufficiently unique slug upfront to minimize collisions.
  // 4 random bytes (8 hex chars) provides 2^32 possibilities.
  const generateSlug = (attempt: number): string => {
    const suffix = crypto.randomBytes(4).toString("hex");
    return attempt === 0 ? slugBase : `${slugBase}-${suffix}`;
  };

  // Atomic upsert: single round-trip, uses PostgreSQL INSERT ... ON CONFLICT (userId).
  // If another request created the company concurrently, the ON CONFLICT DO UPDATE
  // with empty update{} returns the existing row without modifying it.
  let company: Company | null = null;
  let slug = generateSlug(0);
  let slugAttempts = 0;
  const maxSlugAttempts = 3;

  while (true) {
    try {
      company = await prisma.companies.upsert({
        where: { userId },
        create: { userId, name: baseName, slug },
        update: {},
        select: COMPANY_SELECT,
      });
      break;
    } catch (error) {
      // Handle unique constraint violations
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = (error.meta?.target as string[]) || [];
        
        if (target.includes("userId")) {
          // Another request created the company for this userId.
          // Fetch and return the existing company without overwriting it.
          const existing = await prisma.companies.findUnique({
            where: { userId },
            select: COMPANY_SELECT,
          });
          if (existing) {
            company = existing;
            break;
          }
          // Fall through to re-throw if not found (should not happen)
        } else if (target.includes("slug") && slugAttempts < maxSlugAttempts) {
          // Slug collision - generate new slug and retry
          slugAttempts++;
          slug = generateSlug(slugAttempts);
          continue;
        }
      }
      throw error;
    }
  }

  // Both counts depend only on the already-resolved company.id, so they are run
  // concurrently. The pool allows this (see lib/prisma.ts).
  const [activeJobsCount, totalApplicantsCount] = await Promise.all([
    prisma.jobOffer.count({
      where: {
        companyId: company.id,
        status: "PUBLISHED",
        deletedAt: null,
      },
    }),
    prisma.application.count({
      where: {
        jobOffer: {
          companyId: company.id,
        },
      },
    }),
  ]);

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
            <div className="flex h-28 w-28 items-center justify-center rounded-lg bg-white border border-slate-200 overflow-hidden">
              {company.logoUrl ? (
                <img 
                  src={company.logoUrl} 
                  alt={company.name}
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                company.name.charAt(0).toUpperCase()
              )}
            </div>
            
            {/* Company Info */}
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-slate-900">{company.name}</h2>
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

      {/* Benefits Preview */}
      
      {/* Edit Form */}
      <CompanyProfileForm company={company} showWelcome={showWelcome} />
    </div>
  );
}
function getCompanySizeDisplay(size: string | null): string {
  return size || 'Size not set';
}

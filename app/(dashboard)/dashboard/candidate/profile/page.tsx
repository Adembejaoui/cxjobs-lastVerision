import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, User, Mail, MapPin, FileText,FileCheck } from "lucide-react";
import Link from "next/link";
import { CandidateProfileForm } from "@/components/dashboard/candidate-profile-form";
import type { Prisma } from "@/app/generated/prisma/client";

type CandidateWithRelations = Prisma.CandidateGetPayload<{
  include: {
    user: { select: { email: true } };
    experiences: { orderBy: { startDate: "desc" } };
    education: { orderBy: { startDate: "desc" } };
    languages: true;
    skills: true;
  };
}>;

function getMissingPreferences(candidate: {
  preferredJobTypes?: string[];
  targetJobRole?: string;
  workMode?: string;
  shiftType?: string;
}): string[] {
  const missing: string[] = [];
  
  if (!candidate.preferredJobTypes || candidate.preferredJobTypes.length === 0) {
    missing.push("Preferred job types");
  }
  if (!candidate.targetJobRole) {
    missing.push("Target job role");
  }
  if (!candidate.workMode) {
    missing.push("Work mode preference");
  }
  if (!candidate.shiftType) {
    missing.push("Shift type preference");
  }
  
  return missing;
}

function calculateProfileCompletion(candidate: {
  headline?: string | null;
  summary?: string | null;
  location?: string | null;
  resumeUrl?: string | null;
  linkedinUrl?: string | null;
  experiences?: unknown[];
  education?: unknown[];
  skills?: unknown[];
}): number {
  let completed = 0;
  const total = 8;

  if (candidate.headline) completed++;
  if (candidate.summary) completed++;
  if (candidate.location) completed++;
  if (candidate.resumeUrl) completed++;
  if (candidate.linkedinUrl) completed++;
  if (candidate.experiences?.length) completed++;
  if (candidate.education?.length) completed++;
  if (candidate.skills?.length) completed++;

  return Math.round((completed / total) * 100);
}

export default async function CandidateProfilePage() {
  const session = await auth();

  if (!session || session.user.role !== "CANDIDATE") {
    redirect("/login");
  }

  const candidate = await prisma.candidate.findUnique({
    where: {
      userId: session.user.id,
    },
    include: {
      user: { select: { email: true } },
      experiences: {
        orderBy: { startDate: 'desc' }
      },
      education: {
        orderBy: { startDate: 'desc' }
      },
      languages: true,
      skills: true,
    },
  }) as CandidateWithRelations | null;

  if (!candidate) {
    // If no candidate profile exists, redirect to onboarding
    redirect("/onboarding/candidate");
  }

  // Calculate profile completion
  const profileCompletion = calculateProfileCompletion(candidate);

  // Check for missing preferences
  const missingPreferences = getMissingPreferences({
    preferredJobTypes: candidate.preferredJobTypes ?? undefined,
    targetJobRole: candidate.targetJobRole ?? undefined,
    workMode: candidate.workMode ?? undefined,
    shiftType: candidate.shiftType ?? undefined,
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
          <p className="text-slate-600">Manage your profile and resume</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/candidate/cv">
            <Button variant="outline" className="gap-2">
              <FileCheck className="h-4 w-4" />
              View CV
            </Button>
          </Link>
        </div>
      </div>

      {/* Missing Preferences Alert */}
      {missingPreferences.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800">Missing Job Preferences</h3>
                <p className="text-sm text-amber-700 mt-1">
                  To get better job recommendations and improve your profile, please add:
                </p>
                <ul className="text-sm text-amber-700 mt-2 list-disc list-inside space-y-1">
                  {missingPreferences.map((pref) => (
                    <li key={pref}>{pref}</li>
                  ))}
                </ul>
                <Link href="/dashboard/candidate/profile?tab=preferences" className="inline-block mt-3">
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                    Add Preferences
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile Preview Card */}
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            {/* Avatar */}
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#47d79d] text-2xl font-bold text-[#071738]">
              {candidate.firstName?.charAt(0).toUpperCase() || 
               candidate.user?.email?.charAt(0).toUpperCase() || 
               "U"}
            </div>
            
            {/* Candidate Info */}
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-slate-900">
                {candidate.firstName && candidate.lastName 
                  ? `${candidate.firstName} ${candidate.lastName}` 
                  : candidate.firstName || "Your Name"}
              </h2>
              <p className="text-sm text-slate-500">{candidate.headline || "Add a headline"}</p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                {candidate.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {candidate.location}
                  </span>
                )}
                {candidate.user?.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {candidate.user.email}
                  </span>
                )}
              </div>
            </div>

            {/* Profile Completion */}
            <div className="text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full border-4 border-slate-100">
                <span className="text-xl font-bold text-slate-900">
                  {profileCompletion}%
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Profile Complete</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Statistics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{candidate.experiences?.length || 0}</p>
                <p className="text-xs text-slate-500">Experiences</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <User className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{candidate.education?.length || 0}</p>
                <p className="text-xs text-slate-500">Education</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2">
                <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold">{candidate.languages?.length || 0}</p>
                <p className="text-xs text-slate-500">Languages</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2">
                <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold">{candidate.skills?.length || 0}</p>
                <p className="text-xs text-slate-500">Skills</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Form */}
      <CandidateProfileForm candidate={candidate as unknown as Parameters<typeof CandidateProfileForm>[0]["candidate"]} />
    </div>
  );
}

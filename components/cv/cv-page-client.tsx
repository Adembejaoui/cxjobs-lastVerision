"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CVContent } from "@/components/cv/cv-content";
import { PDFDownloadButton } from "@/components/cv/pdf-download-button";

interface Experience {
  id: string;
  company: string;
  title: string;
  location: string | null;
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
  description: string | null;
}

interface Education {
  id: string;
  school: string;
  degree: string;
  fieldOfStudy: string | null;
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
}

interface Language {
  id: string;
  name: string;
  proficiency: string;
}

interface Skill {
  id: string;
  name: string;
  level: string | null;
}

interface Candidate {
  id: string;
  firstName: string | null;
  lastName: string | null;
  summary: string | null;
  location: string | null;
  phone: string | null;
  avatarUrl: string | null;
  linkedinUrl: string | null;
  targetJobRole: string | null;
  user?: {
    email: string | null;
    image: string | null;
  };
  experiences: Experience[];
  education: Education[];
  languages: Language[];
  skills: Skill[];
}

interface CVPageProps {
  candidate: Candidate;
}

export function CVPageClient({ candidate }: CVPageProps) {
  const fullName = `${candidate.firstName || ""} ${candidate.lastName || ""}`.trim() || "Your Name";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Minimal Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/candidate/profile">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Profile
                </Button>
              </Link>
            </div>
            
            <PDFDownloadButton candidate={candidate} fullName={fullName} />
          </div>
        </div>
      </header>

      {/* CV Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CVContent candidate={candidate} />
      </main>
    </div>
  );
}

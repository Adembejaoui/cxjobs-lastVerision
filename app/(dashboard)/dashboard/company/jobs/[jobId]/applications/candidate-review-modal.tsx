"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Mail, Phone, Download, Bookmark } from "lucide-react";
import type { Candidate, LeanCandidate } from "./types";

interface CandidateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  applications: Array<{
    id: string;
    status: string;
    coverLetter: string | null;
    cvUrl: string | null;
    notes: string | null;
    isSaved: boolean;
    createdAt: Date;
    candidate?: Candidate | LeanCandidate;
  }>;
  currentIndex: number;
  onNavigate: (index: number) => void;
  onStatusUpdate: (applicationId: string, status: string, notes: string) => void;
  onToggleSaved: (applicationId: string, isSaved: boolean) => void;
}

export function CandidateReviewModal({
  isOpen,
  onClose,
  applications,
  currentIndex,
  onNavigate,
  onStatusUpdate,
  onToggleSaved,
}: CandidateReviewModalProps) {
  const application = useMemo(() => {
    return applications[currentIndex];
  }, [applications, currentIndex]);

  const candidate = application?.candidate as Candidate | undefined;

  // Use lazy initialization for state to avoid syncing in effects
  const [notes, setNotes] = useState(() => application?.notes || "");
  const [selectedStatus, setSelectedStatus] = useState<string>(() => application?.status || "");

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < applications.length - 1) {
      onNavigate(currentIndex + 1);
    }
  };

  const handleSave = () => {
    if (application) {
      onStatusUpdate(application.id, selectedStatus || application.status, notes);
      if (currentIndex < applications.length - 1) {
        onNavigate(currentIndex + 1);
      }
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  };

  const getProficiencyWidth = (proficiency: string) => {
    switch (proficiency.toLowerCase()) {
      case "native":
        return "100%";
      case "fluent":
      case "c2":
        return "95%";
      case "advanced":
      case "c1":
        return "86%";
      case "intermediate":
      case "b2":
        return "70%";
      case "basic":
      case "b1":
        return "48%";
      default:
        return "50%";
    }
  };

  if (!application || !candidate) return null;

  const fullName = candidate.firstName && candidate.lastName
    ? `${candidate.firstName} ${candidate.lastName}`
    : candidate.user.name || "Unknown Candidate";

  const avatarUrl = candidate.avatarUrl || candidate.user.image;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent key={application?.id} className="max-w-[1240px] p-0 overflow-hidden border-0 rounded-[24px]" showCloseButton={false}>
        <DialogTitle className="sr-only">
          Candidate Review - {fullName}
        </DialogTitle>
        
        {/* Header */}
        <div className="h-[74px] px-8 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-5">
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-[34px] leading-none transition-colors"
            >
              <X className="h-8 w-8" />
            </button>
            <h1 className="text-[18px] md:text-[20px] font-semibold text-slate-900 tracking-[-0.02em]">
              Candidate Review - #{application.id.slice(0, 8).toUpperCase()}
            </h1>
          </div>

          <div className="flex items-center gap-8 text-[14px] md:text-[16px] text-slate-500 font-medium">
            <button 
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="hover:text-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <div className="h-5 w-px bg-slate-200" />
            <button 
              onClick={handleNext}
              disabled={currentIndex === applications.length - 1}
              className="hover:text-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next Candidate
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] max-h-[calc(100vh-200px)] overflow-auto">
          {/* Sidebar */}
          <aside className="border-r border-slate-200 bg-slate-50/40 px-7 py-9">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName}
                    className="h-[132px] w-[132px] rounded-full object-cover border-[6px] border-white shadow-md"
                  />
                ) : (
                  <div className="h-[132px] w-[132px] rounded-full bg-slate-200 border-[6px] border-white shadow-md flex items-center justify-center">
                    <span className="text-4xl font-semibold text-slate-400">
                      {fullName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="absolute bottom-2 right-1 h-6 w-6 rounded-full bg-emerald-400 border-4 border-white" />
              </div>

              <h2 className="mt-6 text-[24px] font-semibold tracking-[-0.03em] text-slate-900">
                {fullName}
              </h2>
              <p className="text-[16px] text-slate-500 mt-1">
                {candidate.headline || "Candidate"}
              </p>
            </div>

            <div className="mt-10 space-y-10">
              {/* Contact Details */}
              <section>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-5">
                  Contact Details
                </p>

                <div className="space-y-5 text-slate-600">
                  <div className="flex items-center gap-4 text-[15px]">
                    <Mail className="h-5 w-5 text-slate-400" />
                    <span className="truncate">{candidate.user.email}</span>
                  </div>

                  {candidate.phone && (
                    <div className="flex items-center justify-between gap-4 text-[15px]">
                      <div className="flex items-center gap-4">
                        <Phone className="h-5 w-5 text-slate-400" />
                        <span>{candidate.phone}</span>
                      </div>
                    </div>
                  )}

                  {candidate.location && (
                    <div className="flex items-center gap-4 text-[15px]">
                      <span className="text-slate-400 text-lg">📍</span>
                      <span>{candidate.location}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Language Proficiency */}
{candidate.languages && candidate.languages.length > 0 && (
                 <section>
                   <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-5">
                     Language Proficiency
                   </p>

                  <div className="space-y-4">
                    {candidate.languages.map((lang) => (
                      <div key={lang.id}>
                        <div className="flex items-center justify-between text-[14px] font-medium text-slate-800 mb-2">
                          <span>{lang.name}</span>
                          <span className="text-emerald-500">{lang.proficiency}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-emerald-400" 
                            style={{ width: getProficiencyWidth(lang.proficiency) }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Preferences */}
{candidate.preferredJobTypes && candidate.preferredJobTypes.length > 0 && (
                 <section>
                   <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-5">
                     Preferences
                   </p>

                  <div className="flex flex-wrap gap-3">
                    {candidate.preferredJobTypes.map((type, idx) => (
                      <span 
                        key={idx}
                        className="px-4 h-10 rounded-lg border border-slate-200 bg-white text-slate-800 text-[15px] font-medium flex items-center"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Skills */}
{candidate.skills && candidate.skills.length > 0 && (
                 <section>
                   <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-5">
                     Skills
                   </p>
                  <div className="flex flex-wrap gap-2">
                    {candidate.skills.map((skill) => (
                      <span 
                        key={skill.id}
                        className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-[13px]"
                      >
                        {skill.name}
                        {skill.level && <span className="text-slate-400 ml-1">({skill.level})</span>}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </aside>

          {/* Main panel */}
          <main className="bg-slate-100/70 px-7 py-7">
            {/* Resume/CV Section */}
            {(candidate.resumeUrl || application.cvUrl) && (
              <div className="rounded-[20px] border border-slate-200 bg-white overflow-hidden shadow-sm mb-6">
                <div className="h-[74px] px-7 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-slate-700">
                    <span className="text-slate-500">📄</span>
                    <span className="font-semibold text-[15px]">Resume / CV</span>
                  </div>

                  <div className="flex items-center gap-4 text-slate-500">
                    <a 
                      href={application.cvUrl || candidate.resumeUrl || "#"} 
                      download
                      className="hover:text-slate-700 transition-colors"
                    >
                      <Download className="h-5 w-5" />
                    </a>
                  </div>
                </div>

                <div className="p-8">
                  <div className="mx-auto bg-white border border-slate-100 shadow-sm w-full max-w-[780px] min-h-[200px] px-14 py-12">
                    {/* Summary */}
                    {candidate.summary && (
                      <section className="mb-10">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-8 w-1 bg-[#162f67] rounded-full" />
                          <h3 className="text-[16px] uppercase tracking-[0.18em] font-semibold text-slate-400">Profile Summary</h3>
                        </div>
                        <p className="text-slate-700 text-[16px] leading-7">{candidate.summary}</p>
                      </section>
                    )}

                    {/* Cover Letter */}
                    {application.coverLetter && (
                      <section className="mb-10">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-8 w-1 bg-[#162f67] rounded-full" />
                          <h3 className="text-[16px] uppercase tracking-[0.18em] font-semibold text-slate-400">Cover Letter</h3>
                        </div>
                        <p className="text-slate-700 text-[16px] leading-7 whitespace-pre-wrap">{application.coverLetter}</p>
                      </section>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Experience Section */}
{candidate.experiences && candidate.experiences.length > 0 && (
               <div className="rounded-[20px] border border-slate-200 bg-white overflow-hidden shadow-sm mb-6">
                 <div className="px-7 py-5 border-b border-slate-200">
                   <div className="flex items-center gap-3">
                     <div className="h-8 w-1 bg-[#162f67] rounded-full" />
                     <h3 className="text-[16px] uppercase tracking-[0.18em] font-semibold text-slate-400">Experience</h3>
                   </div>
                 </div>

                <div className="p-8 space-y-8">
                  {candidate.experiences.map((exp) => (
                    <div key={exp.id}>
                      <div className="flex items-start justify-between gap-4">
                        <h4 className="text-[18px] font-bold text-slate-900">{exp.title}</h4>
                        <span className="text-[14px] text-slate-400 whitespace-nowrap">
                          {formatDate(exp.startDate)} - {exp.isCurrent ? "Present" : exp.endDate ? formatDate(exp.endDate) : ""}
                        </span>
                      </div>
                      <p className="text-[16px] text-[#162f67] font-medium mt-1">{exp.company}</p>
                      {exp.location && <p className="text-[14px] text-slate-500 mt-1">{exp.location}</p>}
                      {exp.description && (
                        <p className="mt-3 text-[15px] text-slate-600 leading-6">{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education Section */}
{candidate.education && candidate.education.length > 0 && (
               <div className="rounded-[20px] border border-slate-200 bg-white overflow-hidden shadow-sm mb-6">
                 <div className="px-7 py-5 border-b border-slate-200">
                   <div className="flex items-center gap-3">
                     <div className="h-8 w-1 bg-[#162f67] rounded-full" />
                     <h3 className="text-[16px] uppercase tracking-[0.18em] font-semibold text-slate-400">Education</h3>
                   </div>
                 </div>

                <div className="p-8 space-y-6">
                  {candidate.education.map((edu) => (
                    <div key={edu.id}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="text-[18px] font-bold text-slate-900">{edu.degree}</h4>
                          <p className="text-[16px] text-slate-700 mt-1">{edu.school}</p>
                          {edu.fieldOfStudy && (
                            <p className="text-[14px] text-slate-500 mt-1">{edu.fieldOfStudy}</p>
                          )}
                        </div>
                        <span className="text-[14px] text-slate-400 whitespace-nowrap">
                          {formatDate(edu.startDate)} - {edu.isCurrent ? "Present" : edu.endDate ? formatDate(edu.endDate) : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Floating decision panel */}
            <div className="relative mt-8">
              <div className="ml-auto w-full max-w-[860px] rounded-[22px] border-2 border-[#162f67] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)] px-7 py-7">
                <div className="flex items-center gap-3 text-slate-900 mb-7">
                  <span className="text-lg">📝</span>
                  <h3 className="text-[18px] font-semibold tracking-[-0.02em]">Recruiter Decision Panel</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-end">
                  <div>
                    <label className="block text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500 mb-3">
                      Internal Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add observations about language fluency, personality, or technical fit..."
                      className="w-full h-[102px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-[15px] text-slate-700 placeholder:text-slate-400 outline-none resize-none focus:border-[#162f67] focus:ring-1 focus:ring-[#162f67]"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500 mb-3">
                      Application Status
                    </label>
                    <div className="flex gap-4 items-center">
                      <div className="flex-1 space-y-4">
                        <select
                          value={selectedStatus || application.status}
                          onChange={(e) => setSelectedStatus(e.target.value)}
                          className="w-full h-[48px] rounded-xl border border-slate-200 bg-slate-50 px-4 text-[15px] text-slate-800 outline-none focus:border-[#162f67] focus:ring-1 focus:ring-[#162f67] appearance-none cursor-pointer"
                        >
                          <option value="NOUVEAU">New</option>
                          <option value="EN_COURS_EXAMEN">In Review</option>
                          <option value="ENTRETIEN">Interview</option>
                          <option value="EMBAUCHES">Hired</option>
                          <option value="REFUSE">Rejected</option>
                        </select>

                        <Button
                          onClick={handleSave}
                          className="w-full h-[56px] rounded-xl bg-[#162f67] hover:bg-[#162f67]/90 text-white text-[17px] font-semibold shadow-lg shadow-slate-300/70"
                        >
                          Save {currentIndex < applications.length - 1 && "& Next Candidate"} →
                        </Button>
                      </div>

                      <button 
                        onClick={() => application && onToggleSaved(application.id, !application.isSaved)}
                        className={`h-[60px] w-[60px] rounded-xl border bg-slate-50 transition-colors flex items-center justify-center ${
                          application?.isSaved
                            ? "border-amber-300 text-amber-500 hover:text-amber-600"
                            : "border-slate-200 text-slate-400 hover:text-[#162f67] hover:border-[#162f67]"
                        }`}
                      >
                        <Bookmark className={`h-6 w-6 ${application?.isSaved ? "fill-current" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}

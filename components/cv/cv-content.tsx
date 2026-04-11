"use client";

import { MapPin, Mail, Phone, Globe, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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

interface CVContentProps {
  candidate: Candidate;
}

// Get proficiency percentage
function getProficiencyPercent(proficiency: string): number {
  const map: Record<string, number> = {
    "NATIVE": 100,
    "FLUENT": 80,
    "ADVANCED": 60,
    "INTERMEDIATE": 40,
    "BASIC": 20,
  };
  return map[proficiency.toUpperCase()] || 20;
}

// Get core competencies based on job role
function getCoreCompetencies(targetJobRole: string | null): string[] {
  const competencies: Record<string, string[]> = {
    "CALL_CENTER": ["Conflict Resolution", "SLA Compliance", "Team Leadership", "Process Optimization"],
    "SALES": ["Communication", "Negotiation", "CRM Management", "Lead Generation"],
    "TECH_SUPPORT": ["Troubleshooting", "Technical Documentation", "Ticket Management", "System Administration"],
    "CUSTOMER_SERVICE": ["Customer Relations", "Problem Solving", "Multi-channel Support", "Quality Assurance"],
    "ADMIN": ["Data Entry", "Office Management", "Scheduling", "Documentation"],
    "GENERAL": ["Communication", "Time Management", "Adaptability", "Organization"],
  };
  return competencies[targetJobRole || "GENERAL"] || competencies["GENERAL"];
}

// Format date range
function formatDateRange(startDate: Date, endDate: Date | null, isCurrent: boolean): string {
  const start = new Date(startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase();
  const end = isCurrent 
    ? "PRESENT" 
    : endDate 
      ? new Date(endDate).toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase()
      : "PRESENT";
  return `${start} — ${end}`;
}

// Parse description into bullet points
function parseDescription(description: string | null): string[] {
  if (!description) return [];
  return description
    .split(/\n|•/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

export function CVContent({ candidate }: CVContentProps) {
  const fullName = `${candidate.firstName || ""} ${candidate.lastName || ""}`.trim() || "Your Name";
  const competencies = getCoreCompetencies(candidate.targetJobRole);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* Left Column */}
        <div className="lg:col-span-4 bg-slate-50 p-8 border-r border-slate-200">
          {/* Profile Card */}
          <div className="text-center mb-8">
            <div className="relative inline-block">
              <Avatar className="w-32 h-32 border-4 border-white shadow-lg">
                <AvatarImage src={candidate.avatarUrl || candidate.user?.image || undefined} alt={fullName} />
                <AvatarFallback className="text-3xl bg-[#071738] text-white">
                  {candidate.firstName?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 text-xs font-semibold">
                AVAILABLE
              </Badge>
            </div>
            
            <h1 className="mt-4 text-2xl font-bold text-slate-900">{fullName}</h1>
            
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              {candidate.location && (
                <div className="flex items-center justify-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span className="uppercase tracking-wide">{candidate.location}</span>
                </div>
              )}
              
              {candidate.user?.email && (
                <div className="flex items-center justify-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span>{candidate.user.email}</span>
                </div>
              )}
              
              {candidate.phone && (
                <div className="flex items-center justify-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span>{candidate.phone}</span>
                </div>
              )}
              
              {candidate.linkedinUrl && (
                <div className="flex items-center justify-center gap-2">
                  <Globe className="h-4 w-4 text-slate-400" />
                  <span className="truncate max-w-[200px]">
                    {candidate.linkedinUrl.replace(/^https?:\/\//, "")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Technical Skills */}
          {candidate.skills.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Technical Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {candidate.skills.map((skill) => (
                  <Badge 
                    key={skill.id} 
                    variant="secondary"
                    className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 px-3 py-1"
                  >
                    {skill.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Core Competencies */}
          <div className="mb-8">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Core Competencies
            </h2>
            <ul className="space-y-2">
              {competencies.map((competency, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-emerald-500 mt-1">•</span>
                  {competency}
                </li>
              ))}
            </ul>
          </div>

          {/* Languages */}
          {candidate.languages.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                Languages
              </h2>
              <div className="space-y-3">
                {candidate.languages.map((lang) => {
                  const percent = getProficiencyPercent(lang.proficiency);
                  return (
                    <div key={lang.id}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-slate-700">{lang.name}</span>
                        <span className="text-xs text-slate-500 uppercase">{lang.proficiency}</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#071738] rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="lg:col-span-8 p-8">
          {/* Summary */}
          {candidate.summary && (
            <div className="mb-10">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-[#071738]" />
                Professional Summary
              </h2>
              <div className=" rounded-lg p-6 border-l-4 ">
                <p className="text-slate-700 leading-relaxed">{candidate.summary}</p>
              </div>
            </div>
          )}

          {/* Experience */}
          {candidate.experiences.length > 0 && (
            <div className="mb-10">
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <svg className="h-5 w-5 text-[#071738]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Work Experience
              </h2>
              <div className="space-y-8">
                {candidate.experiences.map((exp, index) => (
                  <div key={exp.id} className="relative pl-8">
                    {/* Timeline connector */}
                    {index !== candidate.experiences.length - 1 && (
                      <div className="absolute left-3 top-8 bottom-[-2rem] w-0.5 bg-slate-200" />
                    )}
                    
                    {/* Timeline dot */}
                    <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 flex items-center justify-center ${
                      index === 0 ? "bg-emerald-500 border-emerald-100" : "bg-white border-slate-300"
                    }`}>
                      {index === 0 && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{exp.title}</h3>
                        <p className="text-emerald-600 font-medium">{exp.company}</p>
                      </div>
                      <Badge variant="outline" className="text-xs font-medium text-slate-500 whitespace-nowrap">
                        {formatDateRange(exp.startDate, exp.endDate, exp.isCurrent)}
                      </Badge>
                    </div>

                    {exp.description && (
                      <ul className="space-y-1 mt-3">
                        {parseDescription(exp.description).map((bullet, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                            <svg className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {candidate.education.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <svg className="h-5 w-5 text-[#071738]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                </svg>
                Education
              </h2>
              <div className="space-y-6">
                {candidate.education.map((edu) => (
                  <div key={edu.id} className="border-l-4 border-slate-200 pl-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{edu.degree}</h3>
                        {edu.fieldOfStudy && (
                          <p className="text-slate-600">{edu.fieldOfStudy}</p>
                        )}
                        <p className="text-emerald-600 font-medium">{edu.school}</p>
                      </div>
                      <Badge variant="outline" className="text-xs font-medium text-slate-500 whitespace-nowrap">
                        {formatDateRange(edu.startDate, edu.endDate, edu.isCurrent)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

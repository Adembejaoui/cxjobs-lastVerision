"use client";

import { useSession } from 'next-auth/react'
import {
  CheckCircle2,
  ChevronRight,
  LogIn,
  ArrowLeft,
  Bookmark
} from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

export interface JobBenefit {
  id: string
  benefit: {
    id: string
    name: string
    description: string | null
    icon: string | null
    category: string
  }
  customDescription: string | null
}

export interface JobLanguage {
  id: string
  language: string
  level: string
}

export interface Company {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  industry: string | null
  location: string | null
  website: string | null
  description: string | null
  isRemoteFriendly: boolean
  isHybridFriendly: boolean
  benefits: { id: string; name: string }[]
}

export interface JobOffer {
  id: string
  title: string
  slug: string
  description: string | null
  customLocation: string | null
  contractType: string
  isRemote: boolean
  isHybrid: boolean
  experienceLevel: string | null
  salary: string | null
  salaryMin: number | null
  salaryMax: number | null
  requirements: string[]
  technicalTools: string[]
  softSkills: string[]
  status: string
  publishedAt: Date | null
  createdAt: Date
  applicationType: string
  externalApplyUrl: string | null
  benefits: JobBenefit[]
  languages: JobLanguage[]
  company: Company
  _count: {
    applications: number
  }
}

function getContractTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    CDI: 'Full-Time',
    CDD: 'Contract',
    FREELANCE: 'Freelance',
    INTERNSHIP: 'Internship',
    PART_TIME: 'Part-Time',
    APPRENTICESHIP: 'Apprenticeship',
  }
  return labels[type] || type
}

function getExperienceLevelLabel(level: string | null): string {
  if (!level) return ''
  const labels: Record<string, string> = {
    JUNIOR: 'Junior (0-2 years)',
    MID: 'Mid-Level (2-5 years)',
    SENIOR: 'Senior (5+ years)',
    LEAD: 'Team Lead',
    EXECUTIVE: 'Executive',
  }
  return labels[level] || level
}

function getLanguageLevelLabel(level: string): string {
  const labels: Record<string, string> = {
    REQUIRED: 'Required',
    PREFERRED: 'Preferred',
    NICE_TO_HAVE: 'Nice to Have',
  }
  return labels[level] || level
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div>
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[#111b35]">{title}</h2>
      <div className="mt-3 h-1 w-14 rounded-full bg-[#24c491]" />
    </div>
  )
}

function SubLabel({ label }: { label: string }) {
  return <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-[#1c2f63]">{label}</p>
}

interface JobDetailClientProps {
  job: JobOffer
}

export function JobDetailClient({ job }: JobDetailClientProps) {
  const params = useParams()
  const { data: session, status } = useSession()
  const [isSaved, setIsSaved] = useState(false)
  const [hasApplied, setHasApplied] = useState(false)
  const [checkingApplication, setCheckingApplication] = useState(true)

  const isCandidate = session?.user?.role === 'CANDIDATE'

  useEffect(() => {
    async function checkApplication() {
      if (!isCandidate || !job?.id) {
        setCheckingApplication(false)
        return
      }

      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const res = await fetch(`${baseUrl}/api/application?jobId=${job.id}`)
        const data = await res.json()

        if (data.success && data.data && data.data.length > 0) {
          setHasApplied(true)
        }
      } catch (err) {
        console.error('Error checking application status:', err)
      } finally {
        setCheckingApplication(false)
      }
    }

    checkApplication()
  }, [isCandidate, job?.id])

  const postedDate = job.publishedAt
    ? new Date(job.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date(job.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const salaryDisplay = job.salary || (
    job.salaryMin && job.salaryMax
      ? `$${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}`
      : job.salaryMin
        ? `From $${job.salaryMin.toLocaleString()}`
        : job.salaryMax
          ? `Up to $${job.salaryMax.toLocaleString()}`
          : 'Competitive'
  )

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#0e172f]">
      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <div className="mb-4">
          <Link href="/jobs" className="inline-flex items-center gap-2 text-[#162f67] hover:underline text-sm font-medium transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Jobs
          </Link>
        </div>

        <section className="rounded-[28px] border border-[#dfe6ee] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex flex-col gap-6 border-b border-[#e5ebf1] p-5 md:p-7 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-4 md:gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-linear-to-br from-[#162f67] to-[#1e4d9c] text-[10px] font-semibold tracking-[0.18em] text-white shadow-sm md:h-[72px] md:w-[72px] overflow-hidden">
                {job.company.logoUrl ? (
                  <img
                    src={job.company.logoUrl}
                    alt={job.company.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-white">{job.company.name.charAt(0)}</span>
                )}
              </div>

              <div className="min-w-0">
                <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-[#0c1630] md:text-[34px]">
                  {job.title}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] text-[#6b768c]">
                  <span className="font-medium text-[#243454]">{job.company.name}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#a9b4c5]" />
                  <span>
                    {job.customLocation || job.company.location || 'Remote'}
                    {job.isRemote && ' (Remote)'}
                    {job.isHybrid && ' (Hybrid)'}
                    {!job.isRemote && !job.isHybrid && job.company.isRemoteFriendly && ' (Remote Friendly)'}
                    {!job.isRemote && !job.isHybrid && job.company.isHybridFriendly && ' (Hybrid Friendly)'}
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#a9b4c5]" />
                  <span>Posted {postedDate}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start lg:self-center">
              <button
                onClick={() => setIsSaved(!isSaved)}
                className="inline-flex h-14 items-center justify-center rounded-[18px] border border-[#d8e0ea] bg-white px-7 text-[17px] font-medium text-[#21304f] shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition hover:bg-[#f8fafc]"
              >
                <Bookmark className={`h-4 w-4 mr-2 ${isSaved ? 'fill-[#162f67] text-[#162f67]' : ''}`} />
                {isSaved ? 'Saved' : 'Save'}
              </button>

              {checkingApplication ? (
                <button className="inline-flex h-14 items-center justify-center rounded-[18px] bg-slate-200 px-8 text-[17px] font-semibold text-slate-600" disabled>
                  Loading...
                </button>
              ) : hasApplied ? (
                <button className="inline-flex h-14 items-center justify-center rounded-[18px] bg-green-600 px-8 text-[17px] font-semibold text-white shadow-[0_10px_20px_rgba(22,163,74,0.18)]" disabled>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Already Applied
                </button>
              ) : isCandidate && job.applicationType === "EXTERNAL" ? (
                <a
                  href={job.externalApplyUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-14  items-center justify-center rounded-[18px] bg-[#162f67] px-8 text-[17px] font-semibold text-white shadow-[0_10px_20px_rgba(22,47,103,0.18)] transition hover:opacity-95"
                >
                  Apply on Company Website
                </a>
              ) : isCandidate ? (
                <Link href={`/jobs/${job.slug}/apply`}>
                  <button className="inline-flex h-14  items-center justify-center rounded-[18px] bg-[#162f67] px-8 text-[17px] font-semibold text-white shadow-[0_10px_20px_rgba(22,47,103,0.18)] transition hover:opacity-95">
                    Apply Now
                  </button>
                </Link>
              ) : (
                <Link href="/login">
                  <button className="inline-flex h-14  items-center justify-center rounded-[18px] bg-[#162f67] px-8 text-[17px] font-semibold text-white shadow-[0_10px_20px_rgba(22,47,103,0.18)] transition hover:opacity-95">
                    <LogIn className="h-5 w-5 mr-2" />
                    Sign in to Apply
                  </button>
                </Link>
              )}
            </div>
          </div>

          <div className="grid gap-6 p-5 md:p-7 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-3xl border border-[#dfe6ee] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] md:p-8">
              <SectionTitle title="Job Description" />
              <p className="mt-7 max-w-205 text-[16px] leading-8 text-[#4d5a72] whitespace-pre-wrap">
                {job.description || 'No description provided.'}
              </p>

              <div className="mt-10">
                <SectionTitle title="Requirements" />
                {job.requirements && job.requirements.length > 0 ? (
                  <ul className="mt-7 space-y-5">
                    {job.requirements.map((item, idx) => (
                      <li key={idx} className="flex gap-4 text-[16px] leading-7 text-[#4d5a72]">
                        <span className="mt-1 text-[20px] text-[#24c491]">→</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-7 text-[16px] text-[#4d5a72] italic">No specific requirements listed.</p>
                )}
              </div>

              <div className="mt-14">
                <SectionTitle title="Ideal Candidate Profile" />

                <div className="mt-8">
                  <SubLabel label="Soft Skills" />
                  {job.softSkills && job.softSkills.length > 0 ? (
                    <div className="mt-5 flex flex-wrap gap-3">
                      {job.softSkills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full border border-[#dce4ec] bg-[#f7f9fc] px-5 py-2.5 text-[14px] font-medium text-[#273654]"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-5 text-[15px] text-[#6b768c] italic">No soft skills specified.</p>
                  )}
                </div>

                {job.languages && job.languages.length > 0 && (
                  <div className="mt-10 space-y-5 text-[17px] text-[#33415c]">
                    <SubLabel label="Language Requirements" />
                    {job.languages.map((lang) => (
                      <div key={lang.id} className="mt-4 flex gap-3 leading-8">
                        <span className="mt-3 h-2.5 w-2.5 shrink-0 rounded-full bg-[#24c491]" />
                        <p>
                          <span className="font-semibold text-[#16233f]">{lang.language}:</span> {getLanguageLevelLabel(lang.level)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-10">
                  <SubLabel label="Technical Tools" />
                  {job.technicalTools && job.technicalTools.length > 0 ? (
                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {job.technicalTools.map((tool) => (
                        <div
                          key={tool}
                          className="flex items-center gap-3 rounded-[18px] border border-[#e1e7ef] bg-[#fbfcfe] px-5 py-4 text-[15px] font-medium text-[#223250]"
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#24c491] text-[12px] text-white">
                            ✓
                          </span>
                          {tool}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-5 text-[15px] text-[#6b768c] italic">No technical tools specified.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <aside className="rounded-3xl border border-[#dfe6ee] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] md:p-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3f6fb] text-[#1e3569]">
                    ✦
                  </div>
                  <h2 className="text-[20px] font-semibold text-[#111b35]">Job Highlights</h2>
                </div>

                <div className="mt-8 space-y-5">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-[#162f67] to-[#1e4d9c] text-white shadow-[0_6px_12px_rgba(23,50,107,0.18)]">
                      💳
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9aa5b6]">
                        Monthly Salary
                      </p>
                      <p className="mt-1 text-[18px] font-semibold text-[#111b35]">{salaryDisplay}</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-[#162f67] to-[#1e4d9c] text-white shadow-[0_6px_12px_rgba(23,50,107,0.18)]">
                      ☾
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9aa5b6]">
                        Employment Type
                      </p>
                      <p className="mt-1 text-[18px] font-semibold text-[#111b35]">{getContractTypeLabel(job.contractType)}</p>
                      {job.experienceLevel && (
                        <p className="mt-1 text-[13px] text-[#6d7890]">{getExperienceLevelLabel(job.experienceLevel)}</p>
                      )}
                    </div>
                  </div>
                </div>

                {(job.benefits.length > 0 || job.company.benefits.length > 0) && (
                  <>
                    <div className="my-7 h-px bg-[#e6ecf2]" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9aa5b6]">
                        Benefits
                      </p>
                      <div className="mt-5 space-y-4">
                        {/* Company CORE benefits */}
                        {job.company.benefits.slice(0, 3).map((benefit) => (
                          <div key={benefit.id} className="flex items-center gap-3 text-[15px] text-[#223250]">
                            <span className="text-[#24c491]">✚</span>
                            <span className="font-medium">{benefit.name}</span>
                          </div>
                        ))}
                        {/* Job-specific (ADDITIONAL) benefits */}
                        {job.benefits.slice(0, 3).map((jb) => (
                          <div key={jb.id} className="flex items-center gap-3 text-[15px] text-[#223250]">
                            <span className="text-[#24c491]">✚</span>
                            <span className="font-medium">{jb.benefit?.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="mt-8 lg:hidden">
                  {checkingApplication ? (
                    <button className="inline-flex h-14.5 w-full items-center justify-center rounded-[18px] bg-slate-200 text-[16px] font-semibold text-slate-600" disabled>
                      Loading...
                    </button>
                  ) : hasApplied ? (
                    <button className="inline-flex h-14.5 w-full items-center justify-center rounded-[18px] bg-green-600 text-[16px] font-semibold text-white" disabled>
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Already Applied
                    </button>
                  ) : isCandidate && job.applicationType === "EXTERNAL" ? (
                    <a
                      href={job.externalApplyUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-14.5 w-full items-center justify-center rounded-[18px] bg-[#162f67] text-[16px] font-semibold uppercase tracking-[0.03em] text-white shadow-[0_10px_20px_rgba(22,47,103,0.18)] transition hover:opacity-95"
                    >
                      Apply on Company Website
                      <ChevronRight className="h-5 w-5 ml-2" />
                    </a>
                  ) : isCandidate ? (
                    <Link href={`/jobs/${job.slug}/apply`}>
                      <button className="inline-flex h-14.5 w-full items-center justify-center rounded-[18px] bg-[#162f67] text-[16px] font-semibold uppercase tracking-[0.03em] text-white shadow-[0_10px_20px_rgba(22,47,103,0.18)] transition hover:opacity-95">
                        Apply Now
                        <ChevronRight className="h-5 w-5 ml-2" />
                      </button>
                    </Link>
                  ) : (
                    <Link href="/login">
                      <button className="inline-flex h-14.5 w-full items-center justify-center rounded-[18px] bg-[#162f67] text-[16px] font-semibold uppercase tracking-[0.03em] text-white shadow-[0_10px_20px_rgba(22,47,103,0.18)] transition hover:opacity-95">
                        <LogIn className="h-5 w-5 mr-2" />
                        Sign in to Apply
                      </button>
                    </Link>
                  )}
                </div>

                <div className="hidden lg:block mt-8">
                  {checkingApplication ? (
                    <button className="inline-flex h-14.5 w-full items-center justify-center rounded-[18px] bg-slate-200 text-[16px] font-semibold text-slate-600" disabled>
                      Loading...
                    </button>
                  ) : hasApplied ? (
                    <button className="inline-flex h-14.5 w-full items-center justify-center rounded-[18px] bg-green-600 text-[16px] font-semibold text-white" disabled>
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Already Applied
                    </button>
                  ) : isCandidate && job.applicationType === "EXTERNAL" ? (
                    <a
                      href={job.externalApplyUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-14.5 w-full items-center justify-center rounded-[18px] bg-[#162f67] text-[16px] font-semibold uppercase tracking-[0.03em] text-white shadow-[0_10px_20px_rgba(22,47,103,0.18)] transition hover:opacity-95"
                    >
                      Apply on Company Website
                    </a>
                  ) : isCandidate ? (
                    <Link href={`/jobs/${job.slug}/apply`}>
                      <button className="inline-flex h-14.5 w-full items-center justify-center rounded-[18px] bg-[#162f67] text-[16px] font-semibold uppercase tracking-[0.03em] text-white shadow-[0_10px_20px_rgba(22,47,103,0.18)] transition hover:opacity-95">
                        Apply Now
                      </button>
                    </Link>
                  ) : (
                    <Link href="/login">
                      <button className="inline-flex h-14.5 w-full items-center justify-center rounded-[18px] bg-[#162f67] text-[16px] font-semibold uppercase tracking-[0.03em] text-white shadow-[0_10px_20px_rgba(22,47,103,0.18)] transition hover:opacity-95">
                        <LogIn className="h-5 w-5 mr-2" />
                        Sign in to Apply
                      </button>
                    </Link>
                  )}
                </div>
              </aside>

              <aside className="rounded-3xl border border-[#dfe6ee] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] md:p-7">
                <h2 className="text-[20px] font-semibold text-[#111b35]">About the Company</h2>
                <p className="mt-5 text-[15px] leading-8 text-[#4d5a72]">
                  {job.company.description || `${job.company.name} is a company in the ${job.company.industry || 'technology'} industry.`}
                </p>

                <div className="my-7 h-px bg-[#e6ecf2]" />

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {job.company.website && (
                      <a
                        href={job.company.website.startsWith('http') ? job.company.website : `https://${job.company.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dde5ee] bg-[#fafcff] text-[#50607d] hover:text-[#162f67] transition-colors"
                      >
                        🌐
                      </a>
                    )}
                    <Link
                      href={`/companies/${job.company.slug}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dde5ee] bg-[#fafcff] text-[#50607d] hover:text-[#162f67] transition-colors"
                    >
                      🏢
                    </Link>
                  </div>
                  <Link href={`/companies/${job.company.slug}`}>
                    <button className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#1c2f63] transition hover:opacity-80">
                      View Profile →
                    </button>
                  </Link>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
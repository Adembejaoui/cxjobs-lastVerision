"use client"

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useUser } from "@/components/auth/user-provider"
import {
  PagerButton,
  JobCard,
  JobData
} from './components'
import { AdminBannerCard, type AdminBanner } from '@/components/admin-banner'
import { logger } from "@/lib/logger";

interface FilterOption {
  label: string
  value: string
  checked: boolean
}

const activityTypes = [
  { label: "Customer Service", value: "CUSTOMER_SERVICE" },
  { label: "Sales & Lead Generation", value: "SALES_LEAD_GENERATION" },
  { label: "Technical & IT Support", value: "TECHNICAL_IT_SUPPORT" },
  { label: "Debt Collection & Litigation", value: "DEBT_COLLECTION_LITIGATION" },
  { label: "Back-office & Digital Services", value: "BACK_OFFICE_DIGITAL_SERVICES" },
  { label: "Surveys & Market Research", value: "SURVEYS_MARKET_RESEARCH" },
]

function activityTypeLabel(type: string | null, custom: string | null): string {
  if (!type) return ''
  const labels: Record<string, string> = {
    CUSTOMER_SERVICE: 'Customer Service',
    SALES_LEAD_GENERATION: 'Sales & Lead Generation',
    TECHNICAL_IT_SUPPORT: 'Technical & IT Support',
    DEBT_COLLECTION_LITIGATION: 'Debt Collection & Litigation',
    BACK_OFFICE_DIGITAL_SERVICES: 'Back-office & Digital Services',
    SURVEYS_MARKET_RESEARCH: 'Surveys & Market Research',
    OTHER: custom || 'Other',
  }
  return labels[type] || type
}

const languages = [
  { label: "English", value: "English" },
  { label: "French", value: "French" },
  { label: "Spanish", value: "Spanish" },
  { label: "Arabic", value: "Arabic" },
  { label: "German", value: "German" },
  { label: "Portuguese", value: "Portuguese" },
  { label: "Italian", value: "Italian" },
  { label: "Mandarin", value: "Mandarin" },
]

const locations = [
  "Tunis",
  "Zaghouan",
  "Ariana",
  "Béja",
  "Ben Arous",
  "Bizerte",
  "Gabès",
  "Gafsa",
  "Jendouba",
  "Kairouan",
  "Kasserine",
  "Kebili",
  "Kef",
  "Mahdia",
  "Manouba",
  "Medenine",
  "Monastir",
  "Nabeul",
  "Sfax",
  "Sidi Bouzid",
  "Siliana",
  "Sousse",
  "Tataouine",
  "Tozeur",
]

interface JobOffer {
  id: string
  title: string
  slug: string
  salary: string | null
  salaryMax: number | null
  salaryCurrency: string | null
  isRemote: boolean
  isHybrid: boolean
  customLocation: string | null
  contractType: string
  activityType: string | null
  activityCustom: string | null
  department: string | null
  company: {
    id: string
    name: string
    slug: string
    logoUrl: string | null
    location: string | null
  }
  _count: {
    applications: number
  }
}

interface JobsPageClientProps {
  initialJobs?: JobOffer[]
  totalJobs?: number
}


const MOCK_BANNERS: AdminBanner[] = [
   {
    id: "job-banner-1",
    priority: 1,
    mode: "image",
    backgroundImage: "https://hvbbactmgfhecqbetlhg.supabase.co/storage/v1/object/public/covers/3072fe0f-914c-49ba-ad81-83e061683df2/1779137761635-3m7sdt.png",
    ctaLink: "https://example.com/cx-salary-report-2026",
    ctaExternal: true,
  },
  {
    id: "job-banner-2",
    priority: 2,
    title: "Upload Your CV and Get Matched",
    description: "Complete your profile in 2 minutes and let top CX employers find you.",
    image: null,
    badge: "NEW",
    ctaText: "Upload CV",
    ctaLink: "/dashboard/candidate/cv",
    ctaExternal: false,
  },
  {
    id: "job-banner-3",
    priority: 3,
    title: "Salary Transparency Report 2026",
    description: "See what CX professionals are earning this year. Free download.",
    image: null,
    badge: "RESOURCE",
    ctaText: "Download Now",
    ctaLink: "https://example.com/cx-salary-report-2026",
    ctaExternal: true,
  },
  {
    id: "job-banner-4",
    priority: 4,
    mode: "image",
    backgroundImage: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&auto=format&fit=crop&q=80",
    ctaLink: "https://example.com/cx-salary-report-2026",
    ctaExternal: true,
  },
];

const sortedBanners = [...MOCK_BANNERS].sort((a, b) => a.priority - b.priority);
// Banners with priority > 1: these live in the left sidebar on desktop
const sidebarBanners = sortedBanners.filter((b) => b.priority > 1);
// Banner with priority 1: this sits above the job list, on every device
const topBanner = sortedBanners.filter((b) => b.priority === 1);

export default function JobsPageClient({ initialJobs = [], totalJobs = 0 }: JobsPageClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const user = useUser()
  const isCompany = user?.role === 'COMPANY'

  const LIMIT = 20

  // Parse the URL once on mount to seed both the pending and applied filter
  // states. This keeps the URL as the single source of truth for what is
  // currently rendered, while the pending state lets the user stage changes
  // before clicking "Apply Filters".
  const initialActivityValues = new Set(
    (searchParams.get("activityType") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  )

  const initialFilters = {
    selectedActivity: activityTypes.map((item) => ({
      ...item,
      checked: initialActivityValues.has(item.value),
    })),
    selectedLanguage: searchParams.get("language") ?? "",
    location: searchParams.get("location") ?? "",
    searchQuery: searchParams.get("search") ?? "",
  }

  // Pending filter state: what the user is currently staging in the UI.
  // Changing these does NOT trigger a fetch until Apply is clicked.
  const [pendingActivity, setPendingActivity] = useState<FilterOption[]>(
    initialFilters.selectedActivity
  )
  const [pendingLanguage, setPendingLanguage] = useState<string>(
    initialFilters.selectedLanguage
  )
  const [pendingLocation, setPendingLocation] = useState<string>(
    initialFilters.location
  )
  const [pendingSearch, setPendingSearch] = useState<string>(
    initialFilters.searchQuery
  )

  // Applied filter state: what the last fetch used. This is what drives the
  // rendered job list and the URL.
  const [appliedActivity, setAppliedActivity] = useState<FilterOption[]>(
    initialFilters.selectedActivity
  )
  const [appliedLanguage, setAppliedLanguage] = useState<string>(
    initialFilters.selectedLanguage
  )
  const [appliedLocation, setAppliedLocation] = useState<string>(
    initialFilters.location
  )
  const [appliedSearch, setAppliedSearch] = useState<string>(
    initialFilters.searchQuery
  )

  const [jobs, setJobs] = useState<JobOffer[]>(initialJobs)
  const [total, setTotal] = useState(totalJobs)
  const [currentPage, setCurrentPage] = useState(() => {
    const page = Number.parseInt(searchParams.get("page") ?? "1", 10)
    return Number.isNaN(page) || page < 1 ? 1 : page
  })
  const [isLoading, setIsLoading] = useState(false)

  const buildQueryParams = useCallback((page: number) => {
    const params = new URLSearchParams()
    params.set('page', page.toString())
    params.set('limit', LIMIT.toString())
    params.set('status', 'PUBLISHED')

    if (appliedSearch) {
      params.set('search', appliedSearch)
    }

    const activeActivity = appliedActivity.filter(e => e.checked).map(e => e.value)
    if (activeActivity.length > 0) {
      params.set('activityType', activeActivity.join(','))
    }

    if (appliedLanguage) {
      params.set('language', appliedLanguage)
    }

    if (appliedLocation) {
      if (appliedLocation === "Remote") {
        params.set('isRemote', 'true')
      } else {
        params.set('location', appliedLocation)
      }
    }

    return params.toString()
  }, [appliedSearch, appliedActivity, appliedLanguage, appliedLocation])

  const fetchJobs = useCallback(async (page: number) => {
    setIsLoading(true)
    try {
      const queryParams = buildQueryParams(page)
      const response = await fetch(`/api/job-offers?${queryParams}`)
      const data = await response.json()

      if (data.success) {
        setJobs(data.data || [])
        setTotal(data.pagination?.total || 0)
      } else {
        logger.error("Failed to fetch jobs", { error: data.error })
      }
    } catch {
      logger.error("Failed to fetch jobs");
    } finally {
      setIsLoading(false)
    }
  }, [buildQueryParams])

  // Fetch when the current page changes OR when the APPLIED filters change.
  // Pending filter edits are deliberately excluded from buildQueryParams, so
  // they never enter this dependency list and therefore produce zero requests.
  // When the user clicks "Apply Filters", the applied states change, which
  // recreates buildQueryParams and fetchJobs, which re-runs this effect.
  useEffect(() => {
    fetchJobs(currentPage)
  }, [currentPage, fetchJobs])



  // Stage a filter change into the pending state. This does NOT fetch
  // jobs and does NOT touch the URL — the user must click "Apply Filters".
  // (Activity toggling is handled inline by the single-select dropdown.)

  // Clear the pending filter state. Does NOT trigger a request — the user
  // must click "Apply Filters" for the cleared state to take effect.
  const clearPendingFilters = () => {
    setPendingActivity(activityTypes.map(item => ({ ...item, checked: false })))
    setPendingLanguage("")
    setPendingLocation("")
    setPendingSearch("")
  }

  // Apply the pending filters: copy them into the applied state, reset to
  // page 1, sync the URL, and trigger exactly one fetch.
  const applyFilters = useCallback(() => {
    setAppliedActivity(pendingActivity)
    setAppliedLanguage(pendingLanguage)
    setAppliedLocation(pendingLocation)
    setAppliedSearch(pendingSearch)
    setCurrentPage(1)

    const params = new URLSearchParams(window.location.search)
    const activeActivity = pendingActivity.filter(e => e.checked).map(e => e.value)
    if (activeActivity.length > 0) {
      params.set("activityType", activeActivity.join(","))
    } else {
      params.delete("activityType")
    }
    if (pendingSearch) {
      params.set("search", pendingSearch)
    } else {
      params.delete("search")
    }
    if (pendingLanguage) {
      params.set("language", pendingLanguage)
    } else {
      params.delete("language")
    }
    if (pendingLocation) {
      if (pendingLocation === "Remote") {
        params.set("isRemote", "true")
        params.delete("location")
      } else {
        params.set("location", pendingLocation)
        params.delete("isRemote")
      }
    } else {
      params.delete("location")
      params.delete("isRemote")
    }
    params.set("page", "1")
    router.replace(`/jobs?${params.toString()}`, { scroll: false })
  }, [pendingActivity, pendingLanguage, pendingLocation, pendingSearch, router])

  // Derived from the APPLIED filters — these drive the rendered UI and the
  // "filters active" count. Pending changes do not affect these until Apply.
  const hasActiveFilters =
    appliedActivity.some(item => item.checked) ||
    appliedLanguage.length > 0 ||
    appliedLocation.length > 0 ||
    appliedSearch.length > 0

  const checkedActivityCount = appliedActivity.filter(item => item.checked).length

  const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  TND: "د.ت",
}

const transformedJobs: JobData[] = jobs.map((job, index) => {
    const currencySymbol = CURRENCY_SYMBOLS[job.salaryCurrency || "USD"] || "$"
    const salaryNum = typeof job.salary === 'string' ? parseFloat(job.salary) : job.salary
    const salaryFormatted = salaryNum
      ? `${currencySymbol}${(salaryNum / 1000).toFixed(1)}k/mo`
      : job.salaryMax
        ? `${currencySymbol}${(job.salaryMax / 1000).toFixed(1)}k/mo`
        : "Salary TBD"

    const workModeLabel = job.isRemote ? "Remote"
      : job.isHybrid ? "Hybrid"
      : "On-site"

    const location = job.customLocation || job.company.location || "Not specified"

    return {
      title: job.title,
      company: job.company.name,
      slug: job.slug,
      location,
      salary: salaryFormatted,
      extra: job.contractType || "Full-time",
      badge2: workModeLabel,
      badge3: activityTypeLabel(job.activityType, job.activityCustom),
      icon: "▣",
      isFirst: index === 0,
    }
  })

  // NOTE: previously this interleaved sidebar-priority banners every 2 cards.
  // Since those banners now live permanently in the left sidebar on desktop,
  // the job list itself no longer needs inline banner injection.
  const renderJobList = () => {
    return transformedJobs.map((job) => (
      <JobCard key={job.title} job={job} isCompany={isCompany} />
    ));
  };

  return (
    <main className="min-h-screen px-4 py-5 text-slate-900 md:px-6 lg:px-8">
      <div className="mx-auto max-w-400 gap-5 lg:grid lg:grid-cols-[320px_1fr]">
        {/* Sidebar - desktop only, priority > 1 banners stacked vertically */}
        <aside className="hidden lg:block space-y-5">
          {sidebarBanners.map((banner) => (
            <AdminBannerCard key={banner.id} banner={banner} />
          ))}
        </aside>

        {/* Main Content: priority 1 banner + filters + job list + pagination */}
        <section className="space-y-5">
          {/* Priority 1 banner, shown above the job list on every device */}
          <div className="space-y-5">
            {topBanner.map((banner) => (
              <AdminBannerCard key={banner.id} banner={banner} />
            ))}
          </div>

          {/* Mobile fallback: sidebar banners have nowhere to render below
              the lg breakpoint, so show them here, stacked, mobile-only */}
          {sidebarBanners.length > 0 && (
            <div className="space-y-5 lg:hidden">
              {sidebarBanners.map((banner) => (
                <AdminBannerCard key={banner.id} banner={banner} />
              ))}
            </div>
          )}

          {/* Filter Bar */}
          <div className="rounded-[26px] bg-[#f4f6f8] p-4 shadow-[0_14px_30px_rgba(0,0,0,0.25)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              {/* Search */}
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search jobs, companies..."
                  value={pendingSearch}
                  onChange={(e) => {
                    setPendingSearch(e.target.value)
                  }}
                  className="w-full rounded-2xl border border-[#d7e0ea] bg-white px-4 py-3 text-[16px] font-semibold text-[#344865] placeholder:text-[#95a5be] focus:border-[#45c68d] focus:outline-none focus:ring-2 focus:ring-[#45c68d]/20"
                />
                {pendingSearch && (
                  <button
                    onClick={() => setPendingSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#95a5be] hover:text-[#344865] transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Location */}
              <select
                aria-label="Location"
                value={pendingLocation}
                onChange={(e) => {
                  setPendingLocation(e.target.value)
                }}
                className="flex-1 rounded-2xl border border-[#d7e0ea] bg-white px-4 py-3 text-[16px] font-semibold text-[#344865] shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#45c68d]"
              >
                <option value="">All Cities</option>
                <option value="Remote">Remote</option>
                {locations.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>



                {/* Activity Type */}
                <select
                  value={pendingActivity.find(e => e.checked)?.value || ""}
                  onChange={(e) => {
                    const val = e.target.value
                    setPendingActivity(prev =>
                      prev.map(item => ({
                        ...item,
                        checked: item.value === val
                      }))
                    )
                  }}
                  className="rounded-2xl border border-[#d7e0ea] bg-white px-4 py-3 text-[16px] font-bold text-[#29476f] shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#45c68d]"
                >
                  <option value="">All Activity Types</option>
                  {activityTypes.map(item => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>

               {/* Language */}
               <select
                 value={pendingLanguage}
                 onChange={(e) => {
                   setPendingLanguage(e.target.value)
                 }}
                 className="rounded-2xl border border-[#d7e0ea] bg-white px-4 py-3 text-[16px] font-bold text-[#29476f] shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#45c68d]"
               >
                 <option value="">All Languages</option>
                 {languages.map(item => (
                   <option key={item.value} value={item.value}>{item.label}</option>
                 ))}
               </select>

{/* Reset / Apply */}
              <div className="flex items-center gap-2">
                <button
                  onClick={clearPendingFilters}
                  className="rounded-2xl border border-[#d7e0ea] bg-white px-4 py-3 text-[14px] font-bold text-red-600 hover:bg-red-50 transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={applyFilters}
                  className="rounded-2xl border border-[#45c68d] bg-[#45c68d] px-4 py-3 text-[14px] font-bold text-white hover:bg-[#38b073] transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>

            {/* Active Filters (derived from applied state) */}
            {hasActiveFilters && (
              <div className="mt-3 flex flex-wrap gap-2">
                 {appliedSearch && (
                   <span className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-700">
                     &quot;{appliedSearch}&quot;
                     <button onClick={() => { setPendingSearch(""); setAppliedSearch(""); }} className="hover:text-teal-900 transition-colors">×</button>
                   </span>
                 )}
                 {appliedLocation && (
                   <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700">
                     {appliedLocation}
                     <button onClick={() => { setPendingLocation(""); setAppliedLocation(""); }} className="hover:text-blue-900 transition-colors">×</button>
                   </span>
                 )}

                 {appliedActivity.filter(item => item.checked).map(item => (
                  <span key={item.value} className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
                    {item.label}
                    <button onClick={() => {
                      setPendingActivity(prev => prev.map(i => i.label === item.label ? { ...i, checked: false } : i))
                      setAppliedActivity(prev => prev.map(i => i.label === item.label ? { ...i, checked: false } : i))
                    }} className="hover:text-green-900 transition-colors">×</button>
                  </span>
                 ))}
                 {appliedLanguage && (
                   <span className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-700">
                     {appliedLanguage}
                     <button onClick={() => { setPendingLanguage(""); setAppliedLanguage(""); }} className="hover:text-purple-900 transition-colors">×</button>
                   </span>
                 )}
               </div>
             )}
           </div>

          {/* Results Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-[28px] font-black tracking-[-0.03em] text-[#163257]">Call Center Jobs</h2>
              <p className="mt-1 text-[18px] font-semibold text-[#70839c]">
                Showing {transformedJobs.length} of {total} opportunities
                {hasActiveFilters && (
                   <span className="ml-1 text-[#45c68d]">
                     ({checkedActivityCount + (appliedSearch ? 1 : 0) + (appliedLanguage ? 1 : 0) + (appliedLocation ? 1 : 0)} filters active)
                   </span>
                )}
              </p>
            </div>
          </div>

         {/* Job Listings */}
         <div className="space-y-5">
           {isLoading ? (
             <>
               {[1, 2, 3].map((i) => (
                 <div key={i} className="rounded-[30px] bg-[#f7f9fb] px-5 py-5 shadow-[0_10px_24px_rgba(0,0,0,0.12)] ring-1 ring-[#e8edf4] md:px-6 animate-pulse">
                   <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                     <div className="flex min-w-0 items-start gap-5">
                       <div className="h-19 w-19 shrink-0 rounded-[18px] bg-[#e8edf4]" />
                       <div className="space-y-3">
                         <div className="h-6 w-64 rounded bg-[#e8edf4]" />
                         <div className="h-5 w-40 rounded bg-[#e8edf4]" />
                         <div className="flex gap-8">
                           <div className="h-4 w-24 rounded bg-[#e8edf4]" />
                           <div className="h-4 w-24 rounded bg-[#e8edf4]" />
                         </div>
                       </div>
                     </div>
                     <div className="flex gap-3">
                       <div className="h-12 w-36 rounded-[18px] bg-[#e8edf4]" />
                       <div className="h-12 w-24 rounded-[18px] bg-[#e8edf4]" />
                     </div>
                   </div>
                 </div>
               ))}
             </>
           ) : transformedJobs.length > 0 ? (
             renderJobList()
           ) : (
             <div className="rounded-[30px] bg-[#f7f9fb] px-6 py-12 text-center shadow-[0_10px_24px_rgba(0,0,0,0.12)] ring-1 ring-[#e8edf4]">
               <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#e8edf4] text-[32px]">
                 🔍
               </div>
               <p className="text-[20px] font-bold text-[#7b8ca3]">No jobs found matching your filters</p>
               <p className="mt-2 text-[16px] text-[#95a5be]">
                 Try adjusting your filter criteria or clear all filters
               </p>
<button
                  onClick={() => {
                    clearPendingFilters()
                    applyFilters()
                  }}
                  className="mt-4 rounded-[18px] bg-[#45c68d] px-6 py-3 text-[16px] font-extrabold text-white shadow-lg transition hover:translate-y-[-1px]"
                >
                  Clear Filters
                </button>
             </div>
           )}
         </div>

         {/* Pagination */}
         {transformedJobs.length > 0 && (
           <div className="flex items-center justify-center gap-3 pt-2">
             <PagerButton onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>‹</PagerButton>
             {(() => {
               const totalPages = Math.ceil(total / LIMIT)
               const pages: (number | 'ellipsis')[] = []

               if (totalPages <= 7) {
                 for (let i = 1; i <= totalPages; i++) pages.push(i)
               } else {
                 pages.push(1)

                 if (currentPage <= 3) {
                   pages.push(2, 3, 4, 'ellipsis', totalPages)
                 } else if (currentPage >= totalPages - 2) {
                   pages.push('ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
                 } else {
                   pages.push('ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages)
                 }
               }

               return pages.map((page, index) =>
                 page === 'ellipsis' ? (
                   <span key={`ellipsis-${index}`} className="px-2 text-[22px] font-black text-[#73849d]">…</span>
                 ) : (
                   <PagerButton
                     key={page}
                     active={currentPage === page}
                     onClick={() => setCurrentPage(page as number)}
                   >{page}</PagerButton>
                 )
               )
             })()}
             <PagerButton onClick={() => setCurrentPage(p => Math.min(Math.ceil(total / LIMIT), p + 1))}>›</PagerButton>
           </div>
          )}
        </section>
      </div>
    </main>
  )
}
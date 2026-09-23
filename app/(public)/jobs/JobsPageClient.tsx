"use client"

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
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
  const user = useUser()
  const isCompany = user?.role === 'COMPANY'

  const initialActivityValues = new Set(
    (searchParams.get("activityType") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  )
  const [jobs, setJobs] = useState<JobOffer[]>(initialJobs)
  const [total, setTotal] = useState(totalJobs)

  const [selectedActivity, setSelectedActivity] = useState<FilterOption[]>(
    activityTypes.map((item) => ({
      ...item,
      checked: initialActivityValues.has(item.value),
    }))
  )
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    () => searchParams.get("language") ?? ""
  )
  const [location, setLocation] = useState<string>(
    () => searchParams.get("location") ?? ""
  )
  const [currentPage, setCurrentPage] = useState(() => {
    const page = Number.parseInt(searchParams.get("page") ?? "1", 10)
    return Number.isNaN(page) || page < 1 ? 1 : page
  })
  const [searchQuery, setSearchQuery] = useState<string>(
    () => searchParams.get("search") ?? ""
  )
  const [isLoading, setIsLoading] = useState(false)
  const LIMIT = 20

  const buildQueryParams = useCallback((page: number) => {
    const params = new URLSearchParams()
    params.set('page', page.toString())
    params.set('limit', LIMIT.toString())
    params.set('status', 'PUBLISHED')

    if (searchQuery) {
      params.set('search', searchQuery)
    }

 

    const activeActivity = selectedActivity.filter(e => e.checked).map(e => e.value)
    if (activeActivity.length > 0) {
      params.set('activityType', activeActivity.join(','))
    }

    if (selectedLanguage) {
      params.set('language', selectedLanguage)
    }

    if (location) {
      if (location === "Remote") {
        params.set('isRemote', 'true')
      } else {
        params.set('location', location)
      }
    }

    return params.toString()
   }, [searchQuery, selectedActivity, selectedLanguage, location])

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

  useEffect(() => {
    fetchJobs(currentPage)
  }, [currentPage, fetchJobs])



  const toggleActivity = (label: string) => {
    setSelectedActivity(prev =>
      prev.map(item =>
        item.label === label ? { ...item, checked: !item.checked } : item
      )
    )
    setCurrentPage(1)
  }

  const clearAllFilters = () => {
    setSelectedActivity(activityTypes.map(item => ({ ...item, checked: false })))
    setSelectedLanguage("")
    setLocation("")
    setSearchQuery("")
    setCurrentPage(1)

  }

  const hasActiveFilters =
    selectedActivity.some(item => item.checked) ||
    selectedLanguage.length > 0 ||
    location.length > 0 ||
    searchQuery.length > 0

  const checkedActivityCount = selectedActivity.filter(item => item.checked).length

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
      <div className="mx-auto max-w-[1600px] gap-5 lg:grid lg:grid-cols-[320px_1fr]">
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
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full rounded-[16px] border border-[#d7e0ea] bg-white px-4 py-3 text-[16px] font-semibold text-[#344865] placeholder:text-[#95a5be] focus:border-[#45c68d] focus:outline-none focus:ring-2 focus:ring-[#45c68d]/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#95a5be] hover:text-[#344865] transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Location */}
              <select
                aria-label="Location"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value)
                  setCurrentPage(1)
                }}
                className="flex-1 rounded-[16px] border border-[#d7e0ea] bg-white px-4 py-3 text-[16px] font-semibold text-[#344865] shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#45c68d]"
              >
                <option value="">All Cities</option>
                <option value="Remote">Remote</option>
                {locations.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>



                {/* Activity Type */}
                <select
                  value={selectedActivity.find(e => e.checked)?.value || ""}
                  onChange={(e) => {
                    const val = e.target.value
                    setSelectedActivity(prev =>
                      prev.map(item => ({
                        ...item,
                        checked: item.value === val
                      }))
                    )
                    setCurrentPage(1)
                  }}
                  className="rounded-[16px] border border-[#d7e0ea] bg-white px-4 py-3 text-[16px] font-bold text-[#29476f] shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#45c68d]"
                >
                  <option value="">All Activity Types</option>
                  {activityTypes.map(item => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>

               {/* Language */}
               <select
                 value={selectedLanguage}
                 onChange={(e) => {
                   setSelectedLanguage(e.target.value)
                   setCurrentPage(1)
                 }}
                 className="rounded-[16px] border border-[#d7e0ea] bg-white px-4 py-3 text-[16px] font-bold text-[#29476f] shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#45c68d]"
               >
                 <option value="">All Languages</option>
                 {languages.map(item => (
                   <option key={item.value} value={item.value}>{item.label}</option>
                 ))}
               </select>

             {/* Clear / Toggle */}
             <div className="flex items-center gap-2">
               {hasActiveFilters && (
                 <button
                   onClick={clearAllFilters}
                   className="rounded-[16px] border border-[#d7e0ea] bg-white px-4 py-3 text-[14px] font-bold text-red-600 hover:bg-red-50 transition-colors"
                 >
                   Clear
                 </button>
               )}
             </div>
           </div>

           {/* Active Filters */}
           {hasActiveFilters && (
             <div className="mt-3 flex flex-wrap gap-2">
                {searchQuery && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-700">
                    &quot;{searchQuery}&quot;
                    <button onClick={() => setSearchQuery("")} className="hover:text-teal-900 transition-colors">×</button>
                  </span>
                )}
                {location && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700">
                    {location}
                    <button onClick={() => setLocation("")} className="hover:text-blue-900 transition-colors">×</button>
                  </span>
                )}

                {selectedActivity.filter(item => item.checked).map(item => (
                 <span key={item.value} className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
                   {item.label}
                   <button onClick={() => toggleActivity(item.label)} className="hover:text-green-900 transition-colors">×</button>
                 </span>
                ))}
                {selectedLanguage && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-700">
                    {selectedLanguage}
                    <button onClick={() => setSelectedLanguage("")} className="hover:text-purple-900 transition-colors">×</button>
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
                     ({checkedActivityCount + (searchQuery ? 1 : 0) + (selectedLanguage ? 1 : 0) + (location ? 1 : 0)} filters active)
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
                       <div className="h-[76px] w-[76px] shrink-0 rounded-[18px] bg-[#e8edf4]" />
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
                 onClick={clearAllFilters}
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
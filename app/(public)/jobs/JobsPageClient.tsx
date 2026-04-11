"use client"

import { useState, useMemo, useEffect, useCallback } from 'react'
import { 
  FilterGroup, 
  CheckboxRow, 
  MetricCard, 
  InfoText, 
  Tag, 
  PagerButton, 
  JobCard, 
  FeaturedBPOCard,
  JobData
} from './components'

// Filter options - mapped to actual job categories
const activityTypesInitial = [
  { label: "Customer Service", value: "Customer Service", checked: false },
  { label: "Sales & Telesales", value: "Sales", checked: false },
  { label: "Technical Support", value: "Technical Support", checked: false },
  { label: "Back Office", value: "Back Office", checked: false },
  { label: "Retention", value: "Retention", checked: false },
  { label: "Collections", value: "Collections", checked: false },
]

const workModesInitial = [
  { label: "On-site", value: "ON_SITE", checked: false },
  { label: "Remote", value: "REMOTE", checked: false },
  { label: "Hybrid", value: "HYBRID", checked: false },
]

const experienceLevels = [
  { label: "Entry Level", value: "ENTRY_LEVEL", checked: false },
  { label: "Mid Level", value: "MID_LEVEL", checked: false },
  { label: "Senior", value: "SENIOR", checked: false },
  { label: "Lead", value: "LEAD", checked: false },
]

const contractTypesInitial = [
  { label: "CDI (Permanent)", value: "CDI", checked: false },
  { label: "CDD (Contract)", value: "CDD", checked: false },
  { label: "Freelance", value: "FREELANCE", checked: false },
  { label: "Internship", value: "INTERNSHIP", checked: false },
  { label: "Part-time", value: "PART_TIME", checked: false },
]

interface FilterOption {
  label: string
  value: string
  checked: boolean
}

interface JobOffer {
  id: string
  title: string
  slug: string
  salary: string | null
  salaryMax: number | null
  isRemote: boolean
  isHybrid: boolean
  customLocation: string | null
  contractType: string
  experienceLevel: string | null
  department: string | null
  company: {
    id: string
    name: string
    slug: string
    logoUrl: string | null
    industry: string | null
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

export default function JobsPageClient({ initialJobs = [], totalJobs = 0 }: JobsPageClientProps) {
  const [jobs, setJobs] = useState<JobOffer[]>(initialJobs)
  const [total, setTotal] = useState(totalJobs)
  const [selectedActivityTypes, setSelectedActivityTypes] = useState<FilterOption[]>(
    activityTypesInitial
  )
  const [selectedWorkModes, setSelectedWorkModes] = useState<FilterOption[]>(
    workModesInitial
  )
  const [selectedExperience, setSelectedExperience] = useState<FilterOption[]>(
    experienceLevels
  )
  const [selectedContractTypes, setSelectedContractTypes] = useState<FilterOption[]>(
    contractTypesInitial
  )
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [salaryMin, setSalaryMin] = useState(0)
  const [salaryMax, setSalaryMax] = useState(100000)
  const LIMIT = 20

  // Build query params from filters
  const buildQueryParams = useCallback((page: number) => {
    const params = new URLSearchParams()
    params.set('page', page.toString())
    params.set('limit', LIMIT.toString())
    
    // Search
    if (searchQuery) {
      params.set('search', searchQuery)
    }
    
    // Work modes
    const activeWorkModes = selectedWorkModes.filter(w => w.checked).map(w => w.value)
    if (activeWorkModes.length === 1) {
      params.set('workMode', activeWorkModes[0])
    } else if (activeWorkModes.length > 1) {
      // For multiple work modes, we'll filter client-side
    }
    
    // Contract types
    const activeContractTypes = selectedContractTypes.filter(c => c.checked).map(c => c.value)
    if (activeContractTypes.length === 1) {
      params.set('contractType', activeContractTypes[0])
    }
    
    return params.toString()
  }, [searchQuery, selectedWorkModes, selectedContractTypes])

  // Fetch jobs from API
  const fetchJobs = useCallback(async (page: number) => {
    setIsLoading(true)
    try {
      const queryParams = buildQueryParams(page)
      const response = await fetch(`/api/job-offers?${queryParams}`)
      const data = await response.json()
      
      if (data.success) {
        let filteredJobs = data.data || []
        
        // Client-side filtering for multiple work modes
        const activeWorkModes = selectedWorkModes.filter(w => w.checked).map(w => w.value)
        if (activeWorkModes.length > 1) {
          filteredJobs = filteredJobs.filter((job: JobOffer) => 
            (job.isRemote && activeWorkModes.includes("REMOTE")) ||
            (job.isHybrid && activeWorkModes.includes("HYBRID")) ||
            (!job.isRemote && !job.isHybrid && activeWorkModes.includes("ON_SITE"))
          )
        }
        
        // Client-side filtering for contract types
        const activeContractTypes = selectedContractTypes.filter(c => c.checked).map(c => c.value)
        if (activeContractTypes.length > 1) {
          filteredJobs = filteredJobs.filter((job: JobOffer) => 
            activeContractTypes.includes(job.contractType)
          )
        }
        
        // Client-side filtering for salary
        if (salaryMin > 0 || salaryMax < 100000) {
          filteredJobs = filteredJobs.filter((job: JobOffer) => {
            const jobSalary = typeof job.salary === 'string' ? parseFloat(job.salary) : (job.salary || 0)
            return jobSalary >= salaryMin && jobSalary <= salaryMax
          })
        }
        
        // Client-side filtering for department
        const activeDepartments = selectedActivityTypes.filter(d => d.checked).map(d => d.value)
        if (activeDepartments.length > 0) {
          filteredJobs = filteredJobs.filter((job: JobOffer) => 
            activeDepartments.includes(job.department || '')
          )
        }
        
        setJobs(filteredJobs)
        setTotal(data.pagination?.total || filteredJobs.length)
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error)
    } finally {
      setIsLoading(false)
    }
  }, [buildQueryParams, selectedWorkModes, selectedContractTypes, selectedActivityTypes, salaryMin, salaryMax])

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchJobs(currentPage)
  }, [currentPage, fetchJobs])

  // Toggle handlers for activity types
  const toggleActivityType = (label: string) => {
    setSelectedActivityTypes(prev =>
      prev.map(item =>
        item.label === label ? { ...item, checked: !item.checked } : item
      )
    )
    setCurrentPage(1)
  }

  // Toggle handlers for work modes
  const toggleWorkMode = (label: string) => {
    setSelectedWorkModes(prev =>
      prev.map(item =>
        item.label === label ? { ...item, checked: !item.checked } : item
      )
    )
    setCurrentPage(1)
  }

  // Toggle handlers for experience levels
  const toggleExperience = (label: string) => {
    setSelectedExperience(prev =>
      prev.map(item =>
        item.label === label ? { ...item, checked: !item.checked } : item
      )
    )
  }

  // Toggle handlers for contract types
  const toggleContractType = (label: string) => {
    setSelectedContractTypes(prev =>
      prev.map(item =>
        item.label === label ? { ...item, checked: !item.checked } : item
      )
    )
    setCurrentPage(1)
  }

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedActivityTypes(activityTypesInitial.map(item => ({ ...item })))
    setSelectedWorkModes(workModesInitial.map(item => ({ ...item })))
    setSelectedExperience(experienceLevels.map(item => ({ ...item })))
    setSelectedContractTypes(contractTypesInitial.map(item => ({ ...item })))
    setSalaryMin(0)
    setSalaryMax(100000)
    setSearchQuery("")
    setCurrentPage(1)
  }

  // Check if any filters are active
  const hasActiveFilters = 
    selectedActivityTypes.some(item => item.checked) || 
    selectedWorkModes.some(item => item.checked) ||
    selectedExperience.some(item => item.checked) ||
    selectedContractTypes.some(item => item.checked) ||
    searchQuery.length > 0 ||
    salaryMin > 0 ||
    salaryMax < 100000

  // Transform job data for display
  const transformedJobs: JobData[] = jobs.map((job, index) => {
    const salaryNum = typeof job.salary === 'string' ? parseFloat(job.salary) : job.salary
    const salaryFormatted = salaryNum 
      ? `$${(salaryNum / 1000).toFixed(1)}k/mo` 
      : job.salaryMax 
        ? `$${(job.salaryMax / 1000).toFixed(1)}k/mo`
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
      department: job.company.industry || "General",
      extra: job.contractType || "Full-time",
      badge1: job.experienceLevel || "ENTRY LEVEL",
      badge2: workModeLabel,
      icon: "▣",
      isFirst: index === 0,
    }
  })

  // Get checked items count for display
  const checkedActivitiesCount = selectedActivityTypes.filter(item => item.checked).length
  const checkedWorkModesCount = selectedWorkModes.filter(item => item.checked).length
  const checkedContractCount = selectedContractTypes.filter(item => item.checked).length
  const checkedExperienceCount = selectedExperience.filter(item => item.checked).length

  return (
    <main className="min-h-screen  px-4 py-5 text-slate-900 md:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1600px] gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Sidebar - Filters */}
        <aside className="space-y-5">
          {/* Filters Card */}
          <div className="rounded-[26px] bg-[#f4f6f8] p-7 shadow-[0_14px_30px_rgba(0,0,0,0.25)]">
            <div className="mb-7 flex items-center justify-between">
              <h2 className="text-[20px] font-extrabold text-[#1f3558]">Filters</h2>
              {hasActiveFilters && (
                <button 
                  onClick={clearAllFilters}
                  className="text-[15px] font-semibold text-[#40c58a] hover:text-[#35a876] transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="mb-6 flex flex-wrap gap-2">
                {searchQuery && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-700">
                    "{searchQuery}"
                    <button 
                      onClick={() => setSearchQuery("")}
                      className="hover:text-teal-900 transition-colors"
                    >
                      ×
                    </button>
                  </span>
                )}
                {selectedActivityTypes
                  .filter(item => item.checked)
                  .map(item => (
                    <span 
                      key={item.label}
                      className="inline-flex items-center gap-2 rounded-full bg-[#45c68d]/20 px-3 py-1.5 text-xs font-semibold text-[#35a876]"
                    >
                      {item.label}
                      <button 
                        onClick={() => toggleActivityType(item.label)}
                        className="hover:text-[#2a8a60] transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                {selectedWorkModes
                  .filter(item => item.checked)
                  .map(item => (
                    <span 
                      key={item.label}
                      className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700"
                    >
                      {item.label}
                      <button 
                        onClick={() => toggleWorkMode(item.label)}
                        className="hover:text-blue-900 transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                {selectedContractTypes
                  .filter(item => item.checked)
                  .map(item => (
                    <span 
                      key={item.label}
                      className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-700"
                    >
                      {item.label}
                      <button 
                        onClick={() => toggleContractType(item.label)}
                        className="hover:text-purple-900 transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
              </div>
            )}

            {/* Search Input */}
            <div className="mb-6">
              <p className="mb-5 text-[13px] font-extrabold tracking-[0.18em] text-[#95a5be]">
                SEARCH
              </p>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Job title, company..."
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
            </div>

            <FilterGroup title="ACTIVITY TYPE">
              {selectedActivityTypes.map((item) => (
                <CheckboxRow 
                  key={item.label} 
                  label={item.label} 
                  checked={item.checked}
                  onChange={() => toggleActivityType(item.label)}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="WORK MODE">
              {selectedWorkModes.map((item) => (
                <CheckboxRow 
                  key={item.label} 
                  label={item.label} 
                  checked={item.checked}
                  onChange={() => toggleWorkMode(item.label)}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="EXPERIENCE LEVEL">
              {selectedExperience.map((item) => (
                <CheckboxRow 
                  key={item.label} 
                  label={item.label} 
                  checked={item.checked}
                  onChange={() => toggleExperience(item.label)}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="CONTRACT TYPE">
              {selectedContractTypes.map((item) => (
                <CheckboxRow 
                  key={item.label} 
                  label={item.label} 
                  checked={item.checked}
                  onChange={() => toggleContractType(item.label)}
                />
              ))}
            </FilterGroup>

            <div>
              <p className="mb-5 text-[13px] font-extrabold tracking-[0.18em] text-[#95a5be]">
                MONTHLY SALARY
              </p>
              <div className="px-2">
                <div className="mb-3 flex items-center justify-between text-[14px] font-semibold text-[#344865]">
                  <span>${(salaryMin / 1000).toFixed(0)}k</span>
                  <span>${(salaryMax / 1000).toFixed(0)}k+</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100000"
                    step="1000"
                    value={salaryMin}
                    onChange={(e) => {
                      const val = parseInt(e.target.value)
                      if (val <= salaryMax) setSalaryMin(val)
                      setCurrentPage(1)
                    }}
                    className="w-1/2 accent-[#45c68d]"
                  />
                  <input
                    type="range"
                    min="0"
                    max="100000"
                    step="1000"
                    value={salaryMax}
                    onChange={(e) => {
                      const val = parseInt(e.target.value)
                      if (val >= salaryMin) setSalaryMax(val)
                      setCurrentPage(1)
                    }}
                    className="w-1/2 accent-[#45c68d]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Featured BPO Card */}
          <FeaturedBPOCard />

          {/* Stats Card */}
          <div className="rounded-[26px] bg-[#f4f6f8] p-7 shadow-[0_14px_30px_rgba(0,0,0,0.25)]">
            <h3 className="mb-4 text-[16px] font-extrabold text-[#1f3558]">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#7b8ca3]">New jobs today</span>
                <span className="text-[16px] font-bold text-[#45c68d]">+24</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#7b8ca3]">Remote jobs</span>
                <span className="text-[16px] font-bold text-[#45c68d]">156</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#7b8ca3]">Companies hiring</span>
                <span className="text-[16px] font-bold text-[#45c68d]">48</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <section className="space-y-5">
          {/* Hero Banner */}
          <div className="overflow-hidden rounded-[34px] bg-gradient-to-r from-[#18345b] to-[#1f4675] px-7 py-8 text-white shadow-[0_18px_36px_rgba(0,0,0,0.35)] md:px-9 lg:px-10">
            <div className="mb-5 flex items-center justify-between">
              <span className="rounded-full bg-[#42c789] px-4 py-1.5 text-[11px] font-extrabold tracking-[0.12em] text-white">
                PROMOTED EMPLOYER
              </span>
              <button className="text-white/60 hover:text-white transition-colors">
                <span className="text-[20px]">×</span>
              </button>
            </div>

            <div className="grid items-center gap-7 lg:grid-cols-[140px_minmax(0,1fr)_220px]">
              <div className="flex justify-center lg:justify-start">
                <div className="flex h-[124px] w-[124px] items-center justify-center rounded-[28px] border-[8px] border-[#e9edf3] bg-white text-center shadow-[0_8px_20px_rgba(0,0,0,0.25)]">
                  <div className="flex h-[86px] w-[86px] items-center justify-center rounded-[10px] bg-[#0f3040] text-[11px] font-semibold tracking-[0.16em] text-[#dce8dd]">
                    DSWALI
                  </div>
                </div>
              </div>

              <div>
                <h1 className="max-w-[680px] text-[42px] font-black leading-[0.95] tracking-[-0.03em] md:text-[54px]">
                  Build Your Future with <br className="hidden md:block" /> CloudSphere
                </h1>
                <p className="mt-4 max-w-[700px] text-[18px] leading-8 text-[#d7e2f0]">
                  We're expanding our technical support teams in Austin and Remote. Experience a culture of innovation, competitive pay, and rapid career growth.
                </p>

                <div className="mt-7 flex flex-wrap gap-4">
                  <MetricCard label="STARTING AT" value="$22/hr" />
                  <MetricCard label="OPENINGS" value="50+ Roles" />
                  <MetricCard label="LOCATION" value="Remote" />
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:items-end">
                <button className="rounded-[22px] bg-[#45c68d] px-9 py-5 text-[20px] font-extrabold text-white shadow-[0_14px_26px_rgba(69,198,141,0.35)] transition hover:translate-y-[-1px]">
                  View All Jobs
                </button>
                <span className="text-center text-[14px] font-semibold text-[#d7e2f0] lg:text-right">
                  128 people applied this week
                </span>
              </div>
            </div>
          </div>

          {/* Results Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-[28px] font-black tracking-[-0.03em] text-[#163257]">Call Center Jobs</h2>
              <p className="mt-1 text-[18px] font-semibold text-[#70839c]">
                Showing {transformedJobs.length} of {total} opportunities
                {hasActiveFilters && (
                  <span className="ml-1 text-[#45c68d]">
                    ({checkedActivitiesCount + checkedWorkModesCount + checkedExperienceCount + (searchQuery ? 1 : 0)} filters active)
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <span className="text-[18px] font-bold text-[#163257]">Sort by:</span>
              <select className="flex min-w-[200px] items-center justify-between rounded-[16px] border border-[#d7e0ea] bg-white px-5 py-4 text-[18px] font-bold text-[#29476f] shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#45c68d]">
                <option value="newest">Newest First</option>
                <option value="salary-high">Salary: High to Low</option>
                <option value="salary-low">Salary: Low to High</option>
                <option value="relevance">Relevance</option>
              </select>
            </div>
          </div>

          {/* Job Listings */}
          <div className="space-y-5">
            {isLoading ? (
              // Loading skeleton
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
              transformedJobs.map((job, index) => (
                <JobCard key={job.title} job={job} index={index} />
              ))
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
                  // Show all pages if 7 or fewer
                  for (let i = 1; i <= totalPages; i++) pages.push(i)
                } else {
                  // Always show first page
                  pages.push(1)
                  
                  if (currentPage <= 3) {
                    // Near the start
                    pages.push(2, 3, 4, 'ellipsis', totalPages)
                  } else if (currentPage >= totalPages - 2) {
                    // Near the end
                    pages.push('ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
                  } else {
                    // In the middle
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

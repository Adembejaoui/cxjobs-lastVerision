"use client"

import { useState, useMemo, useEffect, useCallback } from 'react'
import { FilterGroup } from '../jobs/components/FilterGroup'
import { CheckboxRow } from '../jobs/components/CheckboxRow'
import { MetricCard } from '../jobs/components/MetricCard'
import { PagerButton } from '../jobs/components/PagerButton'
import { CompanyCard } from './components/CompanyCard'

// Filter options
const companySizesInitial = [
  { label: "Startup (1-10)", value: "startup", min: 1, max: 10, checked: false },
  { label: "Small (11-50)", value: "small", min: 11, max: 50, checked: false },
  { label: "Medium (51-200)", value: "medium", min: 51, max: 200, checked: false },
  { label: "Large (201-1000)", value: "large", min: 201, max: 1000, checked: false },
  { label: "Enterprise (1000+)", value: "enterprise", min: 1000, max: Infinity, checked: false },
]

const industriesInitial = [
  { label: "Technology", value: "Technology", checked: false },
  { label: "Retail", value: "Retail", checked: false },
  { label: "Telecommunications", value: "Telecommunications", checked: false },
  { label: "Finance", value: "Finance", checked: false },
  { label: "Media", value: "Media", checked: false },
  { label: "Logistics", value: "Logistics", checked: false },
  { label: "Sales", value: "Sales", checked: false },
]

const locationsInitial = [
  { label: "Remote", value: "Remote", checked: false },
  { label: "US Based", value: "US", checked: false },
  { label: "International", value: "International", checked: false },
]

const ratingsInitial = [
  { label: "4.5+ Stars", value: 4.5, checked: false },
  { label: "4.0+ Stars", value: 4.0, checked: false },
  { label: "3.5+ Stars", value: 3.5, checked: false },
]

interface FilterOption {
  label: string
  value: string
  min?: number
  max?: number
  checked: boolean
}

interface RatingOption {
  label: string
  value: number
  checked: boolean
}

interface CompanyData {
  id: string
  name: string
  slug: string
  description: string
  industry: string
  location: string
  size: string
  jobsCount: number
  rating: number
  reviews: number
  logoUrl: string | null
  coverUrl: string | null
  isFeatured?: boolean
}

interface CompanyFromAPI {
  id: string
  name: string
  slug: string
  description: string | null
  industry: string | null
  companySize: string | null
  location: string | null
  logoUrl: string | null
  coverImageUrl: string | null
  createdAt: Date
  _count?: {
    jobs: number
  }
}

interface CompaniesPageClientProps {
  initialCompanies?: CompanyFromAPI[]
  totalCompanies?: number
}

export default function CompaniesPageClient({ initialCompanies = [], totalCompanies = 0 }: CompaniesPageClientProps) {
  const [companies, setCompanies] = useState<CompanyFromAPI[]>(initialCompanies)
  const [total, setTotal] = useState(totalCompanies)
  const [selectedSizes, setSelectedSizes] = useState<FilterOption[]>(companySizesInitial)
  const [selectedIndustries, setSelectedIndustries] = useState<FilterOption[]>(industriesInitial)
  const [selectedLocations, setSelectedLocations] = useState<FilterOption[]>(locationsInitial)
  const [selectedRatings, setSelectedRatings] = useState<RatingOption[]>(ratingsInitial)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
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
    
    // Industry
    const activeIndustries = selectedIndustries.filter(i => i.checked).map(i => i.value)
    if (activeIndustries.length === 1) {
      params.set('industry', activeIndustries[0])
    }
    
    // Location
    const activeLocations = selectedLocations.filter(l => l.checked).map(l => l.value)
    if (activeLocations.length === 1) {
      params.set('location', activeLocations[0])
    }
    
    return params.toString()
  }, [searchQuery, selectedIndustries, selectedLocations])

  // Fetch companies from API
  const fetchCompanies = useCallback(async (page: number) => {
    setIsLoading(true)
    try {
      const queryParams = buildQueryParams(page)
      const response = await fetch(`/api/profile/allCompanies?${queryParams}`)
      const data = await response.json()
      
      if (data.success) {
        let filteredCompanies = data.data || []
        
        // Client-side filtering for multiple industries
        const activeIndustries = selectedIndustries.filter(i => i.checked).map(i => i.value)
        if (activeIndustries.length > 1) {
          filteredCompanies = filteredCompanies.filter((company: CompanyFromAPI) => 
            activeIndustries.includes(company.industry || '')
          )
        }
        
        // Client-side filtering for company size
        const activeSizes = selectedSizes.filter(s => s.checked)
        if (activeSizes.length > 0) {
          filteredCompanies = filteredCompanies.filter((company: CompanyFromAPI) => {
            const companySizeNum = parseInt(company.companySize?.match(/\d+/)?.[0] || "0")
            return activeSizes.some(size => 
              companySizeNum >= (size.min || 0) && companySizeNum <= (size.max || Infinity)
            )
          })
        }
        
        // Client-side filtering for locations
        const activeLocations = selectedLocations.filter(l => l.checked).map(l => l.value)
        if (activeLocations.length > 1) {
          filteredCompanies = filteredCompanies.filter((company: CompanyFromAPI) => {
            const loc = company.location || ''
            return activeLocations.some(l => {
              if (l === "Remote") return loc.toLowerCase().includes("remote")
              if (l === "US") return !loc.toLowerCase().includes("remote")
              return true
            })
          })
        }
        
        setCompanies(filteredCompanies)
        setTotal(data.pagination?.total || filteredCompanies.length)
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error)
    } finally {
      setIsLoading(false)
    }
  }, [buildQueryParams, selectedIndustries, selectedSizes, selectedLocations])

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchCompanies(currentPage)
  }, [currentPage, fetchCompanies])

  // Toggle handlers
  const toggleFilter = (
    setter: React.Dispatch<React.SetStateAction<FilterOption[]>>,
    label: string
  ) => {
    setter(prev =>
      prev.map(item =>
        item.label === label ? { ...item, checked: !item.checked } : item
      )
    )
    setCurrentPage(1)
  }

  // Toggle rating filter
  const toggleRating = (value: number) => {
    setSelectedRatings(prev =>
      prev.map(item =>
        item.value === value ? { ...item, checked: !item.checked } : item
      )
    )
  }

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedSizes(companySizesInitial.map(item => ({ ...item })))
    setSelectedIndustries(industriesInitial.map(item => ({ ...item })))
    setSelectedLocations(locationsInitial.map(item => ({ ...item })))
    setSelectedRatings(ratingsInitial.map(item => ({ ...item })))
    setSearchQuery("")
    setCurrentPage(1)
  }

  // Check if any filters are active
  const hasActiveFilters = 
    selectedSizes.some(item => item.checked) || 
    selectedIndustries.some(item => item.checked) ||
    selectedLocations.some(item => item.checked) ||
    selectedRatings.some(item => item.checked) ||
    searchQuery.length > 0

  // Transform company data for display
  const transformedCompanies: CompanyData[] = companies.map((company, index) => ({
    id: company.id,
    name: company.name,
    slug: company.slug,
    description: company.description || "",
    industry: company.industry || "General",
    location: company.location || "Not specified",
    size: company.companySize || "Unknown",
    jobsCount: company._count?.jobs ?? 0,
    rating: 4.0 + (index % 10) * 0.05, // Deterministic rating based on index
    reviews: 10 + (index * 7) % 190, // Deterministic reviews based on index
    logoUrl: company.logoUrl,
    coverUrl: company.coverImageUrl,
    isFeatured: index === 0,
  }))

  // Get checked items count
  const checkedCount = 
    selectedSizes.filter(item => item.checked).length +
    selectedIndustries.filter(item => item.checked).length +
    selectedLocations.filter(item => item.checked).length +
    selectedRatings.filter(item => item.checked).length

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
                {selectedSizes
                  .filter(item => item.checked)
                  .map(item => (
                    <span 
                      key={item.label}
                      className="inline-flex items-center gap-2 rounded-full bg-[#45c68d]/20 px-3 py-1.5 text-xs font-semibold text-[#35a876]"
                    >
                      {item.label}
                      <button 
                        onClick={() => toggleFilter(setSelectedSizes, item.label)}
                        className="hover:text-[#2a8a60] transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                {selectedIndustries
                  .filter(item => item.checked)
                  .map(item => (
                    <span 
                      key={item.label}
                      className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700"
                    >
                      {item.label}
                      <button 
                        onClick={() => toggleFilter(setSelectedIndustries, item.label)}
                        className="hover:text-blue-900 transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                {selectedRatings
                  .filter(item => item.checked)
                  .map(item => (
                    <span 
                      key={item.label}
                      className="inline-flex items-center gap-2 rounded-full bg-yellow-100 px-3 py-1.5 text-xs font-semibold text-yellow-700"
                    >
                      {item.label}
                      <button 
                        onClick={() => toggleRating(item.value)}
                        className="hover:text-yellow-900 transition-colors"
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
                  placeholder="Company name, industry..."
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

            <FilterGroup title="COMPANY SIZE">
              {selectedSizes.map((item) => (
                <CheckboxRow 
                  key={item.label} 
                  label={item.label} 
                  checked={item.checked}
                  onChange={() => toggleFilter(setSelectedSizes, item.label)}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="INDUSTRY">
              {selectedIndustries.map((item) => (
                <CheckboxRow 
                  key={item.label} 
                  label={item.label} 
                  checked={item.checked}
                  onChange={() => toggleFilter(setSelectedIndustries, item.label)}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="LOCATION">
              {selectedLocations.map((item) => (
                <CheckboxRow 
                  key={item.label} 
                  label={item.label} 
                  checked={item.checked}
                  onChange={() => toggleFilter(setSelectedLocations, item.label)}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="MINIMUM RATING">
              {selectedRatings.map((item) => (
                <CheckboxRow 
                  key={item.value} 
                  label={item.label} 
                  checked={item.checked}
                  onChange={() => toggleRating(item.value)}
                />
              ))}
            </FilterGroup>
          </div>

          {/* Featured Employer Card */}
          <div className="overflow-hidden rounded-[26px] bg-gradient-to-br from-[#223f6a] to-[#173258] p-7 text-white shadow-[0_16px_34px_rgba(0,0,0,0.35)]">
            <div className="mb-5 flex justify-end">
              <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold tracking-[0.12em] text-[#dfe7f4]">
                TOP EMPLOYER
              </span>
            </div>

            <div className="mx-auto mb-6 flex h-[86px] w-[86px] items-center justify-center rounded-[26px] border-[8px] border-white bg-[#eff3f8] text-[28px] text-[#274364] shadow-md">
              ◫
            </div>

            <h3 className="mx-auto mb-4 max-w-[210px] text-center text-[18px] font-extrabold leading-6">
              Discover Top-Rated Workplaces
            </h3>
            <p className="mb-6 text-center text-[14px] leading-6 text-[#d8e2ef]">
              Join 500+ companies rated 4.5+ stars by our community of CX professionals.
            </p>

            <div className="mb-7 space-y-3 text-[14px] text-[#eaf5f0]">
              {[
                "Verified Employee Reviews",
                "Salary Transparency",
                "Growth Opportunities",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#45c68d] text-[12px] font-bold text-white">
                    ✓
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <button className="w-full rounded-[14px] bg-[#45c68d] py-4 text-[16px] font-extrabold text-white shadow-lg transition hover:translate-y-[-1px]">
              Browse Companies
            </button>
          </div>

          {/* Stats Card */}
          <div className="rounded-[26px] bg-[#f4f6f8] p-7 shadow-[0_14px_30px_rgba(0,0,0,0.25)]">
            <h3 className="mb-4 text-[16px] font-extrabold text-[#1f3558]">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#7b8ca3]">New companies</span>
                <span className="text-[16px] font-bold text-[#45c68d]">+12</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#7b8ca3]">Hiring now</span>
                <span className="text-[16px] font-bold text-[#45c68d]">156</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#7b8ca3]">Avg rating</span>
                <span className="text-[16px] font-bold text-[#45c68d]">4.3★</span>
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
                FEATURED EMPLOYERS
              </span>
              <button className="text-white/60 hover:text-white transition-colors">
                <span className="text-[20px]">×</span>
              </button>
            </div>

            <div className="grid items-center gap-7 lg:grid-cols-[140px_minmax(0,1fr)_220px]">
              <div className="flex justify-center lg:justify-start">
                <div className="flex h-[124px] w-[124px] items-center justify-center rounded-[28px] border-[8px] border-[#e9edf3] bg-white text-center shadow-[0_8px_20px_rgba(0,0,0,0.25)]">
                  <div className="flex h-[86px] w-[86px] items-center justify-center rounded-[10px] bg-[#0f3040] text-[11px] font-semibold tracking-[0.16em] text-[#dce8dd]">
                    TOP RATED
                  </div>
                </div>
              </div>

              <div>
                <h1 className="max-w-[680px] text-[42px] font-black leading-[0.95] tracking-[-0.03em] md:text-[54px]">
                  Find Your Dream <br className="hidden md:block" /> Workplace
                </h1>
                <p className="mt-4 max-w-[700px] text-[18px] leading-8 text-[#d7e2f0]">
                  Explore top-rated companies in the CX industry. Discover cultures that match your career goals and values.
                </p>

                <div className="mt-7 flex flex-wrap gap-4">
                  <MetricCard label="COMPANIES" value="200+" />
                  <MetricCard label="OPEN JOBS" value="1000+" />
                  <MetricCard label="AVG RATING" value="4.5★" />
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:items-end">
                <button className="rounded-[22px] bg-[#45c68d] px-9 py-5 text-[20px] font-extrabold text-white shadow-[0_14px_26px_rgba(69,198,141,0.35)] transition hover:translate-y-[-1px]">
                  Post a Job
                </button>
                <span className="text-center text-[14px] font-semibold text-[#d7e2f0] lg:text-right">
                  Join 10,000+ professionals
                </span>
              </div>
            </div>
          </div>

          {/* Results Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-[28px] font-black tracking-[-0.03em] text-[#163257]">Top Companies</h2>
              <p className="mt-1 text-[18px] font-semibold text-[#70839c]">
                Showing {transformedCompanies.length} of {total} companies
                {hasActiveFilters && (
                  <span className="ml-1 text-[#45c68d]">
                    ({checkedCount + (searchQuery ? 1 : 0)} filters active)
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <span className="text-[18px] font-bold text-[#163257]">Sort by:</span>
              <select className="flex min-w-[200px] items-center justify-between rounded-[16px] border border-[#d7e0ea] bg-white px-5 py-4 text-[18px] font-bold text-[#29476f] shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#45c68d]">
                <option value="top-rated">Top Rated</option>
                <option value="most-jobs">Most Jobs</option>
                <option value="most-reviews">Most Reviews</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>

          {/* Company Listings - 3 Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {isLoading ? (
              // Loading skeleton
              <>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="rounded-[24px] bg-[#f7f9fb] p-6 shadow-[0_8px_20px_rgba(0,0,0,0.1)] ring-1 ring-[#e8edf4] animate-pulse">
                    <div className="h-[4px] rounded-t-[24px] bg-[#45c68d]/50 mb-4" />
                    <div className="flex h-[72px] w-[72px] rounded-[18px] bg-[#e8edf4] mb-4" />
                    <div className="h-5 w-3/4 rounded bg-[#e8edf4] mb-2" />
                    <div className="h-4 w-1/2 rounded bg-[#e8edf4] mb-4" />
                    <div className="flex gap-2 mb-4">
                      <div className="h-6 w-20 rounded-full bg-[#e8edf4]" />
                      <div className="h-6 w-16 rounded-full bg-[#e8edf4]" />
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="h-4 w-full rounded bg-[#e8edf4]" />
                      <div className="h-4 w-3/4 rounded bg-[#e8edf4]" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-10 w-1/2 rounded-[14px] bg-[#e8edf4]" />
                      <div className="h-10 w-1/2 rounded-[14px] bg-[#e8edf4]" />
                    </div>
                  </div>
                ))}
              </>
            ) : transformedCompanies.length > 0 ? (
              transformedCompanies.map((company) => (
                <CompanyCard 
                  key={company.id}
                  name={company.name}
                  slug={company.slug}
                  description={company.description}
                  industry={company.industry}
                  location={company.location}
                  size={company.size}
                  jobsCount={company.jobsCount}
                  rating={company.rating}
                  reviews={company.reviews}
                  logoUrl={company.logoUrl}
                  coverUrl={company.coverUrl}
                />
              ))
            ) : (
              <div className="col-span-full rounded-[30px] bg-[#f7f9fb] px-6 py-12 text-center shadow-[0_10px_24px_rgba(0,0,0,0.12)] ring-1 ring-[#e8edf4]">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#e8edf4] text-[32px]">
                  🔍
                </div>
                <p className="text-[20px] font-bold text-[#7b8ca3]">No companies found matching your filters</p>
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
          {transformedCompanies.length > 0 && (
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

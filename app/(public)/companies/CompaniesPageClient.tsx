"use client"

import { useState, useEffect, useCallback } from 'react'
import { CompanyCard, PagerButton } from './components'
import { AdminBannerCard, type AdminBanner } from '@/components/admin-banner'
import { logger } from "@/lib/logger";

interface FilterOption {
  label: string
  value: string
  min?: number
  max?: number
  checked: boolean
}

interface CompanyFromAPI {
  id: string
  name: string
  slug: string
  description: string | null
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

const companySizesInitial = [
  { label: "1-10 employees", value: "1-10", min: 1, max: 10, checked: false },
  { label: "11-50 employees", value: "11-50", min: 11, max: 50, checked: false },
  { label: "51-200 employees", value: "51-200", min: 51, max: 200, checked: false },
  { label: "201-1000 employees", value: "201-1000", min: 201, max: 1000, checked: false },
  { label: "1000+ employees", value: "1000+", min: 1000, max: Infinity, checked: false },
]

const locationsInitial = [
  { label: "Tunis", value: "Tunis", checked: false },
  { label: "Zaghouan", value: "Zaghouan", checked: false },
  { label: "Ariana", value: "Ariana", checked: false },
  { label: "Béja", value: "Béja", checked: false },
  { label: "Ben Arous", value: "Ben Arous", checked: false },
  { label: "Bizerte", value: "Bizerte", checked: false },
  { label: "Gabès", value: "Gabès", checked: false },
  { label: "Gafsa", value: "Gafsa", checked: false },
  { label: "Jendouba", value: "Jendouba", checked: false },
  { label: "Kairouan", value: "Kairouan", checked: false },
  { label: "Kasserine", value: "Kasserine", checked: false },
  { label: "Kebili", value: "Kebili", checked: false },
  { label: "Kef", value: "Kef", checked: false },
  { label: "Mahdia", value: "Mahdia", checked: false },
  { label: "Manouba", value: "Manouba", checked: false },
  { label: "Medenine", value: "Medenine", checked: false },
  { label: "Monastir", value: "Monastir", checked: false },
  { label: "Nabeul", value: "Nabeul", checked: false },
  { label: "Sfax", value: "Sfax", checked: false },
  { label: "Sidi Bouzid", value: "Sidi Bouzid", checked: false },
  { label: "Siliana", value: "Siliana", checked: false },
  { label: "Sousse", value: "Sousse", checked: false },
  { label: "Tataouine", value: "Tataouine", checked: false },
  { label: "Tozeur", value: "Tozeur", checked: false },
]

const MOCK_BANNERS: AdminBanner[] = [
  {
    id: "company-banner-1",
    priority: 1,
    title: "Top-Rated CX Employers — Verified Reviews",
    description: "Discover 200+ companies rated by customer experience professionals. Find your next career move with confidence.",
    image: null,
    backgroundImage: "https://hvbbactmgfhecqbetlhg.supabase.co/storage/v1/object/public/covers/3072fe0f-914c-49ba-ad81-83e061683df2/1779137761635-3m7sdt.png",
    badge: "FEATURED EMPLOYERS",
    ctaText: "Explore Companies",
    ctaLink: "/companies?filter=top-rated",
    ctaExternal: false,
  },
  {
    id: "company-banner-2",
    priority: 2,
    title: "Post Your First Job Today",
    description: "Reach thousands of CX candidates. Simple pricing, no hidden fees.",
    image: null,
    badge: "FOR EMPLOYERS",
    ctaText: "Post a Job",
    ctaLink: "/dashboard/company/jobs",
    ctaExternal: false,
  },
  {
    id: "company-banner-3",
    priority: 3,
    title: "CX Industry Report 2026",
    description: "Trends, salaries, and hiring insights for customer experience teams.",
    image: null,
    badge: "RESOURCE",
    ctaText: "Read Report",
    ctaLink: "https://example.com/cx-industry-report-2026",
    ctaExternal: true,
  },
  {
    id: "company-banner-4",
    priority: 4,
    mode: "image",
    backgroundImage: "https://hvbbactmgfhecqbetlhg.supabase.co/storage/v1/object/public/logos/3072fe0f-914c-49ba-ad81-83e061683df2/1779137720717-y554l6.png",
    ctaLink: "https://example.com/cx-industry-report-2026",
    ctaExternal: true,
  },
];

const sortedBanners = [...MOCK_BANNERS].sort((a, b) => a.priority - b.priority);
// Banners with priority > 1: these live in the left sidebar on desktop
const sidebarBanners = sortedBanners.filter((b) => b.priority > 1);
// Banner with priority 1: this sits above the company list, on every device
const topBanner = sortedBanners.filter((b) => b.priority === 1);

export default function CompaniesPageClient({ initialCompanies = [], totalCompanies = 0 }: CompaniesPageClientProps) {
  const [companies, setCompanies] = useState<CompanyFromAPI[]>(initialCompanies)
  const [total, setTotal] = useState(totalCompanies)
  const [selectedSizes, setSelectedSizes] = useState<FilterOption[]>(companySizesInitial)
  const [selectedLocations, setSelectedLocations] = useState<FilterOption[]>(locationsInitial)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const LIMIT = 20

  const buildQueryParams = useCallback((page: number) => {
    const params = new URLSearchParams()
    params.set('page', page.toString())
    params.set('limit', LIMIT.toString())

    if (searchQuery) {
      params.set('search', searchQuery)
    }

    const activeLocation = selectedLocations.find(l => l.checked)
    if (activeLocation) {
      params.set('location', activeLocation.value)
    }

    const activeSize = selectedSizes.find(s => s.checked)
    if (activeSize) {
      params.set('companySize', activeSize.value)
    }

  

    return params.toString()
  }, [searchQuery, selectedLocations, selectedSizes])

  const fetchCompanies = useCallback(async (page: number) => {
    setIsLoading(true)
    try {
      const queryParams = buildQueryParams(page)
      const response = await fetch(`/api/profile/allCompanies?${queryParams}`)
      const data = await response.json()

      if (data.success) {
        setCompanies(data.data || [])
        setTotal(data.pagination?.total || 0)
      }
    } catch {
      logger.error("Failed to fetch companies");
    } finally {
      setIsLoading(false)
    }
  }, [buildQueryParams])

  useEffect(() => {
    fetchCompanies(currentPage)
  }, [currentPage, fetchCompanies])

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

  const clearAllFilters = () => {
    setSelectedSizes(companySizesInitial.map(item => ({ ...item })))
    setSelectedLocations(locationsInitial.map(item => ({ ...item })))
    setSearchQuery("")
    setCurrentPage(1)

  }

  const hasActiveFilters =
    selectedSizes.some(item => item.checked) ||
    selectedLocations.some(item => item.checked) ||
    searchQuery.length > 0 


  const transformedCompanies = companies.map((company, index) => ({
    id: company.id,
    name: company.name,
    slug: company.slug,
    description: company.description || "",
    location: company.location || "Not specified",
    size: company.companySize || "Unknown",
    jobsCount: company._count?.jobs ?? 0,
    logoUrl: company.logoUrl,
    coverUrl: company.coverImageUrl,
    isFeatured: index === 0,
  }))

  const checkedCount = selectedSizes.filter(item => item.checked).length + selectedLocations.filter(item => item.checked).length

  // NOTE: previously this interleaved sidebar-priority banners every 2 cards.
  // Since those banners now live permanently in the sidebar (desktop) /
  // mobile fallback block, the grid itself no longer needs inline injection.
  const renderCompanyList = () => {
    return transformedCompanies.map((company) => (
      <CompanyCard
        key={company.id}
        name={company.name}
        slug={company.slug}
        description={company.description}
        location={company.location}
        size={company.size}
        jobsCount={company.jobsCount}
        logoUrl={company.logoUrl}
        coverUrl={company.coverUrl}
      />
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

        {/* Main Content: priority 1 banner + filters + company grid + pagination */}
        <section className="space-y-5">
          {/* Priority 1 banner, shown above the company list on every device */}
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
                  placeholder="Search companies, industries..."
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
                value={selectedLocations.find(l => l.checked)?.value || ""}
                onChange={(e) => {
                  const val = e.target.value
                  setSelectedLocations(prev =>
                    prev.map(item => ({
                      ...item,
                      checked: item.value === val
                    }))
                  )
                  setCurrentPage(1)
                }}
                className="rounded-[16px] border border-[#d7e0ea] bg-white px-4 py-3 text-[16px] font-bold text-[#29476f] shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#45c68d]"
              >
                <option value="">All Locations</option>
                {locationsInitial.map(item => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              {/* Clear */}
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
                {selectedLocations.filter(item => item.checked).map(item => (
                  <span key={item.value} className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700">
                    {item.label}
                    <button onClick={() => toggleFilter(setSelectedLocations, item.label)} className="hover:text-blue-900 transition-colors">×</button>
                  </span>
                ))}
                {selectedSizes.filter(item => item.checked).map(item => (
                  <span key={item.value} className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-700">
                    {item.label}
                    <button onClick={() => toggleFilter(setSelectedSizes, item.label)} className="hover:text-purple-900 transition-colors">×</button>
                  </span>
                ))}
              </div>
            )}
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
          </div>

          {/* Company Listings - 3 Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {isLoading ? (
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
              renderCompanyList()
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
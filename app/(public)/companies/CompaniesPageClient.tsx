"use client"

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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
  const searchParams = useSearchParams()
  const router = useRouter()

  const LIMIT = 20

  // URL initialization: read the supported query parameters and seed both the
  // pending and the applied filter states from them, so the first company-list
  // request already uses the URL's filters (no default-then-URL double fetch).
  // useSearchParams is safe during server rendering — no window access here.
  const initialSearch = searchParams.get('search') ?? ''
  const initialLocation = searchParams.get('location') ?? ''
  const initialCompanySize = searchParams.get('companySize') ?? ''
  const initialPageParam = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const initialPage = Number.isNaN(initialPageParam) || initialPageParam < 1 ? 1 : initialPageParam

  const locationsWithSelection = (value: string) =>
    locationsInitial.map(item => ({ ...item, checked: item.value === value }))

  const sizesWithSelection = (value: string) =>
    companySizesInitial.map(item => ({ ...item, checked: item.value === value }))

  // Pending filter state: what the editable controls stage. Changing these never
  // triggers a request, never updates the results, and never changes the URL —
  // the user must click "Apply Filters".
  const [pendingSearch, setPendingSearch] = useState(initialSearch)
  const [pendingLocations, setPendingLocations] = useState<FilterOption[]>(() => locationsWithSelection(initialLocation))
  const [pendingSizes, setPendingSizes] = useState<FilterOption[]>(() => sizesWithSelection(initialCompanySize))

  // Applied filter state: the source of truth for company fetching and the URL.
  const [appliedSearch, setAppliedSearch] = useState(initialSearch)
  const [appliedLocations, setAppliedLocations] = useState<FilterOption[]>(() => locationsWithSelection(initialLocation))
  const [appliedSizes, setAppliedSizes] = useState<FilterOption[]>(() => sizesWithSelection(initialCompanySize))

  const [companies, setCompanies] = useState<CompanyFromAPI[]>(initialCompanies)
  const [total, setTotal] = useState(totalCompanies)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [isLoading, setIsLoading] = useState(false)

  // buildQueryParams reads ONLY the applied state, so pending edits can never
  // leak into a request.
  const buildQueryParams = useCallback((page: number) => {
    const params = new URLSearchParams()
    params.set('page', page.toString())
    params.set('limit', LIMIT.toString())

    if (appliedSearch) {
      params.set('search', appliedSearch)
    }

    const activeLocation = appliedLocations.find(l => l.checked)
    if (activeLocation) {
      params.set('location', activeLocation.value)
    }

    const activeSize = appliedSizes.find(s => s.checked)
    if (activeSize) {
      params.set('companySize', activeSize.value)
    }

    return params.toString()
  }, [appliedSearch, appliedLocations, appliedSizes])

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

  // Fetch when the current page changes OR when the APPLIED filters change.
  // Pending edits are deliberately excluded from buildQueryParams, so they never
  // enter this dependency list and produce zero requests. When "Apply Filters"
  // is clicked, the applied states change, which recreates buildQueryParams and
  // fetchCompanies and re-runs this effect exactly once (React batches the
  // state updates, so several applied values changing together still yield one
  // request).
  useEffect(() => {
    fetchCompanies(currentPage)
  }, [currentPage, fetchCompanies])

  // Keep the URL in sync with the applied filters and pagination. Pending edits
  // are not dependencies, so they never change the URL. The effect only runs on
  // the client, so reading window.location.search is safe. The string comparison
  // avoids a redundant replace when the URL already matches (e.g. on mount).
  useEffect(() => {
    const currentQuery = window.location.search.startsWith('?')
      ? window.location.search.slice(1)
      : window.location.search

    const params = new URLSearchParams(currentQuery)
    params.set('page', currentPage.toString())

    if (appliedSearch) {
      params.set('search', appliedSearch)
    } else {
      params.delete('search')
    }

    const activeLocation = appliedLocations.find(l => l.checked)
    if (activeLocation) {
      params.set('location', activeLocation.value)
    } else {
      params.delete('location')
    }

    const activeSize = appliedSizes.find(s => s.checked)
    if (activeSize) {
      params.set('companySize', activeSize.value)
    } else {
      params.delete('companySize')
    }

    const nextQuery = params.toString()
    if (nextQuery !== currentQuery) {
      router.replace(`/companies?${nextQuery}`, { scroll: false })
    }
  }, [currentPage, appliedSearch, appliedLocations, appliedSizes, router])

  // Toggle a filter chip. Chips apply immediately, so they update both the
  // pending and the applied state in one batched update (one request).
  const toggleFilter = (
    pendingSetter: React.Dispatch<React.SetStateAction<FilterOption[]>>,
    appliedSetter: React.Dispatch<React.SetStateAction<FilterOption[]>>,
    label: string
  ) => {
    const toggle = (prev: FilterOption[]) =>
      prev.map(item =>
        item.label === label ? { ...item, checked: !item.checked } : item
      )
    pendingSetter(toggle)
    appliedSetter(toggle)
    setCurrentPage(1)
  }

  // Clear ALL filters — pending and applied — and immediately refresh the
  // list. Resets pagination to page 1 and clears the URL filters. Used by
  // the filter-bar Clear button and the empty-state Clear Filters action.
  const clearAllFilters = () => {
    const clearedLocations = locationsInitial.map(item => ({ ...item }))
    const clearedSizes = companySizesInitial.map(item => ({ ...item }))
    setPendingLocations(clearedLocations)
    setPendingSizes(clearedSizes)
    setPendingSearch("")
    commitFilters("", clearedLocations, clearedSizes)
  }

  // Commit filters into the applied state and reset pagination to page 1. The
  // URL syncs through the effect above, and the batched state updates make the
  // fetch effect run exactly once with the new applied filters.
  const commitFilters = (search: string, locations: FilterOption[], sizes: FilterOption[]) => {
    setAppliedSearch(search)
    setAppliedLocations(locations)
    setAppliedSizes(sizes)
    setCurrentPage(1)
  }

  // Apply the staged (pending) filters. Guarded against duplicate submissions
  // while a request is in progress. Works even when the current page is
  // already page 1 — the applied-state change alone re-runs the fetch effect.
  const applyFilters = () => {
    if (isLoading) return
    commitFilters(pendingSearch, pendingLocations, pendingSizes)
  }

  // Derived from the APPLIED filters — these drive the rendered chips and the
  // "filters active" count. Pending changes do not affect these until Apply.
  const hasActiveFilters =
    appliedSizes.some(item => item.checked) ||
    appliedLocations.some(item => item.checked) ||
    appliedSearch.length > 0

  const checkedCount = appliedSizes.filter(item => item.checked).length + appliedLocations.filter(item => item.checked).length

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
                  value={pendingSearch}
                  onChange={(e) => {
                    setPendingSearch(e.target.value)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      applyFilters()
                    }
                  }}
                  className="w-full rounded-[16px] border border-[#d7e0ea] bg-white px-4 py-3 text-[16px] font-semibold text-[#344865] placeholder:text-[#95a5be] focus:border-[#45c68d] focus:outline-none focus:ring-2 focus:ring-[#45c68d]/20"
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
                value={pendingLocations.find(l => l.checked)?.value || ""}
                onChange={(e) => {
                  const val = e.target.value
                  setPendingLocations(prev =>
                    prev.map(item => ({
                      ...item,
                      checked: item.value === val
                    }))
                  )
                }}
                className="rounded-[16px] border border-[#d7e0ea] bg-white px-4 py-3 text-[16px] font-bold text-[#29476f] shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#45c68d]"
              >
                <option value="">All Locations</option>
                {locationsInitial.map(item => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              {/* Reset / Apply */}
              <div className="flex items-center gap-2">
                <button
                  onClick={clearAllFilters}
                  className="rounded-[16px] border border-[#d7e0ea] bg-white px-4 py-3 text-[14px] font-bold text-red-600 hover:bg-red-50 transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={applyFilters}
                  disabled={isLoading}
                  className="rounded-[16px] border border-[#45c68d] bg-[#45c68d] px-4 py-3 text-[14px] font-bold text-white hover:bg-[#38b073] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Apply Filters
                </button>
              </div>
            </div>

            {/* Active Filters */}
            {hasActiveFilters && (
              <div className="mt-3 flex flex-wrap gap-2">
                {appliedSearch && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-700">
                    &quot;{appliedSearch}&quot;
                    <button onClick={() => { setPendingSearch(""); setAppliedSearch(""); }} className="hover:text-teal-900 transition-colors">×</button>
                  </span>
                )}
                {appliedLocations.filter(item => item.checked).map(item => (
                  <span key={item.value} className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700">
                    {item.label}
                    <button onClick={() => toggleFilter(setPendingLocations, setAppliedLocations, item.label)} className="hover:text-blue-900 transition-colors">×</button>
                  </span>
                ))}
                {appliedSizes.filter(item => item.checked).map(item => (
                  <span key={item.value} className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-700">
                    {item.label}
                    <button onClick={() => toggleFilter(setPendingSizes, setAppliedSizes, item.label)} className="hover:text-purple-900 transition-colors">×</button>
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
                    ({checkedCount + (appliedSearch ? 1 : 0)} filters active)
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
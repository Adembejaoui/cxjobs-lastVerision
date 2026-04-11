import Link from "next/link"

interface CompanyCardProps {
  name: string
  slug: string
  description: string
  industry: string
  location: string
  size: string
  jobsCount: number
  rating: number
  reviews: number
  logoUrl?: string | null
  coverUrl?: string | null
}

export function CompanyCard({ 
  name, 
  slug,
  description, 
  industry, 
  location, 
  size, 
  jobsCount, 
  rating, 
  reviews,
  logoUrl,
  coverUrl 
}: CompanyCardProps) {
  return (
    <article className="relative flex h-full flex-col rounded-[24px] bg-[#f7f9fb] shadow-[0_8px_20px_rgba(0,0,0,0.1)] ring-1 ring-[#e8edf4] overflow-hidden">
      {/* Upper Part - Cover Image */}
      <div className="relative h-[300px] bg-gradient-to-br from-[#18345b] to-[#1f4675]">
        {coverUrl ? (
          <img 
            src={coverUrl} 
            alt={`${name} cover`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0">
            {/* Decorative pattern */}
            <div className="absolute inset-0 opacity-40">
              <div className="grid grid-cols-4 gap-1 h-full">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="bg-white/50" />
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Logo overlay at bottom center */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
          <div className="flex h-[64px] w-[64px] items-center justify-center rounded-[16px] border-4 border-white bg-[#eef2f6] shadow-lg ring-1 ring-[#dde5ef]">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={name}
                className="h-full w-full object-cover rounded-[10px]"
              />
            ) : (
              <div className="flex h-[40px] w-[40px] items-center justify-center rounded-[6px] bg-[#0f3040] text-[12px] font-bold tracking-[0.14em] text-[#dce8dd]">
                {name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lower Part - Company Info */}
      <div className="flex flex-1 flex-col p-5 pt-10">
        {/* Company Name & Badges */}
        <div className="mb-2 text-center">
          <h3 className="text-[18px] font-black tracking-[-0.02em] text-[#18345b] line-clamp-2 leading-tight">
            {name}
          </h3>
          <p className="mt-1 text-[14px] font-bold text-[#7b8ca3]">{industry}</p>
        </div>

        {/* Badges */}
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          <span className="rounded-full bg-[#e8f8ef] px-3 py-1 text-[11px] font-extrabold tracking-[0.04em] text-[#42be84]">
            {jobsCount} JOBS
          </span>
          <span className="rounded-full bg-[#edf1f6] px-3 py-1 text-[11px] font-extrabold tracking-[0.04em] text-[#5d7393]">
            ★ {rating}
          </span>
        </div>

        {/* Description */}
        <p className="mb-4 text-center text-[13px] text-[#95a5be] line-clamp-2 flex-1">
          {description}
        </p>

        {/* Company Details */}
        <div className="mb-4 space-y-2 text-[13px] font-semibold text-[#72829a]">
          <div className="flex items-center justify-center gap-2">
            <span className="text-[#7c8ea8]">⌖</span>
            <span>{location}</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[#7c8ea8]">◫</span>
            <span>{size} employees</span>
          </div>
        </div>

        {/* Action Button */}
        <Link 
          href={`/companies/${slug}`}
          className="w-full rounded-[14px] bg-[#45c68d] py-3 text-center text-[14px] font-extrabold text-white shadow-[0_6px_12px_rgba(69,198,141,0.25)] transition hover:translate-y-[-1px]"
        >
          View Company
        </Link>
      </div>
    </article>
  )
}

import Link from "next/link"

/* eslint-disable @next/next/no-img-element */

interface CompanyCardProps {
  name: string
  slug: string
  description: string
  location: string
  size: string

  logoUrl?: string | null
  coverUrl?: string | null
}

export function CompanyCard({ 
  name, 
  slug,
  description, 
  location, 
  size, 
   
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
          <div className="flex h-[80px] w-[80px] items-center justify-center rounded-[16px] border-4 border-white bg-[#eef2f6] shadow-lg ring-1 ring-[#dde5ef]">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={name}
                className="h-full w-full object-contain rounded-[10px]"
              />
            ) : (
              <div className="flex h-[48px] w-[48px] items-center justify-center rounded-[6px] bg-[#0f3040] text-[12px] font-bold tracking-[0.14em] text-[#dce8dd]">
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
        </div>

        {/* Description */}
        <p className="mb-3 text-center text-[13px] text-slate-500 line-clamp-2 flex-1">
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
          className="w-full rounded-[14px] bg-brand-green-strong py-3 text-center text-[14px] font-extrabold text-white shadow-lg transition hover:translate-y-[-1px]"
        >
          View Company
        </Link>
      </div>
    </article>
    
  )
}

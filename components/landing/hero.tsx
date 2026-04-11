"use client"

interface HeroProps {
  palette: {
    navy: string
    navyDark: string
    green: string
    greenSoft: string
    bg: string
    text: string
    muted: string
    border: string
    white: string
  }
  searchPills: string[]
}

function SearchField({ label, icon, hasChevron = false, isLast = false }: { label: string; icon: string; hasChevron?: boolean; isLast?: boolean }) {
  return (
    <div className={`flex min-h-[58px] flex-1 items-center gap-3 rounded-2xl px-4 text-left ${!isLast ? 'border-r border-slate-200' : ''}`}>
      <span className="text-lg opacity-70">{icon}</span>
      <span className="flex-1 truncate text-sm font-medium text-slate-500">{label}</span>
      {hasChevron ? <span className="text-sm text-slate-400">▼</span> : null}
    </div>
  )
}

export function Hero({ palette, searchPills }: HeroProps) {
  return (
    <section className="w-full px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-[1080px] rounded-[34px] bg-[#F1F6F4] px-6 py-14 text-center lg:px-14 lg:py-20">
        <h1 className="mx-auto max-w-[720px] text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl" style={{ color: palette.navy }}>
          Connect with Top <br />
          <span style={{ color: palette.green }}>CX Opportunities</span>
        </h1>

        <p className="mx-auto mt-6 max-w-[760px] text-base leading-7 sm:text-lg" style={{ color: palette.muted }}>
          The specialized hub for high-volume recruitment, multilingual roles, and flexible shifts in the global customer experience industry.
        </p>

        <div className="mx-auto mt-10 flex max-w-[980px] flex-col overflow-hidden rounded-[22px] border bg-white shadow-[0_20px_50px_rgba(34,58,99,0.08)] lg:flex-row" style={{ borderColor: palette.border }}>
          <div className="flex flex-1 flex-col divide-y divide-slate-100 lg:flex-row lg:divide-y-0 lg:divide-x">
            <SearchField label="Job title or skill" icon="🔎" />
            <SearchField label="City or Remote" icon="📍" />
            <SearchField label="Any Language" icon="🌐" hasChevron isLast />
          </div>
          <button
            className="m-3 min-h-[54px] rounded-2xl px-8 text-base font-bold text-white transition hover:opacity-95 lg:my-0 lg:ml-0 lg:min-w-[220px]"
            style={{ backgroundColor: palette.navy }}
          >
            Find Opportunities
          </button>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
          <span className="font-semibold uppercase tracking-[0.18em]" style={{ color: "#9AA8BB" }}>
            Popular:
          </span>
          {searchPills.map((pill) => (
            <span
              key={pill}
              className="rounded-full border px-4 py-2 font-semibold"
              style={{
                borderColor: pill === "Work from Home" ? "#BFEFD9" : palette.border,
                color: pill === "Work from Home" ? "#2CB67D" : palette.text,
                backgroundColor: pill === "Work from Home" ? palette.greenSoft : palette.white,
              }}
            >
              {pill}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

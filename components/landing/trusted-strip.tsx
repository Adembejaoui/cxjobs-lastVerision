"use client"

interface TrustedStripProps {
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
}

export function TrustedStrip({ palette }: TrustedStripProps) {
  const companies = [
    { name: "Teleperformance", color: "#0066CC" },
    { name: "Concentrix", color: "#FF6B00" },
    { name: "Sutherland", color: "#7B2D8E" },
    { name: "TTEC", color: "#00A3E0" },
    { name: "Alorica", color: "#E31837" },
    { name: "Transcom", color: "#00C7F2" },
  ]
  return (
    <section className="w-full px-4 pb-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1180px] text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: "#A1AEC2" }}>
          Trusted by Global BPO Leaders
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {companies.map((company) => (
            <div
              key={company.name}
              className="flex items-center gap-2 rounded-xl px-3 py-2 transition hover:scale-105"
            >
              <div 
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white text-xs font-bold"
                style={{ backgroundColor: company.color }}
              >
                {company.name.charAt(0)}
              </div>
              <span className="text-sm font-semibold text-slate-600">{company.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

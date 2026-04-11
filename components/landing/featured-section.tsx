"use client"

interface Job {
  title: string
  company: string
  location: string
  salary: string
  tags: string[]
  badge: string | null
}

interface FeaturedSectionProps {
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
  jobs: Job[]
}

export function FeaturedSection({ palette, jobs }: FeaturedSectionProps) {
  return (
    <section className="w-full px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-10 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight" style={{ color: palette.navy }}>
              Featured Opportunities
            </h2>
            <p className="mt-2 text-base" style={{ color: palette.muted }}>
              Priority roles from top-tier employers with fast-track hiring.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="grid h-10 w-10 place-items-center rounded-xl border bg-white" style={{ borderColor: palette.border }}>‹</button>
            <button className="grid h-10 w-10 place-items-center rounded-xl border bg-white" style={{ borderColor: palette.border }}>›</button>
          </div>
        </div>

        <div className="space-y-4">
          {jobs.map((job) => (
            <div
              key={job.title}
              className="flex flex-col gap-5 rounded-[24px] border bg-white p-5 shadow-[0_10px_30px_rgba(34,58,99,0.04)] transition hover:shadow-lg hover:border-slate-300 lg:flex-row lg:items-center lg:justify-between"
              style={{ borderColor: palette.border }}
            >
              <div className="flex items-start gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border bg-[#F7FAFD] text-2xl" style={{ borderColor: palette.border }}>
                  🏢
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-extrabold truncate" style={{ color: palette.navy }}>{job.title}</h3>
                    {job.badge ? (
                      <span className="shrink-0 rounded-full px-3 py-1 text-xs font-black" style={{ backgroundColor: palette.greenSoft, color: "#2CB67D" }}>
                        {job.badge}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{ color: palette.muted }}>
                    <span className="flex items-center gap-1"><span className="text-slate-400">🏢</span> {job.company}</span>
                    <span className="flex items-center gap-1"><span className="text-slate-400">📍</span> {job.location}</span>
                  </div>
                  <p className="mt-2 font-bold" style={{ color: palette.green }}>{job.salary}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <div className="flex flex-wrap gap-2">
                  {job.tags.map((tag) => (
                    <span key={tag} className="rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap" style={{ borderColor: palette.border, color: palette.text }}>
                      {tag}
                    </span>
                  ))}
                </div>
                <button className="shrink-0 rounded-2xl px-6 py-3 text-sm font-bold text-white transition hover:opacity-90" style={{ backgroundColor: palette.navy }}>
                  Quick Apply
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <button className="rounded-2xl border-2 bg-transparent px-8 py-4 text-sm font-bold transition hover:bg-white" style={{ borderColor: palette.navy, color: palette.navy }}>
            Browse 1,200+ More Jobs
          </button>
        </div>
      </div>
    </section>
  )
}

"use client"

interface Benefit {
  icon: string
  title: string
  desc: string
}

interface BenefitsSectionProps {
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
  benefits: Benefit[]
}

export function BenefitsSection({ palette, benefits }: BenefitsSectionProps) {
  return (
    <section className="w-full px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-[1180px] text-center">
        <h2 className="text-3xl font-black tracking-tight" style={{ color: palette.navy }}>
          Why CX Professionals Choose Us
        </h2>
        <p className="mx-auto mt-4 max-w-[760px] text-base leading-7" style={{ color: palette.muted }}>
          We curate opportunities from certified global partners who value career stability and employee well-being.
        </p>

        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {benefits.map((item) => (
            <div key={item.title} className="px-4">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl text-2xl" style={{ backgroundColor: palette.greenSoft }}>
                {item.icon}
              </div>
              <h3 className="mt-6 text-2xl font-extrabold" style={{ color: palette.navy }}>
                {item.title}
              </h3>
              <p className="mt-4 text-sm leading-7" style={{ color: palette.muted }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

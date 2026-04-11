"use client"

import Link from "next/link"

interface Category {
  title: string
  jobs: string
  desc: string
  icon: string
}

interface CategoriesSectionProps {
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
  categories: Category[]
}

export function CategoriesSection({ palette, categories }: CategoriesSectionProps) {
  return (
    <section className="w-full px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight" style={{ color: palette.navy }}>
              Browse by Category
            </h2>
            <p className="mt-2 text-base" style={{ color: palette.muted }}>
              Find specialized CX roles tailored to your unique expertise.
            </p>
          </div>
          <Link href="#" className="text-sm font-bold" style={{ color: palette.green }}>
            View all categories →
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.title}
              href={`/jobs?category=${encodeURIComponent(category.title.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-'))}`}
              className="group relative rounded-[26px] border bg-white p-7 shadow-[0_10px_30px_rgba(34,58,99,0.04)] transition duration-300 hover:-translate-y-2 hover:shadow-xl"
              style={{ borderColor: palette.border }}
            >
              <div className="grid h-14 w-14 place-items-center rounded-2xl text-2xl transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: palette.greenSoft }}>
                {category.icon}
              </div>
              <h3 className="mt-6 text-xl font-extrabold transition-colors group-hover:text-blue-600" style={{ color: palette.navy }}>
                {category.title}
              </h3>
              <p className="mt-2 text-sm font-bold" style={{ color: palette.green }}>
                {category.jobs}
              </p>
              <p className="mt-4 text-sm leading-7" style={{ color: palette.muted }}>
                {category.desc}
              </p>
              <div className="absolute bottom-7 right-7 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ color: palette.green }}>
                →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { Search, MapPin, Briefcase, Users, ArrowRight, Zap, Shield, Globe, Heart, Star, TrendingUp } from "lucide-react"
import CXHeroSearch from "@/components/landing/cx-hero-search"

const categories = [
  {
    title: "Customer Service",
    jobs: "450+ Active Jobs",
    desc: "Inbound support for world-class retail, banking, and tech brands.",
    icon: "🎧",
    color: "bg-teal-100 text-teal-700"
  },
  {
    title: "Sales & Telesales",
    jobs: "320+ Active Jobs",
    desc: "Outbound calling, lead generation, and premium account management.",
    icon: "📈",
    color: "bg-blue-100 text-blue-700"
  },
  {
    title: "Technical Support",
    jobs: "180+ Active Jobs",
    desc: "Level 1 & 2 specialized support for global software products.",
    icon: "🧑‍💻",
    color: "bg-purple-100 text-purple-700"
  },
  {
    title: "Back Office",
    jobs: "90+ Active Jobs",
    desc: "Data entry, processing, and administrative non-voice operations.",
    icon: "📄",
    color: "bg-amber-100 text-amber-700"
  }
]

const featuredJobs = [
  {
    title: "Bilingual Customer Success Specialist",
    company: "Teleperformance",
    location: "Mexico City (Hybrid)",
    salary: "$1,200 – $1,500 / mo",
    tags: ["English C1", "Spanish B2", "Night Shift"],
    badge: "HOT",
    badgeColor: "bg-red-100 text-red-700"
  },
  {
    title: "Senior Tech Support Engineer",
    company: "Concentrix",
    location: "Remote",
    salary: "$1,800 – $2,200 / mo",
    tags: ["French C1", "Full-time"],
    badge: "NEW",
    badgeColor: "bg-teal-100 text-teal-700"
  },
  {
    title: "Inbound Sales Representative",
    company: "Sutherland",
    location: "Bogotá, Colombia",
    salary: "$900 + Commission",
    tags: ["English B2", "Bonuses", "Day Shift"],
    badge: null,
    badgeColor: ""
  }
]

const stats = [
  { value: "10K+", label: "Active Jobs", icon: Briefcase },
  { value: "500+", label: "Companies", icon: Users },
  { value: "50K+", label: "Candidates Hired", icon: TrendingUp },
  { value: "4.8", label: "Average Rating", icon: Star }
]

const benefits = [
  {
    icon: Zap,
    title: "Fast-Track Hiring",
    desc: "Qualified candidates often move from interview to offer within 48 hours.",
    color: "text-teal-600",
    bg: "bg-teal-100"
  },
  {
    icon: Shield,
    title: "Verified Employers",
    desc: "All employers are vetted for legitimacy and fair employment practices.",
    color: "text-blue-600",
    bg: "bg-blue-100"
  },
  {
    icon: Globe,
    title: "Global Opportunities",
    desc: "Access jobs from companies worldwide with remote and hybrid options.",
    color: "text-purple-600",
    bg: "bg-purple-100"
  }
]

export default function CXJobsLandingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
   

      {/* Hero Section */}
      <CXHeroSearch />

      {/* Categories Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                Browse by Category
              </h2>
              <p className="mt-2 text-slate-600">
                Find specialized CX roles tailored to your unique expertise.
              </p>
            </div>
            <Link href="/jobs" className="inline-flex items-center gap-2 text-teal-600 font-medium hover:text-teal-700">
              View all categories <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <Link
                key={category.title}
                href={`/jobs?category=${encodeURIComponent(category.title.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-'))}`}
                className="group"
              >
                <Card className="relative overflow-hidden border-slate-200 p-6 transition-all duration-300 hover:border-teal-200 hover:shadow-xl hover:shadow-teal-500/10 hover:-translate-y-1">
                  <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${category.color}`}>
                    <span className="text-2xl">{category.icon}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-slate-900 group-hover:text-teal-600 transition-colors">
                    {category.title}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-teal-600">
                    {category.jobs}
                  </p>
                  <p className="mt-3 text-sm text-slate-500 leading-relaxed">
                    {category.desc}
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-sm font-medium text-teal-600 opacity-0 transition-opacity group-hover:opacity-100">
                    Explore <ArrowRight className="h-4 w-4" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Jobs Section */}
      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                Featured Opportunities
              </h2>
              <p className="mt-2 text-slate-600">
                Priority roles from top-tier employers with fast-track hiring.
              </p>
            </div>
            <Link href="/jobs" className="inline-flex items-center gap-2 text-teal-600 font-medium hover:text-teal-700">
              View all jobs <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-4">
            {featuredJobs.map((job, idx) => (
              <Card key={idx} className="overflow-hidden border-slate-200 p-6 transition-all hover:border-teal-200 hover:shadow-lg">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200">
                      <span className="text-xl">🏢</span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-bold text-slate-900">{job.title}</h3>
                        {job.badge && (
                          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${job.badgeColor}`}>
                            {job.badge}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <span>🏢</span> {job.company}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {job.location}
                        </span>
                      </div>
                      <p className="mt-2 font-bold text-teal-600">{job.salary}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex flex-wrap gap-2">
                      {job.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <Button className="shrink-0 bg-teal-600 hover:bg-teal-700 text-white font-bold">
                      Quick Apply
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link href="/jobs">
              <Button variant="outline" className="border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 px-8 py-6 text-base font-bold">
                Browse 1,200+ More Jobs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
              Why Choose CXJobs?
            </h2>
            <p className="mt-4 text-slate-600 max-w-2xl mx-auto">
              We connect talented professionals with world-class opportunities in the customer experience industry.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="text-center">
                <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${benefit.bg}`}>
                  <benefit.icon className={`h-8 w-8 ${benefit.color}`} />
                </div>
                <h3 className="mt-6 text-xl font-bold text-slate-900">{benefit.title}</h3>
                <p className="mt-2 text-slate-600 leading-relaxed">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
            
      {/* CTA Section */}
      <section className="bg-gradient-to-br from-teal-600 to-teal-700 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to Take the Next Step?
          </h2>
          <p className="mt-4 text-lg text-teal-100">
            Join thousands of professionals who found their dream CX careers through our platform.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/register">
              <Button size="lg" className="bg-white text-teal-700 hover:bg-teal-50 font-bold px-8 py-6 text-base shadow-xl">
                Create Free Account
              </Button>
            </Link>
            <Link href="/jobs">
              <Button size="lg" variant="outline" className="border-2 border-teal-400 text-white hover:bg-teal-500/20 font-bold px-8 py-6 text-base">
                Browse Jobs
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

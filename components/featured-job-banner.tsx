"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { MapPin, DollarSign, Briefcase } from "lucide-react"

interface JobOffer {
  id: string
  title: string
  slug: string
  description: string
  location: string
  contractType: string
  workMode: string
  salary: string | null
  salaryMin: number | null
  salaryMax: number | null
  requirements: string[]
  benefits: string[]
  status: string
  publishedAt: string | null
  createdAt: string
  company: {
    id: string
    name: string
    slug: string
    logoUrl: string | null
    industry: string | null
    location: string | null
  }
  _count: {
    applications: number
  }
}

interface FeaturedJobBannerProps {
  job: JobOffer
}

export function FeaturedJobBanner({ job }: FeaturedJobBannerProps) {
  const getWorkModeLabel = (mode: string): string => {
    const labels: Record<string, string> = {
      ON_SITE: 'On-Site',
      REMOTE: 'Remote',
      HYBRID: 'Hybrid',
    }
    return labels[mode] || mode
  }

  const getCompanyIcon = (companyName: string): string => {
    const icons = ['🏢', '💼', '🎯', '🖥️', '📞', '🏦', '👥', '☁️', '📱', '💳']
    const index = companyName.charCodeAt(0) % icons.length
    return icons[index]
  }

  return (
    <Card className="border-0 bg-[linear-gradient(135deg,#1E3A5F_0%,#162A45_50%,#1E3A5F_100%)] p-8 text-white">
      <div className="flex items-center gap-6">
        <div className="hidden flex-shrink-0 sm:block">
          <div className="flex items-center justify-center rounded-2xl bg-slate-900 p-6">
            {job.company.logoUrl ? (
              <img 
                src={job.company.logoUrl} 
                alt={job.company.name}
                className="w-16 h-16 object-contain"
              />
            ) : (
              <span className="text-4xl">{getCompanyIcon(job.company.name)}</span>
            )}
          </div>
        </div>
        <div className="flex-1">
          <div className="mb-2 inline-block rounded-full bg-teal-500 px-3 py-1 text-xs font-bold uppercase text-white">
            Featured Employer
          </div>
          <h2 className="mb-3 text-3xl font-bold">{job.title}</h2>
          <p className="mb-6 text-blue-100">
            {job.company.name} • {job.location}
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="text-xs font-semibold uppercase text-blue-200">
                Salary
              </div>
              <div className="text-2xl font-bold">{job.salary || 'Competitive'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-blue-200">
                Openings
              </div>
              <div className="text-2xl font-bold">{job._count.applications}+</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-blue-200">
                Work Mode
              </div>
              <div className="text-2xl font-bold">{getWorkModeLabel(job.workMode)}</div>
            </div>
            <Link href={`/jobs/${job.slug}`}>
              <Button className="bg-teal-500 hover:bg-teal-600">View Details</Button>
            </Link>
          </div>
        </div>
      </div>
    </Card>
  )
}

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MapPin, Globe, Linkedin, Twitter } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  CoverImage,
  CompanyInfo,
  AboutSection,
  BenefitsSection,
  CultureSection,
  JobOpenings
} from '@/components/company-profile'

import prisma from '@/lib/prisma'

// ISR - regenerate every 10 minutes
export const revalidate = 600

interface JobOffer {
  id: string
  title: string
  slug: string
  customLocation: string | null
  contractType: string
  isRemote: boolean
  isHybrid: boolean
  salary: string | null
  salaryMin: number | null
  salaryMax: number | null
  createdAt: Date
}

interface CultureItem {
  title: string
  description: string
  imageUrl?: string
}

interface Company {
  id: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  coverImageUrl: string | null
  website: string | null
  linkedinUrl: string | null
  twitterUrl: string | null
  facebookUrl: string | null
  industry: string | null
  companySize: string | null
  location: string | null
  foundedYear: number | null
  mission: string | null
  createdAt: Date

  benefits:
    | {
        id: string
        name: string
        description: string | null
        icon: string | null
      }[]
    | null

  culture: CultureItem[]

  _count: {
    jobs: number
  }

  jobs: JobOffer[]
}

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

function transformBenefitsForDisplay(
  benefits: Company['benefits']
): string[] {
  if (!benefits || benefits.length === 0) return []

  return benefits.map((benefit) => benefit.name || 'Benefit')
}

async function getCompany(slug: string): Promise<Company | null> {
  // Get company with benefits and culture (without jobs to avoid type issues)
  const company = await prisma.companies.findUnique({
    where: {
      slug,
      deletedAt: null
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      mission: true,
      logoUrl: true,
      coverImageUrl: true,
      website: true,
      linkedinUrl: true,
      twitterUrl: true,
      facebookUrl: true,
      industry: true,
      companySize: true,
      location: true,
      foundedYear: true,
      createdAt: true,
      benefits: {
        select: {
          id: true,
          name: true,
          description: true,
          icon: true
        }
      },
      culture: true,
    }
  })

  if (!company) {
    return null
  }

  // Get published jobs (limited to 10) and count in parallel
  const [publishedJobs, publishedJobsCount] = await Promise.all([
    prisma.jobOffer.findMany({
      where: {
        companyId: company.id,
        status: 'PUBLISHED'
      },
      select: {
        id: true,
        title: true,
        slug: true,
        customLocation: true,
        contractType: true,
        isRemote: true,
        isHybrid: true,
        salary: true,
        salaryMin: true,
        salaryMax: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    }),
    prisma.jobOffer.count({
      where: {
        companyId: company.id,
        status: 'PUBLISHED'
      }
    })
  ])

  let cultureData: CultureItem[] = []

  if (company.culture) {
    try {
      if (typeof company.culture === 'string') {
        const parsed = JSON.parse(company.culture)

        if (Array.isArray(parsed)) {
          cultureData = parsed
        }
      } else if (Array.isArray(company.culture)) {
        cultureData = company.culture as CultureItem[]
      }
    } catch {
      cultureData = []
    }
  }

  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    description: company.description,
    mission: company.mission,
    logoUrl: company.logoUrl,
    coverImageUrl: company.coverImageUrl,
    website: company.website,
    linkedinUrl: company.linkedinUrl,
    twitterUrl: company.twitterUrl,
    facebookUrl: company.facebookUrl,
    industry: company.industry,
    companySize: company.companySize,
    location: company.location,
    foundedYear: company.foundedYear,
    createdAt: company.createdAt,
    benefits: company.benefits,
    culture: cultureData,
    _count: {
      jobs: publishedJobsCount
    },
    jobs: publishedJobs
  }
}
      

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const company = await getCompany(slug)

  if (!company) {
    return {
      title: 'Company Not Found | JobHub'
    }
  }

  return {
    title: `${company.name} | JobHub`,
    description:
      company.description ||
      `View ${company.name}'s profile and job openings on JobHub`
  }
}

export default async function CompanyDetailPage({
  params
}: PageProps) {
  const resolvedParams = await params;
  const company = await getCompany(resolvedParams.slug)

  if (!company) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Cover */}
      <CoverImage
        imageUrl={company.coverImageUrl}
        companyName={company.name}
        aspectRatio="16/5"
        objectPosition="center"
      />

      {/* Company Info */}
      <CompanyInfo
        name={company.name}
        logoUrl={company.logoUrl}
        location={company.location}
        companySize={company.companySize}
        industry={company.industry}
        foundedYear={company.foundedYear}
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left */}
          <div className="space-y-12 lg:col-span-2">
            <AboutSection
              description={company.description}
              mission={company.mission}
            />

            <CultureSection culture={company.culture} />

            <JobOpenings
              jobs={company.jobs.map((job) => ({
                title: job.title,
                location:
                  job.customLocation ||
                  (job.isRemote
                    ? 'Remote'
                    : job.isHybrid
                    ? 'Hybrid'
                    : company.location || ''),
                salary: job.salary,
                contractType: job.contractType
              }))}
              totalCount={company._count.jobs}
            />
          </div>

          {/* Right Sidebar */}
          <div className="space-y-8">
            <BenefitsSection
              benefits={transformBenefitsForDisplay(
                company.benefits
              )}
            />

            {/* Contact Card */}
            <Card className="border border-border p-6">
              <h3 className="mb-4 font-semibold text-foreground">
                Contact & Links
              </h3>

              <div className="space-y-4">
                {company.website && (
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">
                      Website
                    </p>

                    <a
                      href={
                        company.website.startsWith('http')
                          ? company.website
                          : `https://${company.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <Globe className="h-4 w-4" />
                      {company.website}
                    </a>
                  </div>
                )}

                {company.linkedinUrl && (
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">
                      LinkedIn
                    </p>

                    <a
                      href={`https://linkedin.com/company/${company.linkedinUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <Linkedin className="h-4 w-4" />
                      {company.linkedinUrl}
                    </a>
                  </div>
                )}

                {company.twitterUrl && (
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">
                      Twitter / X
                    </p>

                    <a
                      href={
                        company.twitterUrl.startsWith('http')
                          ? company.twitterUrl
                          : `https://twitter.com/${company.twitterUrl.replace(
                              '@',
                              ''
                            )}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <Twitter className="h-4 w-4" />
                      {company.twitterUrl}
                    </a>
                  </div>
                )}

                <div>
                  <p className="mb-1 text-sm text-muted-foreground">
                    Location
                  </p>

                  <p className="flex items-center gap-2 text-foreground">
                    <MapPin className="h-4 w-4" />
                    {company.location || 'Remote'}
                  </p>
                </div>
              </div>
            </Card>

            {/* CTA */}
            <Card className="border border-border bg-primary/5 p-6">
              <h3 className="mb-2 font-semibold text-foreground">
                Interested in Working Here?
              </h3>

              <p className="mb-4 text-sm text-muted-foreground">
                Check out the {company._count.jobs} open
                position{company._count.jobs !== 1 ? 's' : ''} and
                submit your application today.
              </p>

              <Link href={`/jobs?company=${company.slug}`}>
                <Button className="w-full" size="sm">
                  View All Jobs
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
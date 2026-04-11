import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { MapPin, Users, Briefcase, Star, Heart, Share2, Globe, Linkedin, Twitter, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CoverImage, CompanyInfo, AboutSection, BenefitsSection, CultureSection, JobOpenings, Reviews } from '@/components/company-profile'

// Types based on the updated API response
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
  createdAt: string
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
  benefits: { id: string; name: string; description: string | null; icon: string | null }[] | null
  culture: { title: string; description: string; imageUrl?: string }[] | null
  mission: string | null
  createdAt: string
  _count: {
    jobs: number
  }
  jobs: JobOffer[]
}

function transformBenefitsForDisplay(benefits: Company['benefits']): string[] {
  if (!benefits || benefits.length === 0) return []
  return benefits.map(b => b.name || 'Benefit')
}

interface CompanyResponse {
  success: boolean
  data: Company
}

// Map company size enum to display string
function getCompanySizeDisplay(size: string | null): string {
  switch (size) {
    case 'STARTUP':
      return '1-10'
    case 'SMALL':
      return '11-50'
    case 'MEDIUM':
      return '51-200'
    case 'LARGE':
      return '201-1000'
    case 'ENTERPRISE':
      return '1000+'
    default:
      return 'N/A'
  }
}

// Get logo initials
function getLogoInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
}

// Fetch company from API
async function getCompany(slug: string): Promise<Company | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const url = `${baseUrl}/api/companies/${slug}`
  
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      return null
    }
    const data: CompanyResponse = await res.json()
    
    // Parse culture from JSON string to array
    let cultureData: { title: string; description: string; imageUrl?: string }[] = [];
    if (data.data.culture) {
      if (typeof data.data.culture === 'string') {
        try {
          const parsed = JSON.parse(data.data.culture);
          if (Array.isArray(parsed)) {
            cultureData = parsed;
          }
        } catch (e) {
          console.warn('Culture field is not valid JSON');
        }
      } else if (Array.isArray(data.data.culture)) {
        cultureData = data.data.culture;
      }
    }
    
    return { ...data.data, culture: cultureData }
  } catch (error) {
    console.error('Error fetching company:', error)
    return null
  }
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const company = await getCompany(slug)
  
  if (!company) {
    return {
      title: 'Company Not Found | JobHub',
    }
  }
  
  return {
    title: `${company.name} | JobHub`,
    description: company.description || `View ${company.name}'s profile and job openings on JobHub`,
  }
}

export default async function CompanyDetailPage({ params }: PageProps) {
  const { slug } = await params
  const company = await getCompany(slug)
  
  if (!company) {
    notFound()
  }

  return (
    <>
      <main className="min-h-screen bg-background">
        {/* Cover Image Section - Upper, larger */}
        <CoverImage 
          imageUrl={company.coverImageUrl}
          companyName={company.name}
        />

        {/* Company Info Section - Under cover image */}
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content - Left Column */}
            <div className="lg:col-span-2 space-y-12">
              <AboutSection description={company.description} mission={company.mission} />
              <CultureSection culture={company.culture} />
              <JobOpenings 
                jobs={company.jobs.map(job => ({
                  title: job.title,
                  location: job.customLocation || (job.isRemote ? 'Remote' : job.isHybrid ? 'Hybrid' : company.location || ''),
                  salary: job.salary,
                  contractType: job.contractType,
                }))}
                totalCount={company._count.jobs}
              />
            </div>

            {/* Sidebar - Right Column */}
            <div className="space-y-8">
              <BenefitsSection benefits={transformBenefitsForDisplay(company.benefits)} />
              <Reviews />
              
              {/* Contact Info */}
              <Card className="p-6 border border-border">
                <h3 className="font-semibold text-foreground mb-4">Contact & Links</h3>
                <div className="space-y-4">
                  {company.website && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Website</p>
                      <a 
                        href={company.website.startsWith('http') ? company.website : `https://${company.website}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-2"
                      >
                        <Globe className="h-4 w-4" />
                        {company.website}
                      </a>
                    </div>
                  )}
                  {company.linkedinUrl && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">LinkedIn</p>
                      <a 
                        href={`https://linkedin.com/company/${company.linkedinUrl}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-2"
                      >
                        <Linkedin className="h-4 w-4" />
                        {company.linkedinUrl}
                      </a>
                    </div>
                  )}
                  {company.twitterUrl && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Twitter / X</p>
                      <a 
                        href={company.twitterUrl.startsWith('http') ? company.twitterUrl : `https://twitter.com/${company.twitterUrl.replace('@', '')}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-2"
                      >
                        <Twitter className="h-4 w-4" />
                        {company.twitterUrl}
                      </a>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Location</p>
                    <p className="text-foreground flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {company.location || 'Remote'}
                    </p>
                  </div>
                </div>
              </Card>

              {/* CTA Card */}
              <Card className="p-6 border border-border bg-primary/5">
                <h3 className="font-semibold text-foreground mb-2">Interested in Working Here?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Check out the {company._count.jobs} open position{company._count.jobs !== 1 ? 's' : ''} and submit your application today.
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
    </>
  )
}

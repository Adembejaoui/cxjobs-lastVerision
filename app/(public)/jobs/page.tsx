import JobsPageClient from './JobsPageClient'
import prisma from '@/lib/prisma'

export const metadata = {
  title: 'Browse Jobs | CXJobs',
  description: 'Find your next opportunity with thousands of job listings in the CX industry',
}

export default async function JobsPage() {
  const jobs = await prisma.jobOffer.findMany({
    where: {
      deletedAt: null,
      status: "PUBLISHED",
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          industry: true,
          location: true,
        },
      },
      _count: {
        select: { applications: true },
      },
    },
    take: 20,
    orderBy: { createdAt: "desc" },
  }) as any;

  const totalJobs = await prisma.jobOffer.count({
    where: {
      deletedAt: null,
      status: "PUBLISHED",
    },
  });

  const transformedJobs = (jobs as any).map((job: any) => ({
    id: job.id,
    title: job.title,
    slug: job.slug,
    salary: job.salary,
    salaryMax: job.salaryMax,
    isRemote: job.isRemote,
    isHybrid: job.isHybrid,
    customLocation: job.customLocation,
    contractType: job.contractType,
    experienceLevel: job.experienceLevel || null,
    department: job.company.industry || null,
    company: {
      id: job.company.id,
      name: job.company.name,
      slug: job.company.slug,
      logoUrl: job.company.logoUrl,
      industry: job.company.industry,
      location: job.company.location,
    },
    _count: job._count,
  }));

  return <JobsPageClient initialJobs={transformedJobs} totalJobs={totalJobs} />
}
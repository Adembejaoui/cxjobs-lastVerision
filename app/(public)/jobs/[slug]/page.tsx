import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { JobDetailClient, JobOffer } from './job-detail-client'
import { logger } from "@/lib/logger";

export const revalidate = 600;
export const dynamicParams = true;

// Cached fetch for published jobs (public ISR path)
const getPublishedJob = unstable_cache(
  async (slug: string): Promise<JobOffer | null> => {
    try {
      const job = await prisma.jobOffer.findFirst({
        where: {
          slug,
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
              location: true,
              website: true,
              description: true,
              isRemoteFriendly: true,
              isHybridFriendly: true,
              benefits: {
                where: { scope: "CORE" },
                select: { id: true, name: true },
              },
            },
          },
          benefits: { include: { benefit: true } },
          languages: true,
          _count: { select: { applications: true } },
        },
      });
      return job as JobOffer | null;
    } catch (error) {
      logger.error("Failed to fetch published job", { error });
      return null;
    }
  },
  ["published-job-detail"],
  { revalidate: 600, tags: ["job-offer"] }
);

// Uncached fetch for company owners / admins (any status)
  async function getJobUncached(slug: string, userId?: string, userRole?: string): Promise<JobOffer | null> {
    try {
      const job = await prisma.jobOffer.findFirst({
        where: { slug, deletedAt: null },
        include: {
          company: {
            select: {
              id: true, name: true, slug: true, logoUrl: true,
              location: true, website: true, description: true,
              isRemoteFriendly: true, isHybridFriendly: true,
              benefits: { where: { scope: "CORE" }, select: { id: true, name: true } },
            },
          },
          benefits: { include: { benefit: true } },
          languages: true,
          _count: { select: { applications: true } },
        },
      });

      if (!job) return null;

      // Company owners can view their own jobs regardless of status
      if (userRole === 'COMPANY' && userId) {
        const userCompany = await prisma.companies.findFirst({
          where: { userId, id: job.companyId },
        });
        if (userCompany) return job;
      }

      // Admins can view any job
      if (userRole === 'ADMIN') return job;

      // Everyone else: only published
      if (job.status === 'PUBLISHED') return job;

      return null;
    } catch {
      logger.error("Failed to fetch job");
      return null;
    }
  }

async function getJob(slug: string, userId?: string, userRole?: string): Promise<JobOffer | null> {
  // Public path: cached published job only
  if (!userId || (userRole !== 'COMPANY' && userRole !== 'ADMIN')) {
    return getPublishedJob(slug);
  }
  // Authenticated company/admin path: uncached, any status for owned jobs
  return getJobUncached(slug, userId, userRole);
}

export async function generateStaticParams() {
  try {
    const jobs = await prisma.jobOffer.findMany({
      where: { status: "PUBLISHED", deletedAt: null },
      select: { slug: true },
      take: 1000,
    });
    return jobs.map((job) => ({ slug: job.slug }));
  } catch {
    logger.error("Failed to generate static params for jobs");
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const job = await getJob(slug, session?.user?.id, session?.user?.role);

  if (!job) {
    return { title: 'Job Not Found | CXJobs' };
  }

  return {
    title: `${job.title} at ${job.company.name} | CXJobs`,
    description: job.company.description || `Apply for ${job.title} at ${job.company.name}`,
  };
}

export default async function JobDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const job = await getJob(slug, session?.user?.id, session?.user?.role);

  if (!job) {
    notFound();
  }

  return <JobDetailClient job={job} />;
}
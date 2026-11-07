import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { BenefitScope, JobOfferStatus } from '@/app/generated/prisma/client'
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
        status: JobOfferStatus.PUBLISHED,
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
              where: { scope: BenefitScope.CORE },
              select: { id: true, name: true, icon: true },
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

// Shared include for uncached job fetches (company/admin/historical candidate)
const jobOfferInclude = {
  company: {
    select: {
      id: true, name: true, slug: true, logoUrl: true,
      location: true, website: true, description: true,
      isRemoteFriendly: true, isHybridFriendly: true,
      benefits: { where: { scope: BenefitScope.CORE }, select: { id: true, name: true, icon: true } },
    },
  },
  benefits: { include: { benefit: true } },
  languages: true,
  _count: { select: { applications: true } },
};

// Uncached fetch for company owners / admins (any status)
async function getJobUncached(slug: string, userId?: string, userRole?: string): Promise<JobOffer | null> {
  try {
    const job = await prisma.jobOffer.findFirst({
      where: { slug, deletedAt: null },
      include: jobOfferInclude,
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

// Fetch a job by slug for a candidate who has an existing application.
// Used to allow access to historical jobs (CLOSED, EXPIRED, ARCHIVED, etc.)
// that are no longer accepting applications but belong to the candidate's history.
async function getJobForCandidate(slug: string, userId: string): Promise<JobOffer | null> {
  try {
    // Resolve the candidate record from the authenticated user id
    const candidate = await prisma.candidate.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!candidate) return null;

    // Fetch the job by slug (any non-deleted status)
    const job = await prisma.jobOffer.findFirst({
      where: { slug, deletedAt: null },
      include: jobOfferInclude,
    });

    if (!job) return null;

    // Ownership check: the candidate must have an existing application for this job
    const application = await prisma.application.findFirst({
      where: {
        candidateId: candidate.id,
        jobOfferId: job.id,
      },
      select: { id: true },
    });

    if (!application) return null;

    return job;
  } catch {
    logger.error("Failed to fetch job for candidate");
    return null;
  }
}

interface JobWithMeta {
  job: JobOffer;
  isHistorical: boolean;
}

async function getJob(slug: string, userId?: string, userRole?: string): Promise<JobWithMeta | null> {
  // Public path (no session): cached published job only
  if (!userId) {
    const job = await getPublishedJob(slug);
    return job ? { job, isHistorical: false } : null;
  }

  // Company/admin path: uncached, any status for owned jobs
  if (userRole === 'COMPANY' || userRole === 'ADMIN') {
    const job = await getJobUncached(slug, userId, userRole);
    if (!job) return null;
    return { job, isHistorical: job.status !== 'PUBLISHED' };
  }

  // Candidate path: try published first, then fall back to historical
  const publishedJob = await getPublishedJob(slug);
  if (publishedJob) {
    return { job: publishedJob, isHistorical: false };
  }

  // Candidate has no published job match; check for a historical application
  const historicalJob = await getJobForCandidate(slug, userId);
  if (historicalJob) {
    return { job: historicalJob, isHistorical: true };
  }

  return null;
}

export async function generateStaticParams() {
  try {
    const jobs = await prisma.jobOffer.findMany({
      where: { status: JobOfferStatus.PUBLISHED, deletedAt: null },
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
  const job = await getPublishedJob(slug);

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
  const result = await getJob(slug, session?.user?.id, session?.user?.role);

  if (!result) {
    notFound();
  }

  return <JobDetailClient job={result.job} isHistorical={result.isHistorical} />;
}
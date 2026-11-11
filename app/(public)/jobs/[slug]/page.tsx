import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import prisma from '@/lib/prisma'
import { BenefitScope } from '@/app/generated/prisma/client'
import { JobDetailClient, JobOffer } from './job-detail-client'
import { logger } from "@/lib/logger";
import { publicJobWhere } from '@/lib/security/company-activity'
import { buildJobPostingJsonLd, serializeJsonLd } from '@/lib/seo/job-posting'

export const revalidate = 600;
export const dynamicParams = true;

// Cached fetch for published jobs (public ISR path)
const getPublishedJob = unstable_cache(
  async (slug: string): Promise<JobOffer | null> => {
    try {
      const job = await prisma.jobOffer.findFirst({
      // F-04: published, not deleted, not expired, active company.
      where: { slug, ...publicJobWhere() },
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
      // Rethrown on purpose: a database outage must not turn into a 404 that
      // the ISR cache keeps serving. On a failed regeneration Next keeps the
      // last good page; on a first render the branded error page is shown.
      logger.error("Failed to fetch published job", { error: error instanceof Error ? error.name : "unknown" });
      throw error;
    }
  },
  ["published-job-detail"],
  { revalidate: 600, tags: ["job-offer"] }
);

// No job pages are prebuilt: a build must never need database access (a dev
// checkout's `.env` may point at production, and CI has no database). With
// `dynamicParams = true` and `revalidate`, each job page is rendered on its
// first request and then served from the ISR cache.
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await getPublishedJob(slug);

  if (!job) {
    return { title: 'Job Not Found | CXJobs', robots: { index: false } };
  }

  const title = `${job.title} at ${job.company.name} | CXJobs`;
  const description = (job.description || job.company.description || `Apply for ${job.title} at ${job.company.name}`)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  return {
    title,
    description,
    alternates: { canonical: `/jobs/${job.slug}` },
    openGraph: {
      type: 'website',
      siteName: 'CXJobs',
      title,
      description,
      url: `/jobs/${job.slug}`,
      ...(job.company.logoUrl ? { images: [{ url: job.company.logoUrl, alt: job.company.name }] } : {}),
    },
  };
}

/**
 * The public job page is identical for every visitor (launch plan A10): it
 * never reads the session, so it is served from the ISR cache. Only publicly
 * visible jobs exist here (published, not deleted, not expired, active
 * company: P5); anything else is a 404. Owners, admins and candidates with
 * an application use /jobs/[slug]/preview for non-public jobs.
 */
export default async function JobDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await getPublishedJob(slug);

  if (!job) {
    notFound();
  }

  const jsonLd = buildJobPostingJsonLd(job);

  return (
    <>
      <script
        type="application/ld+json"
        // Escaped by serializeJsonLd: job text cannot close the element.
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <JobDetailClient job={job} isHistorical={false} />
    </>
  );
}

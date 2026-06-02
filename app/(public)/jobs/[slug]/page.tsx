import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { JobDetailClient, JobOffer } from './job-detail-client'

export const revalidate = 600;
 export const dynamic = 'force-static';
 export const dynamicParams = true;

async function getJob(slug: string): Promise<JobOffer | null> {
   try {
     const job = await prisma.jobOffer.findFirst({
       where: {
         slug,
         deletedAt: null,
         status: "PUBLISHED"
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
             website: true,
             description: true,
             isRemoteFriendly: true,
             isHybridFriendly: true,
             benefits: {
               where: { scope: "CORE" },
               select: {
                 id: true,
                 name: true,
               },
             },
           },
         },
         benefits: {
           include: {
             benefit: true,
           },
         },
         languages: true,
         _count: {
           select: { applications: true },
         },
       },
     });

     return job as JobOffer | null;
   } catch (error) {
     console.error("Failed to fetch job:", error);
     return null;
   }
 }

export async function generateStaticParams() {
   try {
     const jobs = await prisma.jobOffer.findMany({
       where: {
         status: "PUBLISHED",
         deletedAt: null,
       },
       select: {
         slug: true,
       },
       take: 1000,
     });

     return jobs.map((job) => ({
       slug: job.slug,
     }));
   } catch (error) {
     console.error("Failed to generate static params for jobs:", error);
     return [];
   }
 }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await getJob(slug);
  
  if (!job) {
    return {
      title: 'Job Not Found | CXJobs',
    };
  }

  return {
    title: `${job.title} at ${job.company.name} | CXJobs`,
    description: job.company.description || `Apply for ${job.title} at ${job.company.name}`,
  };
}

export default async function JobDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await getJob(slug);

  if (!job) {
    notFound();
  }

  return <JobDetailClient job={job} />
}
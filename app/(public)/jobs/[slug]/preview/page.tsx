import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { BenefitScope } from '@/app/generated/prisma/client'
import { JobDetailClient, JobOffer } from '../job-detail-client'
import { logger } from '@/lib/logger'
import { publicJobWhere } from '@/lib/security/company-activity'

/**
 * Signed-in view of a job that may not be public (launch plan A10/P5).
 *
 * The public page /jobs/[slug] is cached and identical for everyone, so it
 * only knows publicly visible jobs. This route reads the session and shows:
 *   - the owning company: its own job in any status (draft, closed, ...);
 *   - an administrator: any non-deleted job;
 *   - a candidate who applied: the job read-only, even after it closed
 *     or its company was suspended (application history).
 * Anyone else is sent to the public page (which 404s for non-public jobs).
 * Never indexed, never cached.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Job preview | CXJobs',
  robots: { index: false, follow: false },
}

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
}

async function canView(job: { id: string; companyId: string }, userId: string, role: string): Promise<boolean> {
  if (role === 'ADMIN') return true
  if (role === 'COMPANY') {
    const owner = await prisma.companies.count({ where: { userId, id: job.companyId } })
    return owner > 0
  }
  if (role === 'CANDIDATE') {
    const applied = await prisma.application.count({
      where: { jobOfferId: job.id, candidate: { userId } },
    })
    return applied > 0
  }
  return false
}

export default async function JobPreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/jobs/${slug}/preview`)}`)
  }

  let job: JobOffer | null = null
  let isPublic = false
  let notAuthorized = false
  try {
    const row = await prisma.jobOffer.findFirst({ where: { slug, deletedAt: null }, include: jobOfferInclude })
    if (row && (await canView(row, session.user.id, session.user.role))) {
      job = row as unknown as JobOffer
      isPublic = (await prisma.jobOffer.count({ where: { id: row.id, ...publicJobWhere() } })) > 0
    } else if (row) {
      notAuthorized = true
    }
  } catch (error) {
    logger.error('Failed to load job preview', { error: error instanceof Error ? error.name : 'unknown' })
  }

  // Not an owner/admin/applicant: the public page decides (404 unless public).
  if (notAuthorized) redirect(`/jobs/${slug}`)
  if (!job) notFound()

  // A candidate viewing a job that is still open gets the live page (apply,
  // "already applied" state); everything else is read-only history.
  const isCandidate = session.user.role === 'CANDIDATE'
  return <JobDetailClient job={job} isHistorical={isCandidate ? !isPublic : job.status !== 'PUBLISHED'} />
}

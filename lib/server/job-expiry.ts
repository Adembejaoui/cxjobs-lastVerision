/**
 * Closing expired job offers (launch plan A2). Shared by the nightly cron
 * run and the admin-triggered run of POST /api/job-offers/expire.
 */
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { invalidateCompanyAnalytics } from "@/lib/local-cache";
import { revalidateJobOffers } from "@/lib/cache";

export async function closeExpiredJobOffers(now: Date = new Date()): Promise<{ closedCount: number }> {
  const where = {
    status: "PUBLISHED" as const,
    deletedAt: null,
    expiresAt: { not: null, lt: now },
  };

  const expiredOffers = await prisma.jobOffer.findMany({
    where,
    select: { id: true, companyId: true },
  });
  if (expiredOffers.length === 0) return { closedCount: 0 };

  const closed = await prisma.jobOffer.updateMany({
    // The full condition again (not only the ids): a job republished with a
    // new expiry between the two statements is left alone.
    where: { ...where, id: { in: expiredOffers.map((o) => o.id) } },
    data: { status: "CLOSED", closedAt: now },
  });

  logger.info("Expired job offers auto-closed", {
    closedCount: closed.count,
    offerIds: expiredOffers.map((o) => o.id),
  });

  if (closed.count > 0) {
    // Public pages and listings drop the closed jobs on the next request.
    revalidateJobOffers();
    for (const companyId of new Set(expiredOffers.map((o) => o.companyId))) {
      await invalidateCompanyAnalytics(companyId);
    }
  }

  return { closedCount: closed.count };
}


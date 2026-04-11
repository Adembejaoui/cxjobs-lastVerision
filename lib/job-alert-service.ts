import { prisma } from "@/lib/prisma";
import { JobAlert, Prisma } from "@prisma/client";

// Type for job offer with company relation
type JobOfferWithCompany = Prisma.JobOfferGetPayload<{
  include: {
    company: {
      select: {
        id: true;
        name: true;
        slug: true;
        logoUrl: true;
        location: true;
      };
    };
  };
}>;

/**
 * Find jobs matching a job alert's criteria
 */
export async function findMatchingJobs(
  alert: JobAlert,
  since?: Date
): Promise<JobOfferWithCompany[]> {
  const where: Prisma.JobOfferWhereInput = {
    status: "PUBLISHED",
    deletedAt: null,
  };

  // Only get jobs created after the last check
  if (since) {
    where.createdAt = { gte: since };
  }

  // Match keywords
  if (alert.keywords) {
    const keywords = alert.keywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (keywords.length > 0) {
      where.OR = keywords.map((keyword) => ({
        OR: [
          { title: { contains: keyword, mode: "insensitive" as const } },
          { description: { contains: keyword, mode: "insensitive" as const } },
        ],
      }));
    }
  }

  // Match location
  if (alert.location) {
    where.OR = [
      { customLocation: { contains: alert.location, mode: "insensitive" as const } },
      { company: { location: { contains: alert.location, mode: "insensitive" as const } } },
    ];
  }

  // Match contract type (note: JobAlert has jobType, JobOffer has contractType)
  if (alert.jobType) {
    where.contractType = alert.jobType as "CDI" | "CDD" | "FREELANCE" | "INTERNSHIP" | "PART_TIME" | "APPRENTICESHIP";
  }

  // Match work mode (note: JobAlert has workMode, JobOffer has isRemote/isHybrid)
  if (alert.workMode) {
    if (alert.workMode === "REMOTE") {
      where.isRemote = true;
    } else if (alert.workMode === "HYBRID") {
      where.isHybrid = true;
    } else {
      where.isRemote = false;
      where.isHybrid = false;
    }
  }

  // Match minimum salary
  if (alert.salaryMin) {
    where.OR = [
      { salaryMin: { gte: alert.salaryMin } },
      { salaryMax: { gte: alert.salaryMin } },
    ];
  }

  return prisma.jobOffer.findMany({
    where,
    include: {
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          location: true,
        },
      },
    },
    take: 50, // Limit results
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Process a single job alert and send notifications
 */
export async function processJobAlert(alert: JobAlert): Promise<number> {
  // Find matching jobs since last 24 hours (as a reasonable default)
  const last24Hours = new Date();
  last24Hours.setDate(last24Hours.getDate() - 1);
  const matchingJobs = await findMatchingJobs(alert, last24Hours);

  if (matchingJobs.length === 0) {
    return 0;
  }

  // Get candidate's user ID
  const candidate = await prisma.candidate.findUnique({
    where: { id: alert.candidateId },
    include: { user: true },
  });

  if (!candidate || !candidate.user) {
    return 0;
  }

  // Check notification preferences
  const preferences = await prisma.notificationPreference.findUnique({
    where: { userId: candidate.userId },
  });

  // If job matches notifications are enabled
  if (!preferences || preferences.jobMatches) {
    // Create notification for each matching job (limit to 5 to avoid spam)
    const jobsToNotify = matchingJobs.slice(0, 5);

    // Use createMany for better performance
    if (jobsToNotify.length > 0) {
      await prisma.notification.createMany({
        data: jobsToNotify.map((job) => ({
          userId: candidate.userId,
          type: "JOB_RECOMMENDATION" as const,
          title: "New Job Match!",
          message: `"${job.title}" at ${job.company.name} matches your job alert criteria.`,
          data: {
            alertId: alert.id,
            jobId: job.id,
            jobTitle: job.title,
            companyName: job.company.name,
          },
        })),
      });
    }
  }

  return matchingJobs.length;
}

/**
 * Process all active job alerts
 * This function should be called by a cron job
 */
export async function processAllJobAlerts(): Promise<{
  processed: number;
  matches: number;
  errors: number;
}> {
  const stats = { processed: 0, matches: 0, errors: 0 };

  // Get all active alerts
  const alerts = await prisma.jobAlert.findMany({
    where: { isActive: true },
  });

  for (const alert of alerts) {
    try {
      const matches = await processJobAlert(alert);
      stats.processed++;
      stats.matches += matches;
    } catch (error) {
      console.error(`Error processing alert ${alert.id}:`, error);
      stats.errors++;
    }
  }

  return stats;
}

/**
 * Test a job alert to see how many jobs match
 */
export async function testJobAlert(alertId: string): Promise<{
  alert: JobAlert | null;
  matchingJobs: JobOfferWithCompany[];
  count: number;
}> {
  const alert = await prisma.jobAlert.findUnique({
    where: { id: alertId },
  });

  if (!alert) {
    return { alert: null, matchingJobs: [], count: 0 };
  }

  const matchingJobs = await findMatchingJobs(alert);

  return {
    alert,
    matchingJobs,
    count: matchingJobs.length,
  };
}

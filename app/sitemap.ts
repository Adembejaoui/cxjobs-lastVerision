import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { publicJobWhere, activeCompanyWhere } from "@/lib/security/company-activity";
import { absoluteUrl } from "@/lib/seo/site-url";

/**
 * sitemap.xml (launch plan U3). Lists only what is public: published,
 * unexpired, non-deleted jobs of active companies (the same rule as the job
 * pages, P5) and active companies. Drafts, closed, expired, deleted and
 * suspended-company content never appear.
 *
 * Rendered at request time (`connection()`) so `next build` never queries the
 * database, and cached for 1 hour (and refreshed with the job caches).
 */
const MAX_URLS = 5000;

const loadEntries = unstable_cache(
  async () => {
    const [jobs, companies] = await Promise.all([
      prisma.jobOffer.findMany({
        where: publicJobWhere(),
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: MAX_URLS,
      }),
      prisma.companies.findMany({
        where: activeCompanyWhere(),
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: MAX_URLS,
      }),
    ]);
    return { jobs, companies };
  },
  ["sitemap-entries"],
  { revalidate: 3600, tags: ["job-offers", "companies"] }
);

const STATIC_PATHS = ["/", "/jobs", "/companies", "/about", "/career-guide", "/privacy", "/terms"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({ url: absoluteUrl(path) }));
  try {
    const { jobs, companies } = await loadEntries();
    return [
      ...staticEntries,
      ...jobs.map((j) => ({ url: absoluteUrl(`/jobs/${j.slug}`), lastModified: new Date(j.updatedAt) })),
      ...companies.map((c) => ({ url: absoluteUrl(`/companies/${c.slug}`), lastModified: new Date(c.updatedAt) })),
    ];
  } catch (error) {
    logger.error("Sitemap generation failed", { error: error instanceof Error ? error.name : "unknown" });
    return staticEntries;
  }
}

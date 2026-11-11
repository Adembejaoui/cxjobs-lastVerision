import { unstable_cache } from "next/cache";
import { revalidateTag, revalidatePath } from "next/cache";

/**
 * Cache configuration for different data types
 */
export const CACHE_CONFIG = {
  // Public job offers - revalidate every 60 seconds
  JOB_OFFERS: {
    duration: 60,
    tags: ["job-offers"],
  },
  // Single job offer - revalidate every 60 seconds
  JOB_OFFER: {
    duration: 60,
    tags: ["job-offer"],
  },
  // Public blogs - revalidate every 120 seconds
  BLOGS: {
    duration: 120,
    tags: ["blogs"],
  },
  // Single blog - revalidate every 120 seconds
  BLOG: {
    duration: 120,
    tags: ["blog"],
  },
  // Company profiles (public) - revalidate every 5 minutes
  COMPANIES: {
    duration: 300,
    tags: ["companies"],
  },
  // Dashboard stats - revalidate every 30 seconds
  STATS: {
    duration: 30,
    tags: ["stats"],
  },
} as const;

/**
 * Wraps a function with Next.js cache
 * @param fn The function to cache
 * @param keys Cache keys to use for identification
 * @param config Cache configuration with duration and tags
 * @returns Cached function
 */
export function withCache<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  keys: string[],
  config: { duration: number; tags: string[] }
): T {
  return unstable_cache(fn, keys, {
    revalidate: config.duration,
    tags: config.tags,
  }) as T;
}

// Revalidates cache by tag
export function revalidateCacheTag(tag: string): void {
  revalidateTag(tag, "max");
}

// Revalidates cache by path
export function revalidateCachePath(path: string): void {
  revalidatePath(path);
}

/**
 * Job and company data must disappear or change on the very next request
 * after a close, delete, suspension or profile edit (launch plan P5/A6).
 * The "max" profile would serve the stale copy once more (stale-while-
 * revalidate); `{ expire: 0 }` makes the next request a blocking refresh.
 */
const IMMEDIATE = { expire: 0 } as const;

// Revalidates all job-related caches
export function revalidateJobOffers(): void {
  revalidateTag("job-offers", IMMEDIATE);
  revalidateTag("job-offer", IMMEDIATE);
  revalidatePath("/api/job-offers");
  // Company pages are ISR (revalidate = 600) and list the company's jobs
  // without a cache tag, so a job edit/publish/delete must refresh them too
  // or they keep showing stale (even deleted) jobs for up to 10 minutes.
  revalidatePath("/companies/[slug]", "page");
  revalidatePath("/companies", "page");
}

// Revalidates all blog-related caches
export function revalidateBlogs(): void {
  revalidateTag("blogs", "max");
  revalidateTag("blog", "max");
  revalidatePath("/api/blogs");
}

// Revalidates stats cache
export function revalidateStats(): void {
  revalidateTag("stats", "max");
  revalidatePath("/api/stats");
}

// Revalidates company caches
export function revalidateCompanies(): void {
  revalidateTag("companies", IMMEDIATE);
  revalidatePath("/api/profile/allCompanies");
  revalidatePath("/companies/[slug]", "page");
  revalidatePath("/companies", "page");
}
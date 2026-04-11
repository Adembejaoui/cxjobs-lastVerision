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

/**
 * Revalidates cache by tag (Next.js 16+ compatible)
 * @param tag The cache tag to revalidate
 */
export function revalidateCacheTag(tag: string): void {
  revalidateTag(tag, "cache");
}

/**
 * Revalidates cache by path
 * @param path The path to revalidate
 */
export function revalidateCachePath(path: string): void {
  revalidatePath(path);
}

/**
 * Revalidates all job-related caches
 */
export function revalidateJobOffers(): void {
  revalidateTag("job-offers", "cache");
  revalidateTag("job-offer", "cache");
  revalidatePath("/api/job-offers");
}

/**
 * Revalidates all blog-related caches
 */
export function revalidateBlogs(): void {
  revalidateTag("blogs", "cache");
  revalidateTag("blog", "cache");
  revalidatePath("/api/blogs");
}

/**
 * Revalidates stats cache
 */
export function revalidateStats(): void {
  revalidateTag("stats", "cache");
  revalidatePath("/api/stats");
}

/**
 * Revalidates company caches
 */
export function revalidateCompanies(): void {
  revalidateTag("companies", "cache");
  revalidatePath("/api/profile/allCompanies");
}

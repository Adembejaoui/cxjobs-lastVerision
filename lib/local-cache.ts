import { redis } from "./redis";
import { logger } from "./logger";

interface CacheAdapter {
  get(key: string): Promise<string | null>;
  setex(key: string, ttlSeconds: number, value: string): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
}

class RedisCacheAdapter implements CacheAdapter {
  private redisClient: NonNullable<typeof redis>;

  constructor(redisClient: NonNullable<typeof redis>) {
    this.redisClient = redisClient;
  }

  async get(key: string): Promise<string | null> {
    const value = await this.redisClient.get(key);
    if (value === null || value === undefined) return null;
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.redisClient.setex(key, ttlSeconds, value);
  }

  async del(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.redisClient.incr(key);
  }
}

export function getCache(): CacheAdapter {
  if (!redis) {
    const env = process.env.NODE_ENV;
    if (env === "production") {
      throw new Error(
        "Redis is not configured. Caching requires Redis in production. " +
        "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables."
      );
    }
    throw new Error(
      "Redis is not configured. Caching requires Redis. " +
      "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables."
    );
  }
  return new RedisCacheAdapter(redis);
}

export async function getCachedDashboardStats(key: string): Promise<string | null> {
  try {
    return await getCache().get(key);
  } catch (error) {
    logger.warn("Cache read failed", { error, key });
    return null;
  }
}

export async function setCachedDashboardStats(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
  try {
    await getCache().setex(key, ttlSeconds, value);
  } catch (error) {
    logger.warn("Cache write failed", { error, key });
  }
}

export async function invalidateCache(key: string): Promise<void> {
  try {
    await getCache().del(key);
  } catch (error) {
    logger.warn("Cache invalidation failed", { error, key });
  }
}

/**
 * Version key for a single company's analytics entries. The companyId is
 * interpolated, so this is strictly scoped to that one company.
 */
function companyAnalyticsVersionKey(companyId: string): string {
  return `dashboard:company:analytics:ver:${companyId}`;
}

/**
 * Read the current analytics version for a company. A missing key means the
 * company has never been invalidated, so version 0 is the correct value.
 */
export async function getCompanyAnalyticsVersion(companyId: string): Promise<number> {
  try {
    const raw = await getCache().get(companyAnalyticsVersionKey(companyId));
    if (raw === null) return 0;
    const parsed = Number(typeof raw === "string" ? raw : JSON.parse(raw));
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (error) {
    logger.warn("Analytics version read failed", { error, companyId });
    return 0;
  }
}

/**
 * Invalidate every cached analytics entry for one company by advancing its
 * version counter. Because the version is part of the cache key, a single
 * increment retires all `days`/`language` variants at once — no scan, no key
 * enumeration. Entries written under the previous version are left to expire
 * on their own TTL, which also makes this race-safe: a request that read the
 * old version and finishes afterwards writes to a key nothing will read again.
 *
 * Failures are swallowed so a Redis outage can never fail the mutation.
 */
export async function invalidateCompanyAnalytics(companyId: string): Promise<void> {
  const key = companyAnalyticsVersionKey(companyId);
  try {
    await getCache().incr(key);
  } catch (error) {
    logger.warn("Company analytics invalidation failed", { error, companyId });
  }
}

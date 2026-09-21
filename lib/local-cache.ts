import { redis } from "./redis";
import { logger } from "./logger";

interface CacheAdapter {
  get(key: string): Promise<string | null>;
  setex(key: string, ttlSeconds: number, value: string): Promise<void>;
  del(key: string): Promise<void>;
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

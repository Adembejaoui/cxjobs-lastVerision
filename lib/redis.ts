import { Redis } from "@upstash/redis";

const globalForRedis = global as unknown as {
  redis: Redis | null;
};

function createRedisClient(): Redis | null {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    return new Redis({
      url: upstashUrl,
      token: upstashToken,
    });
  }

  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  throw new Error(
    "Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables."
  );
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production" && redis !== null) {
  globalForRedis.redis = redis;
}

export function isRedisConfigured(): boolean {
  return !!redis;
}

export default redis;

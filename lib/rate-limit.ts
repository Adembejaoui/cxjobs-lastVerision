import { redis } from "./redis";

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60_000,
  max: 10,
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function assertRedisConfigured(): void {
  if (!redis && process.env.NODE_ENV === "production") {
    throw new Error(
      "Redis is not configured. Rate limiting and caching require Redis in production. " +
      "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables."
    );
  }
}

async function checkRateLimitRedis(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  const now = Date.now();
  const resetAt = now + config.windowMs;
  const redisKey = `ratelimit:${key}`;

  const multi = redis!.multi();
  multi.incr(redisKey);
  multi.expire(redisKey, Math.ceil(config.windowMs / 1000));

  const results = await multi.exec();
  const count = results && results.length > 0
    ? (typeof results[0] === "number" ? results[0] : Number(results[0]))
    : 1;

  const remaining = Math.max(0, config.max - count);

  if (count > config.max) {
    return { allowed: false, remaining: 0, resetAt };
  }

  return { allowed: true, remaining, resetAt };
}

export async function checkRateLimitAsync(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  if (!redis) {
    assertRedisConfigured();
    return { allowed: true, remaining: config.max, resetAt: Date.now() + config.windowMs };
  }
  return checkRateLimitRedis(key, config);
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(DEFAULT_CONFIG.max),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

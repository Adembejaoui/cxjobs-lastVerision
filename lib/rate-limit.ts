/**
 * In-memory rate limiting utility for CXJobs API
 * 
 * For production with multiple instances, consider using:
 * - @upstash/ratelimit with Redis
 * - rate-limiter-flexible with Redis/MongoDB
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory store for rate limiting
 * Note: This will reset on server restart and doesn't work across instances
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries periodically (every 5 minutes)
 */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Rate limit configuration presets
 */
export const RATE_LIMIT_PRESETS = {
  // For authentication endpoints (login, register, forgot-password)
  AUTH: { maxRequests: 5, windowMs: 60 * 1000 }, // 5 requests per minute
  // For password reset
  PASSWORD_RESET: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 requests per hour
  // For API writes (POST, PUT, DELETE)
  API_WRITE: { maxRequests: 30, windowMs: 60 * 1000 }, // 30 requests per minute
  // For API reads (GET)
  API_READ: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 requests per minute
  // For public endpoints
  PUBLIC: { maxRequests: 60, windowMs: 60 * 1000 }, // 60 requests per minute
} as const;

export interface RateLimitOptions {
  /**
   * Maximum number of requests allowed in the window
   */
  maxRequests: number;
  /**
   * Time window in milliseconds
   */
  windowMs: number;
  /**
   * Key prefix for namespacing
   */
  keyPrefix?: string;
}

export interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  success: boolean;
  /**
   * Number of requests remaining in the current window
   */
  remaining: number;
  /**
   * Time when the rate limit resets (Unix timestamp in ms)
   */
  resetAt: number;
  /**
   * Total requests allowed in the window
   */
  limit: number;
}

/**
 * Check rate limit for a given key
 * 
 * @param key - Unique identifier for the client (e.g., IP address, user ID)
 * @param options - Rate limit configuration
 * @returns Rate limit result
 * 
 * @example
 * const result = checkRateLimit(clientIp, RATE_LIMIT_PRESETS.AUTH);
 * if (!result.success) {
 *   return NextResponse.json(
 *     { error: "Too many requests", retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000) },
 *     { status: 429, headers: { "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)) } }
 *   );
 * }
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const { maxRequests, windowMs, keyPrefix = "" } = options;
  const fullKey = keyPrefix ? `${keyPrefix}:${key}` : key;
  const now = Date.now();
  const resetAt = now + windowMs;

  const entry = rateLimitStore.get(fullKey);

  if (!entry || entry.resetAt < now) {
    // No entry or expired - create new entry
    rateLimitStore.set(fullKey, { count: 1, resetAt });
    return {
      success: true,
      remaining: maxRequests - 1,
      resetAt,
      limit: maxRequests,
    };
  }

  if (entry.count >= maxRequests) {
    // Rate limit exceeded
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
      limit: maxRequests,
    };
  }

  // Increment count
  entry.count++;
  return {
    success: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
    limit: maxRequests,
  };
}

/**
 * Create a rate limiter function with pre-configured options
 * 
 * @example
 * const authLimiter = createRateLimiter(RATE_LIMIT_PRESETS.AUTH);
 * const result = authLimiter(clientIp);
 */
export function createRateLimiter(options: RateLimitOptions) {
  return (key: string): RateLimitResult => checkRateLimit(key, options);
}

/**
 * Express/Next.js middleware helper for rate limiting
 * Returns a 429 response if rate limited, null otherwise
 */
export function rateLimitResponse(
  key: string,
  options: RateLimitOptions
): Response | null {
  const result = checkRateLimit(key, options);
  
  if (!result.success) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Too many requests. Please try again later.",
        code: "RATE_LIMITED",
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": String(result.remaining),
          "X-RateLimit-Reset": String(result.resetAt),
        },
      }
    );
  }
  
  return null;
}

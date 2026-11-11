/**
 * Daily per-user AI quota (launch plan S7).
 *
 * The per-minute rate limits on the AI routes stop bursts; this caps the
 * total number of paid AI calls one account can trigger per UTC day, shared
 * across every AI feature (job generation, job import from URL, CV parsing).
 *
 * - Enforced server-side on the same atomic Redis counter as the rate
 *   limiter (single INCR per call), so concurrent requests cannot overshoot.
 * - The key contains the UTC date, so the allowance resets at 00:00 UTC; the
 *   window TTL only garbage-collects yesterday's key.
 * - Fail-closed: if the counter backend is unavailable the AI call is refused,
 *   exactly like the existing AI rate limits.
 * - A request that fails on OUR side or the provider's (timeout, provider
 *   error, unusable answer) is refunded, so users are not charged for
 *   failures. Input validation happens before the quota is consumed.
 */
import { checkRateLimitAsync, refundRateLimitAsync, getRateLimitHeaders, type RateLimitResult } from "@/lib/rate-limit";

export const DEFAULT_AI_DAILY_QUOTA = 30;

export function aiDailyQuota(): number {
  const raw = Number.parseInt(process.env.AI_DAILY_QUOTA ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_AI_DAILY_QUOTA;
}

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function msUntilNextUtcMidnight(now: Date): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1_000, next - now.getTime());
}

export interface AIQuotaTicket {
  result: RateLimitResult;
  /** Give the unit back (call when the AI request failed). Idempotent. */
  refund(): Promise<void>;
}

export async function consumeAIQuota(userId: string, now: Date = new Date()): Promise<AIQuotaTicket> {
  const key = `ai-daily:${userId}:${utcDay(now)}`;
  const result = await checkRateLimitAsync(key, { windowMs: msUntilNextUtcMidnight(now), max: aiDailyQuota() });
  let refunded = !result.allowed; // a denied hit was over the cap; nothing to give back
  return {
    result,
    async refund() {
      if (refunded) return;
      refunded = true;
      await refundRateLimitAsync(key);
    },
  };
}

export function aiQuotaExceededBody() {
  return {
    success: false as const,
    error: "You have reached today's limit for AI features. Please try again tomorrow.",
    code: "AI_QUOTA_EXCEEDED",
  };
}

export function aiQuotaHeaders(result: RateLimitResult): Record<string, string> {
  return getRateLimitHeaders(result);
}

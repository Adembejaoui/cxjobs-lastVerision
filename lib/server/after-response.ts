import { after } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Run `task` after the HTTP response has been sent (Next.js `after()`, which
 * on Vercel is kept alive via waitUntil). Used for account-dependent work in
 * enumeration-sensitive endpoints, so response timing does not depend on
 * whether an account exists or on email-provider latency.
 *
 * Outside a Next request scope (unit/integration tests, scripts) the task is
 * started immediately and its promise is returned so callers can await it.
 */
export function runAfterResponse(label: string, task: () => Promise<unknown>): Promise<void> | undefined {
  const safe = async () => {
    try {
      await task();
    } catch (error) {
      logger.error("Deferred task failed", { label, error: error instanceof Error ? error.name : "unknown" });
    }
  };
  try {
    after(safe);
    return undefined;
  } catch {
    return safe();
  }
}

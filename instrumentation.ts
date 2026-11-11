/**
 * Next.js server-start hook (runs once per server process).
 *
 * Validates the environment by variable NAME (values are never logged).
 * Skipped during `next build`: builds deliberately run with placeholder values
 * (CI, isolated local builds) and perform no database or service access.
 * Node runtime only: the validator uses the Node logger.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { runStartupEnvValidation } = await import("./lib/env");
  runStartupEnvValidation();
}

/**
 * Error tracking hook (launch plan A9 / audit F-03). Every unhandled server
 * error (route handlers, server components, server actions) produces ONE
 * structured log line with a fixed message, so a log drain or log-based alert
 * can match it ("Unhandled server error"). Only non-sensitive fields are
 * recorded: error name, digest, method, route pattern and path WITHOUT the
 * query string (it may carry tokens). No error message, headers or body.
 *
 * Optional: ERROR_ALERT_WEBHOOK_URL (https) receives the same minimal JSON,
 * e.g. a Slack/Discord/incident webhook. Best effort, 3 s timeout.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const report = {
    name: error instanceof Error ? error.name : typeof error,
    digest:
      typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : undefined,
    method: request.method,
    path: request.path.split("?")[0],
    route: context.routePath,
    routeType: context.routeType,
  };
  try {
    const { logger } = await import("./lib/logger");
    logger.error("Unhandled server error", report);
  } catch {
    // Logging must never throw from the error hook.
  }
  const webhook = process.env.ERROR_ALERT_WEBHOOK_URL;
  if (webhook && webhook.startsWith("https://")) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `CXJobs server error: ${report.name} on ${report.method} ${report.route}`, ...report }),
        signal: AbortSignal.timeout(3_000),
      });
    } catch {
      // Best effort: an alerting outage must not affect the request.
    }
  }
}

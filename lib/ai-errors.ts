/**
 * AI failure type shared by lib/ai-service.ts and the routes that call it.
 * Kept dependency-free (no SDK import) so routes can classify failures even
 * where the AI service module is replaced (tests) or not configured.
 */

export type AIFailureKind = "timeout" | "unavailable" | "invalid_response";

/**
 * The only error type thrown by lib/ai-service.ts. `message` is a fixed,
 * generic string; provider details (status, error body, request id) are never
 * attached, so callers cannot leak them to clients by accident.
 */
export class AIServiceError extends Error {
  constructor(message: string, readonly kind: AIFailureKind) {
    super(message);
    this.name = "AIServiceError";
  }
}

/**
 * Overall budget for one AI-backed request (every attempt and retry
 * included). Launch plan A12: a slow AI provider must make the request fail
 * cleanly within 30 seconds, so routes abort at this deadline and answer 504.
 */
export const AI_ROUTE_DEADLINE_MS = 28_000;

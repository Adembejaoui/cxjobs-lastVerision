import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility functions for the CXJobs API
 */

/**
 * Merge Tailwind CSS classes with proper deduplication
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ==================== Pagination Utilities ====================

/**
 * Maximum allowed limit for pagination to prevent DoS attacks
 */
export const MAX_PAGINATION_LIMIT = 100;
export const DEFAULT_PAGINATION_LIMIT = 10;
export const DEFAULT_PAGINATION_PAGE = 1;

/**
 * Safely parses and validates offset pagination parameters
 * Prevents DoS by enforcing maximum limits
 */
export function parsePaginationParams(
  pageParam: string | null,
  limitParam: string | null
): { page: number; limit: number; skip: number } {
  const page = Math.max(1, parseInt(pageParam || String(DEFAULT_PAGINATION_PAGE)) || DEFAULT_PAGINATION_PAGE);
  const limit = Math.min(
    MAX_PAGINATION_LIMIT,
    Math.max(1, parseInt(limitParam || String(DEFAULT_PAGINATION_LIMIT)) || DEFAULT_PAGINATION_LIMIT)
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

// ==================== Cursor Pagination Utilities ====================

export interface CursorPaginationParams {
  limit: number;
  cursor?: string;
}

export interface CursorPageResult<T> {
  data: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
}

export function parseCursorParams(searchParams: URLSearchParams): CursorPaginationParams {
  const limit = Math.min(
    MAX_PAGINATION_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_PAGINATION_LIMIT)) || DEFAULT_PAGINATION_LIMIT)
  );
  const cursor = searchParams.get("cursor") || undefined;

  return { limit, cursor };
}


// ==================== Validation Utilities ====================

/**
 * Validates that a string is a valid UUID
 */
export function isValidUuid(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * HTML entity map for sanitization
 */
const HTML_ENTITIES = new Map<string, string>([
  ["<", "\x26lt;"],
  [">", "\x26gt;"],
  ['"', "\x26quot;"],
  ["'", "\x26#x27;"],
  ["/", "\x26#x2F;"],
]);

/**
 * Sanitizes a string by removing potentially dangerous HTML/script content
 * For basic XSS prevention - use a library like DOMPurify for rich text
 */
export function sanitizeString(input: string): string {
  return input.replace(/[<>"'/]/g, (char) => HTML_ENTITIES.get(char) || char);
}

/**
 * Sanitizes rich text content (basic implementation)
 * For production, consider using a library like DOMPurify or sanitize-html
 */
export function sanitizeRichText(input: string): string {
  // Remove script tags and their content
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  // Remove event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");
  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript:/gi, "");
  return sanitized;
}

// ==================== Response Utilities ====================

/**
 * Standard API response structure
 */
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Pagination metadata for list responses
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      ...(message && { message }),
      data,
    }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  error: string,
  code: string,
  status: number = 400,
  details?: Record<string, unknown>
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error,
      code,
      ...(details && { details }),
    }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

// ==================== Request Utilities ====================

/**
 * Client IP for rate-limit keys.
 *
 * Proxy headers are client-forgeable unless a trusted proxy overwrites them,
 * so the first X-Forwarded-For entry (which the client controls) is never
 * trusted on its own:
 *  - On Vercel (`VERCEL=1`, set by the platform) the edge overwrites
 *    `x-real-ip` / `x-forwarded-for` with the real client address.
 *  - Elsewhere we assume exactly one trusted reverse proxy that APPENDS the
 *    peer address, and use the right-most X-Forwarded-For entry.
 * The value must parse as an IP; anything else collapses to "unknown" so a
 * forged header cannot mint unlimited fresh rate-limit buckets.
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  const candidates: (string | null | undefined)[] = [];

  if (process.env.VERCEL === "1") {
    candidates.push(headers.get("x-real-ip"));
    candidates.push(headers.get("x-forwarded-for")?.split(",")[0]);
  } else {
    const xff = headers.get("x-forwarded-for");
    if (xff) {
      const parts = xff.split(",");
      candidates.push(parts[parts.length - 1]);
    }
  }

  for (const raw of candidates) {
    const ip = raw?.trim();
    if (ip && isIpLiteral(ip)) return ip.toLowerCase();
  }
  return "unknown";
}

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HEXTET_RE = /^[0-9a-f]{1,4}$/i;

function isIpv6Literal(value: string): boolean {
  const halves = value.split("::");
  if (halves.length > 2) return false;
  const groups = halves.flatMap((h) => (h === "" ? [] : h.split(":")));
  let units = 0;
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (i === groups.length - 1 && g.includes(".")) {
      if (!IPV4_RE.test(g)) return false; // embedded IPv4 tail
      units += 2;
    } else if (HEXTET_RE.test(g)) {
      units += 1;
    } else {
      return false;
    }
  }
  return halves.length === 2 ? units <= 7 : units === 8;
}

function isIpLiteral(value: string): boolean {
  if (value.length > 45) return false;
  if (IPV4_RE.test(value)) return true;
  return value.includes(":") && isIpv6Literal(value);
}

/**
 * Generates a unique request ID for tracing
 */
export function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

// ==================== Rate Limiting Types ====================

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the window
   */
  maxRequests: number;
  /**
   * Time window in milliseconds
   */
  windowMs: number;
  /**
   * Key prefix for storage
   */
  keyPrefix?: string;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: Date;
  total: number;
}

// ==================== Password Utilities ====================

/**
 * Password strength requirements
 */
export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
};

/**
 * Validates password strength
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  }

  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

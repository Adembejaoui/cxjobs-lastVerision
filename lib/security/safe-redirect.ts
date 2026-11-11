/**
 * Post-login redirect target validation (F4).
 *
 * Only same-origin, path-absolute targets are honoured. Everything else falls
 * back to `fallback`, so `callbackUrl` can never become an open redirect:
 *  - absolute URLs ("https://evil.tld"), protocol-relative ("//evil.tld"),
 *    backslash tricks ("/\\evil.tld", "\\\\evil.tld"), scheme URLs
 *    ("javascript:..."), control characters and over-long values are rejected;
 *  - the value is resolved with the WHATWG parser against a fixed dummy
 *    origin and must still resolve to that origin.
 *  - auth pages are not valid targets (avoids login → login loops).
 */

const DUMMY_ORIGIN = "https://same-origin.invalid";
const MAX_LENGTH = 1024;
const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];

export function safeCallbackPath(raw: unknown, fallback = "/dashboard"): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (!value || value.length > MAX_LENGTH) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001F\u007F]/.test(value)) return fallback;

  let url: URL;
  try {
    url = new URL(value, DUMMY_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== DUMMY_ORIGIN) return fallback;
  if (AUTH_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) return fallback;

  return `${url.pathname}${url.search}${url.hash}`;
}

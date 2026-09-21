import { logger } from "./logger";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 100_000;
const MAX_REDIRECTS = 3;

export function stripHtmlToText(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  const entities: Record<string, string> = {
    "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">",
    "&quot;": '"', "&#039;": "'", "&apos;": "'",
  };
  for (const [entity, decoded] of Object.entries(entities)) {
    text = text.split(entity).join(decoded);
  }
  return text;
}

/**
 * Blocked IP ranges — private, loopback, link-local, multicast, reserved.
 * Checked after DNS resolution and again after every redirect.
 */
export function isBlockedIp(ip: string): boolean {
  // IPv4 checks
  const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 0 || a === 127 || a >= 224 || a === 10 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 169 && b === 254) ||
        (a === 100 && b >= 64 && b <= 127)) {
      return true;
    }
    return false;
  }

  // IPv6 checks
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::" ||
      lower.startsWith("fc") || lower.startsWith("fd") ||
      lower.startsWith("fe80") || lower.startsWith("fe90") ||
      lower.startsWith("fea0") || lower.startsWith("feb0") ||
      lower.startsWith("fec0") || lower.startsWith("fed0") ||
      lower.startsWith("fee0") || lower.startsWith("fef0") ||
      lower.startsWith("ff00")) {
    return true;
  }

  return false;
}

/**
 * Validate a URL is safe to fetch: HTTPS only, not a data/blob URI,
 * and hostname is not an IP literal that would be blocked.
 */
export function isSafeUrl(urlString: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") {
    return false;
  }

  // Block IP literals directly in the URL
  const ipv4 = parsed.hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    if (isBlockedIp(parsed.hostname)) return false;
  }

  const ipv6 = parsed.hostname.match(/^\[([0-9a-fA-F:]+)\]$/);
  if (ipv6) {
    if (isBlockedIp(ipv6[1])) return false;
  }

  return true;
}

/**
 * Resolve a hostname to IPs and verify none are blocked.
 * Returns the first safe IP or null if all are blocked/unresolvable.
 */
async function resolveAndValidate(hostname: string): Promise<string | null> {
  try {
    const { lookup } = await import("dns/promises");
    const addresses = await lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (!isBlockedIp(addr.address)) {
        return addr.address;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export interface FetchUrlOptions {
  timeoutMs?: number;
  maxBytes?: number;
}

export async function fetchUrlText(
  url: string,
  options: FetchUrlOptions = {}
): Promise<string | null> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = MAX_HTML_BYTES } = options;

  if (!isSafeUrl(url)) {
    logger.warn("Rejected unsafe URL", { url });
    return null;
  }

  let currentUrl = url;
  let redirects = 0;

  while (redirects <= MAX_REDIRECTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Re-validate after redirects
      if (!isSafeUrl(currentUrl)) {
        logger.warn("Rejected unsafe redirect URL", { url: currentUrl });
        return null;
      }

      const hostname = new URL(currentUrl).hostname;
      const safeIp = await resolveAndValidate(hostname);
      if (!safeIp) {
        logger.warn("Rejected blocked IP for hostname", { hostname });
        return null;
      }

      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CXJobsBot/1.0; +https://cxjobs.app)",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
        },
      });

      // Handle redirects manually
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          logger.warn("Redirect without location header", { url: currentUrl });
          return null;
        }
        redirects++;
        if (redirects > MAX_REDIRECTS) {
          logger.warn("Too many redirects from URL", { url });
          return null;
        }
        try {
          currentUrl = new URL(location, currentUrl).href;
        } catch {
          logger.warn("Invalid redirect URL", { location });
          return null;
        }
        continue;
      }

      const ct = response.headers.get("content-type") || "";
      if (!response.ok || !ct.includes("text/html")) {
        logger.warn("Skipped URL - not HTML or error status", { url: currentUrl, status: response.status, contentType: ct });
        return null;
      }

      const reader = response.body?.getReader();
      if (!reader) return null;

      const decoder = new TextDecoder("utf-8", { fatal: false });
      let totalBytes = 0;
      let html = "";

      while (true) {
        const result = await reader.read();
        const { done, value } = result as { done: boolean; value: Uint8Array | null };
        if (done || !value) break;

        if (totalBytes + value.byteLength > maxBytes) {
          html += decoder.decode(value.slice(0, maxBytes - totalBytes));
          break;
        }
        totalBytes += value.byteLength;
        html += decoder.decode(value);
      }

      reader.cancel();
      return stripHtmlToText(html);
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        logger.warn("Timeout exceeded for URL", { url: currentUrl, timeoutMs });
      } else {
        logger.error("Fetch error for URL", { url: currentUrl, error });
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  logger.warn("Too many redirects from URL", { url });
  return null;
}
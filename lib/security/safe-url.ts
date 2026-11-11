import { z } from "zod";

/**
 * Canonical, scheme-restricted URL validation shared by server schemas and
 * the UI's point-of-use checks. Parsing goes through the WHATWG URL parser
 * (the same one browsers use), so what we validate is what a browser opens.
 *
 * Only http: and https: are ever accepted. javascript:, data:, file:, blob:,
 * vbscript:, protocol-relative ("//host") and scheme-less values are rejected.
 */

export interface SafeUrlOptions {
  /** Allow plain http: in addition to https:. Default true for user links. */
  allowHttp?: boolean;
  /** Maximum accepted length of the raw input. */
  maxLength?: number;
}

const DEFAULT_MAX_LENGTH = 2048;

// Control characters and whitespace inside a URL are a classic parser
// differential vector ("java\tscript:"). The WHATWG parser strips some of
// them silently, so reject them before parsing.
const FORBIDDEN_CHARS = /[\u0000-\u001F\u007F\s\\]/;

export function parseSafeHttpUrl(
  input: unknown,
  options: SafeUrlOptions = {}
): URL | null {
  const { allowHttp = true, maxLength = DEFAULT_MAX_LENGTH } = options;
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (value.length === 0 || value.length > maxLength) return null;
  if (FORBIDDEN_CHARS.test(value)) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  const allowed = allowHttp ? ["https:", "http:"] : ["https:"];
  if (!allowed.includes(parsed.protocol)) return null;
  if (!parsed.hostname) return null;
  // Credentials in links are a phishing vector (https://bank.com@evil.tld).
  if (parsed.username || parsed.password) return null;
  return parsed;
}

export function isSafeHttpUrl(input: unknown, options?: SafeUrlOptions): boolean {
  return parseSafeHttpUrl(input, options) !== null;
}

/**
 * Point-of-use guard for rendering stored URLs as links. Returns the
 * canonical href or `undefined` so callers can omit/disable the link.
 * Never transforms an unsafe value into a "fixed" one.
 */
export function toSafeHref(input: unknown, options?: SafeUrlOptions): string | undefined {
  return parseSafeHttpUrl(input, options)?.href;
}

const INVALID_URL_MESSAGE = "Please enter a valid http(s) URL";

/** Required safe URL (returns the trimmed original string). */
export function safeUrlSchema(options?: SafeUrlOptions, message = INVALID_URL_MESSAGE) {
  return z
    .string()
    .trim()
    .refine((v) => isSafeHttpUrl(v, options), { message });
}

/**
 * Optional safe URL: undefined/null pass through, "" is treated as "cleared"
 * and normalised to null, anything else must be a safe http(s) URL.
 */
export function optionalSafeUrlSchema(options?: SafeUrlOptions, message = INVALID_URL_MESSAGE) {
  return z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (typeof v === "string" && v.trim() === "" ? null : v))
    .refine((v) => v === undefined || v === null || isSafeHttpUrl(v, options), { message })
    .transform((v) => (typeof v === "string" ? v.trim() : v));
}

// ==================== Own-storage image URLs (launch plan S5) ====================

/**
 * Image fields (avatars, logos, covers, culture images) may only point at
 * THIS application's public image buckets: the upload API is the only way
 * to set them. Any other host (tracking pixels, hot-linked third-party
 * content, look-alike Supabase projects) is rejected.
 *
 * Client-safe (no server imports): the configured project comes from
 * NEXT_PUBLIC_SUPABASE_URL. Keep PRODUCTION_SUPABASE_HOST in sync with
 * next.config.ts (`trustedSupabaseHosts`), which allows the same hosts for
 * next/image.
 */
export const PRODUCTION_SUPABASE_HOST = "hvbbactmgfhecqbetlhg.supabase.co";
export const PUBLIC_IMAGE_BUCKETS = ["avatars", "logos", "covers", "culture-images", "blog-images"] as const;

export function trustedStorageHosts(env: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): string[] {
  const hosts = new Set<string>([PRODUCTION_SUPABASE_HOST]);
  try {
    if (env) {
      const { protocol, hostname } = new URL(env);
      if (protocol === "https:" && hostname.endsWith(".supabase.co")) hosts.add(hostname);
    }
  } catch {
    // Malformed value: production host only.
  }
  return [...hosts];
}

export function isOwnStorageImageUrl(input: unknown, hosts: string[] = trustedStorageHosts()): boolean {
  const url = parseSafeHttpUrl(input, { allowHttp: false });
  if (!url) return false;
  if (url.port !== "" || !hosts.includes(url.hostname)) return false;
  const prefix = "/storage/v1/object/public/";
  if (!url.pathname.startsWith(prefix)) return false;
  const [bucket, ...rest] = url.pathname.slice(prefix.length).split("/");
  if (!(PUBLIC_IMAGE_BUCKETS as readonly string[]).includes(bucket)) return false;
  // A real object path, with no traversal segments (encoded or not).
  return rest.length > 0 && rest.every((seg) => seg !== "" && !/^(\.|%2e){1,2}$/i.test(seg));
}

const INVALID_IMAGE_MESSAGE = "Please upload the image instead of pasting a link";

/** Optional image URL: empty → null; otherwise must be an own-storage URL. */
export function optionalStorageImageUrlSchema(message = INVALID_IMAGE_MESSAGE) {
  return z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (typeof v === "string" && v.trim() === "" ? null : v))
    .refine((v) => v === undefined || v === null || isOwnStorageImageUrl(v.trim()), { message })
    .transform((v) => (typeof v === "string" ? v.trim() : v));
}

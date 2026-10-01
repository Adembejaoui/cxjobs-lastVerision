import { z } from "zod";

/**
 * Single source of truth for candidate LinkedIn URL validation.
 *
 * Users routinely type a LinkedIn profile without the protocol
 * ("linkedin.com/in/adem"), so a bare value is accepted and normalized to an
 * absolute URL rather than rejected. Normalization lives inside the schema so
 * the stored value is always a safe absolute URL, independent of which client
 * posted it. A bare value would otherwise reach an `href` and be resolved by the
 * browser as a relative URL.
 *
 * The host check compares the PARSED hostname, never a string prefix, so
 * look-alikes ("evillinkedin.com") and non-web schemes ("javascript:",
 * "data:") cannot pass. Only "linkedin.com" and its subdomains are accepted.
 *
 * Scope: this applies to the CANDIDATE profile only. `companyProfileSchema`
 * reuses the field name `linkedinUrl` for a company *slug*, not a URL, and
 * deliberately does not use this schema.
 */

const LINKEDIN_HOST = "linkedin.com";
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** Matches a leading URI scheme such as "https:" or "mailto:". */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

const GENERIC_ERROR = "Please enter a valid LinkedIn URL.";
const HOST_ERROR = "Please enter a valid LinkedIn URL (linkedin.com/...).";

export type NormalizedLinkedInUrl =
  | { ok: true; value: string }
  | { ok: false; error: string };

function isLinkedInHostname(hostname: string): boolean {
  // URL already lowercases the hostname; compared against an exact host and a
  // dot-anchored suffix so "evillinkedin.com" cannot match.
  return hostname === LINKEDIN_HOST || hostname.endsWith(`.${LINKEDIN_HOST}`);
}

/**
 * Normalizes and validates one candidate LinkedIn value.
 *
 * Empty is not an error: LinkedIn is optional, so `undefined`, `null`, `""` and
 * whitespace-only input all resolve to a successful result with an empty
 * `value`, which the schema maps back to `null` for storage.
 *
 * Normalization rules:
 *  - no URI scheme  -> "https://" is prepended
 *  - "http://"      -> preserved as typed, never silently upgraded to https
 *  - "https://"     -> preserved
 *  - "www."         -> preserved
 */
export function normalizeLinkedInUrl(input: unknown): NormalizedLinkedInUrl {
  if (input === null || input === undefined) {
    return { ok: true, value: "" };
  }
  if (typeof input !== "string") {
    return { ok: false, error: GENERIC_ERROR };
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: "" };
  }

  const withScheme = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  if (!isLinkedInHostname(parsed.hostname)) {
    return { ok: false, error: HOST_ERROR };
  }

  // `https://linkedin.com` and `https://linkedin.com/` are not profile URLs.
  // The path is intentionally not restricted to "/in/", so company and group
  // pages stay valid LinkedIn destinations.
  if (parsed.pathname.replace(/\/+$/, "").length === 0) {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true, value: parsed.href };
}

/**
 * Optional, normalizing LinkedIn URL for the candidate profile.
 *
 * Absent stays absent. `undefined` is mapped back to `undefined` (not `null`)
 * so an omitted key is still omitted from the parsed object, which is what lets
 * an ordinary partial profile edit leave the stored LinkedIn URL untouched.
 * Mapping it to `null` would silently clear the column on every unrelated save.
 *
 * An explicit empty or whitespace-only string normalizes to `null`, matching the
 * previous `z.string().optional().nullable()` behaviour where the route's
 * `linkedinUrl || null` treated "" as "clear the field".
 *
 * A real value is normalized and returned in absolute form, which is what
 * reaches `profileData.linkedinUrl` and therefore the database.
 */
export const linkedinUrlSchema = z
  .string()
  .nullish()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    const result = normalizeLinkedInUrl(value);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.error });
      return z.NEVER;
    }
    return result.value.length > 0 ? result.value : null;
  });

export type LinkedInUrlInput = z.input<typeof linkedinUrlSchema>;
export type LinkedInUrlOutput = z.output<typeof linkedinUrlSchema>;

/**
 * CV object references and access policy.
 *
 * CVs live in the PRIVATE `cv` bucket. The database stores the object path
 * (`<ownerUserId>/<random>.<ext>`), never a bearer URL. Access is granted only
 * by server routes that check authorization and then mint a short-lived
 * signed URL. Legacy rows that still hold a (long-expired) Supabase signed or
 * public URL are parsed back to their object path.
 */

export const CV_BUCKET = "cv";
export const CV_SIGNED_URL_TTL_SECONDS = 60;

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const OBJECT_PATH_RE = new RegExp(`^(${UUID})/[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`);
const STORAGE_URL_PATH_RE = /^\/storage\/v1\/object\/(?:sign|public|authenticated)\/cv\/(.+)$/;

/** Owner user id encoded in a valid object path, or null. */
export function cvPathOwner(path: string): string | null {
  if (path.includes("..")) return null;
  const m = OBJECT_PATH_RE.exec(path);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Turn a stored/submitted CV reference into a validated object path.
 * Accepts a bare object path, or a Supabase storage URL for the `cv` bucket
 * on `supabaseHost` (legacy rows / older clients). Everything else → null.
 */
export function extractCvObjectPath(value: unknown, supabaseHost?: string | null): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;

  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) {
    return cvPathOwner(v) ? v : null;
  }

  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!supabaseHost || url.hostname.toLowerCase() !== supabaseHost.toLowerCase()) return null;
  const m = STORAGE_URL_PATH_RE.exec(url.pathname);
  if (!m) return null;
  let path: string;
  try {
    path = decodeURIComponent(m[1]);
  } catch {
    return null;
  }
  return cvPathOwner(path) ? path : null;
}

/**
 * Normalise a CV reference submitted by a candidate for their own profile.
 * Returns `{ ok: true, path }` (null = clear) or `{ ok: false }` when the
 * reference is malformed or points at another user's object.
 */
export function normalizeOwnCvReference(
  value: unknown,
  ownerUserId: string,
  supabaseHost?: string | null
): { ok: true; path: string | null } | { ok: false } {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    return { ok: true, path: null };
  }
  const path = extractCvObjectPath(value, supabaseHost);
  if (!path) return { ok: false };
  if (cvPathOwner(path) !== ownerUserId.toLowerCase()) return { ok: false };
  return { ok: true, path };
}

export interface CvViewer {
  role: string;
  userId: string;
  /** DB-resolved company of a COMPANY viewer (null when none). */
  companyId?: string | null;
}

export interface ApplicationCvContext {
  candidateUserId: string;
  jobCompanyId: string;
}

/**
 * May `viewer` access the CV attached to an application?
 *  - the candidate who applied,
 *  - the company that owns the job the application targets,
 *  - administrators.
 */
export function canAccessApplicationCv(viewer: CvViewer, ctx: ApplicationCvContext): boolean {
  if (viewer.role === "ADMIN") return true;
  if (viewer.role === "CANDIDATE") return viewer.userId === ctx.candidateUserId;
  if (viewer.role === "COMPANY") {
    return !!viewer.companyId && viewer.companyId === ctx.jobCompanyId;
  }
  return false;
}

export function supabaseHostFromEnv(env: Record<string, string | undefined> = process.env): string | null {
  try {
    return env.NEXT_PUBLIC_SUPABASE_URL ? new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
  } catch {
    return null;
  }
}

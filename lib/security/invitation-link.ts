/**
 * Company invitation links (Phase 3 / H3).
 *
 * The raw invitation token is a bearer secret: whoever holds it can create a
 * COMPANY account. It travels in the URL FRAGMENT (`#token=…`), never the
 * query string, because browsers do not send fragments to the server — so the
 * token cannot appear in Vercel/CDN access logs, proxy logs or `Referer`
 * headers. The onboarding page reads it client-side, removes it from the
 * address bar, and sends it only in POST bodies (validation + registration).
 */

export const INVITATION_PATH = "/onboarding/company";

export function buildInvitationLink(baseUrl: string, rawToken: string): string {
  const link = new URL(INVITATION_PATH, baseUrl);
  link.search = "";
  link.hash = new URLSearchParams({ token: rawToken }).toString();
  return link.href;
}

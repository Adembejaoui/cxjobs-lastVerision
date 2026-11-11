/**
 * Client-safe helpers for one-time-token links (no Node APIs).
 *
 * Links carry the token in the URL fragment (`#token=…`) so it is never sent
 * to the server in the GET request. A legacy `?token=` is still accepted so
 * any link generated before this change keeps working.
 */
const TOKEN_RE = /^[0-9a-f]{64}$/;

export function extractOneTimeToken(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return "";
  }
  const fromHash = new URLSearchParams(url.hash.replace(/^#/, "")).get("token");
  const candidate = fromHash ?? url.searchParams.get("token") ?? "";
  return TOKEN_RE.test(candidate) ? candidate : "";
}

/** The same URL with any token removed from both query and fragment. */
export function stripOneTimeToken(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  if (!url.searchParams.has("token") && !hashParams.has("token")) return null;
  url.searchParams.delete("token");
  return url.pathname + url.search;
}

/**
 * Absolute base URL of the public site, for canonical links, the sitemap,
 * robots.txt and structured data. Configuration only (never the request Host
 * header, which a client controls).
 */
export function siteUrl(): string {
  const raw = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "http://localhost:3000";
  }
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

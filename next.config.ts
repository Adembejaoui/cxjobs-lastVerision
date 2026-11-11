import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/**
 * Supabase hosts allowed for next/image: the production project plus the
 * project configured for this build (Preview/staging may use another one).
 */
const PRODUCTION_SUPABASE_HOST = "hvbbactmgfhecqbetlhg.supabase.co";
function trustedSupabaseHosts(): string[] {
  const hosts = new Set<string>([PRODUCTION_SUPABASE_HOST]);
  try {
    const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (configured) {
      const { protocol, hostname } = new URL(configured);
      if (protocol === "https:" && hostname.endsWith(".supabase.co")) hosts.add(hostname);
    }
  } catch {
    // Malformed env value: fall back to the production host only.
  }
  return [...hosts];
}

/**
 * Full page CSP, sent as Content-Security-Policy-Report-Only (launch plan A3
 * / audit F-16). Browsers log violations to the console without blocking, so
 * the policy can be verified on staging before it is enforced. It cannot use
 * nonces: those would force every page to render per request (A10).
 */
function pageCspReportOnly(): string {
  const supabase = trustedSupabaseHosts().map((h) => `https://${h}`).join(" ");
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase} https://lh3.googleusercontent.com https://images.unsplash.com`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabase}${dev ? " ws:" : ""}`,
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
  ].join("; ");
}

const nextConfig: NextConfig = {
  // pdf.js (ESM, dynamic worker import) is loaded from node_modules at runtime
  // instead of being bundled into the server build.
  serverExternalPackages: ["pdfjs-dist"],
  // pdf.js is loaded at runtime by absolute path inside a worker thread
  // (lib/server/pdf-text-worker.ts), which static tracing cannot see.
  outputFileTracingIncludes: {
    "/api/onboarding/cv-parse": ["./node_modules/pdfjs-dist/legacy/build/*.mjs"],
  },
  // Cache life profiles for server-side fetch caching (Next.js 16+)
  cacheLife: {
    default: { stale: 900, revalidate: 300, expire: 86400 },
    hours: { stale: 3600, revalidate: 1800, expire: 86400 },
    days: { stale: 86400, revalidate: 43200, expire: 604800 },
    weeks: { stale: 604800, revalidate: 259200, expire: 2592000 },
    max: { stale: 31536000, revalidate: 15768000, expire: 31536000 },
  },
  // Response headers for security
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
              "style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data: https:; " +
              "connect-src 'self' https:; " +
              "frame-ancestors 'none'; " +
              "base-uri 'self'; " +
              "form-action 'self'",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            // Was "strict-origin-when-x-origin", which is not a valid token
            // and was therefore ignored by browsers.
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        // Pages only. /api/* keeps its stricter CSP above: when several rules
        // set the same header, the later rule wins, so this one must not match
        // API routes.
        source: "/((?!api/).*)",
        headers: [
          // Clickjacking protection for PAGES (previously only /api/* had it).
          // The app never frames its own routes.
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            // Deliberately minimal page CSP: only directives that cannot break
            // Next.js inline bootstrapping or the OAuth flow. `form-action` is
            // omitted on purpose: browsers apply it to the redirect that
            // follows the Google sign-in form POST.
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
          {
            // Staged rollout of the full policy (see pageCspReportOnly).
            key: "Content-Security-Policy-Report-Only",
            value: pageCspReportOnly(),
          },
        ],
      },
    ];
  },
  // Image domains for next/image component
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      // Only THIS application's Supabase project(s) — never `*.supabase.co`,
      // which would let any third-party project's files through the image
      // optimizer. Public image buckets only (the private `cv` bucket is
      // never rendered via next/image).
      ...trustedSupabaseHosts().map((hostname) => ({
        protocol: 'https' as const,
        hostname,
        pathname: '/storage/v1/object/public/**',
      })),
      // Google OAuth avatars. next-auth stores these in users.image and they
      // are rendered by next/image in the navbar and dashboards. Without this
      // a single Google-signed-in user 500s every page.
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh4.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh5.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh6.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
};

export default bundleAnalyzer(nextConfig);

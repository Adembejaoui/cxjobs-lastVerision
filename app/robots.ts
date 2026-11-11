import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/site-url";

/**
 * robots.txt (launch plan U3). Public pages are crawlable; private areas,
 * APIs, auth flows and the signed-in job preview are not.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/onboarding",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
        "/jobs/*/apply",
        "/jobs/*/preview",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}

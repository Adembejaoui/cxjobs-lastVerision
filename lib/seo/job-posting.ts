/**
 * schema.org JobPosting structured data (launch plan U3).
 *
 * Only called for jobs that are publicly visible (the public job page 404s
 * for anything else). Fields the platform does not store are omitted rather
 * than guessed: no country, no salary unit (so no baseSalary), no
 * invented employment details.
 */
import { absoluteUrl } from "./site-url";

export interface JobPostingSource {
  title: string;
  slug: string;
  description: string | null;
  contractType: string;
  isRemote: boolean;
  customLocation: string | null;
  applicationType: string;
  publishedAt: Date | string | null;
  createdAt: Date | string;
  expiresAt?: Date | string | null;
  company: { name: string; slug: string; website: string | null; logoUrl: string | null; location: string | null };
}

const EMPLOYMENT_TYPE: Record<string, string> = {
  CDI: "FULL_TIME",
  CDD: "TEMPORARY",
  FREELANCE: "CONTRACTOR",
  INTERNSHIP: "INTERN",
  PART_TIME: "PART_TIME",
};

const iso = (d: Date | string | null | undefined) => {
  if (!d) return undefined;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? undefined : t.toISOString();
};

export function buildJobPostingJsonLd(job: JobPostingSource): Record<string, unknown> {
  const locality = job.customLocation?.trim() || job.company.location?.trim() || undefined;
  const description = job.description?.trim() || `${job.title} at ${job.company.name}`;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description,
    datePosted: iso(job.publishedAt) ?? iso(job.createdAt),
    url: absoluteUrl(`/jobs/${job.slug}`),
    hiringOrganization: {
      "@type": "Organization",
      name: job.company.name,
      url: absoluteUrl(`/companies/${job.company.slug}`),
      ...(job.company.website ? { sameAs: job.company.website } : {}),
      ...(job.company.logoUrl ? { logo: job.company.logoUrl } : {}),
    },
    directApply: job.applicationType === "INTERNAL",
  };
  const validThrough = iso(job.expiresAt);
  if (validThrough) data.validThrough = validThrough;
  const employmentType = EMPLOYMENT_TYPE[job.contractType];
  if (employmentType) data.employmentType = employmentType;
  if (job.isRemote) data.jobLocationType = "TELECOMMUTE";
  if (locality && locality.toLowerCase() !== "remote") {
    data.jobLocation = { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: locality } };
  }
  return data;
}

/**
 * JSON for a <script type="application/ld+json"> element. `<`, `>` and `&`
 * are escaped so job text can never close the script element (XSS).
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (ch) => JSON_LD_ESCAPES[ch] ?? ch);
}

const JSON_LD_ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

import { z } from "zod";

// ==================== Job Offer Schemas ====================

export const contractTypeSchema = z.enum(["CDI", "CIVP", "KARAMA", "FREELANCE"]);

export const employmentTypeSchema = z.enum(["FULL_TIME", "PART_TIME"]);

export const languageLevelSchema = z.enum(["REQUIRED", "PREFERRED", "NICE_TO_HAVE"]);

export const applicationMethodSchema = z.enum(["INTERNAL", "EXTERNAL"]);

export const jobStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED", "CLOSED", "EXPIRED"]);

export const activityTypeSchema = z.enum([
  "CUSTOMER_SERVICE",
  "SALES_LEAD_GENERATION",
  "TECHNICAL_IT_SUPPORT",
  "DEBT_COLLECTION_LITIGATION",
  "BACK_OFFICE_DIGITAL_SERVICES",
  "SURVEYS_MARKET_RESEARCH",
  "OTHER",
]);

// Job language input schema
const jobLanguageInputSchema = z.object({
  language: z.string().min(1, "Language is required"),
  level: languageLevelSchema.optional().default("REQUIRED"),
});

export const createJobOfferSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(100),
  slug: z
    .string()
    .min(5, "Slug must be at least 5 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .optional(),
  description: z.string().optional(),
  customLocation: z.string().optional(),
  contractType: contractTypeSchema.optional().default("CDI"),
  isRemote: z.boolean().optional().default(false),
  isHybrid: z.boolean().optional().default(false),
  employmentType: employmentTypeSchema.optional(),
  activityType: activityTypeSchema.optional().default("CUSTOMER_SERVICE"),
  activityCustom: z.string().max(100).optional().nullable(),
  salary: z.string().optional(),
  salaryMin: z.coerce.number().int().positive().optional().nullable(),
  salaryMax: z.coerce.number().int().positive().optional().nullable(),
  salaryCurrency: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  benefitIds: z.array(z.string().uuid()).optional(),
  languages: z.array(jobLanguageInputSchema).optional(),
  technicalTools: z.array(z.string()).optional(),
  softSkills: z.array(z.string()).optional(),
  status: jobStatusSchema.optional().default("DRAFT"),
  applicationType: applicationMethodSchema.optional().default("INTERNAL"),
  externalApplyUrl: z.string().url("Please enter a valid URL").optional().nullable(),
   expiresAt: z
     .preprocess(
       (val) => (val && typeof val === "string" && val.trim() ? new Date(val) : null),
       z.date().nullable().optional()
     ),
 }).refine((data) => {
  if (data.activityType === "OTHER" && (!data.activityCustom || data.activityCustom.trim().length === 0)) {
    return false;
  }
  return true;
}, {
  message: "Custom activity name is required when activity type is 'Other'",
  path: ["activityCustom"],
}).refine((data) => {
  if (data.applicationType === "EXTERNAL") {
    return !!data.externalApplyUrl && data.externalApplyUrl.length > 0;
  }
  return true;
}, {
  message: "External apply URL is required when application type is EXTERNAL",
  path: ["externalApplyUrl"],
}).refine((data) => {
  if (data.expiresAt && data.expiresAt <= new Date()) {
    return false;
  }
  return true;
}, {
  message: "Expiration date must be in the future",
  path: ["expiresAt"],
});

// Base schema for update (without refinement)
const updateJobOfferBaseSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(100).optional(),
  slug: z
    .string()
    .min(5, "Slug must be at least 5 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .optional(),
  description: z.string().optional(),
  customLocation: z.string().optional(),
  contractType: contractTypeSchema.optional(),
  isRemote: z.boolean().optional(),
  isHybrid: z.boolean().optional(),
  employmentType: employmentTypeSchema.optional(),
  activityType: activityTypeSchema.optional(),
  activityCustom: z.string().max(100).optional().nullable(),
  salary: z.string().optional(),
  salaryMin: z.coerce.number().int().positive().optional().nullable(),
  salaryMax: z.coerce.number().int().positive().optional().nullable(),
  salaryCurrency: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  benefitIds: z.array(z.string().uuid()).optional(),
  languages: z.array(jobLanguageInputSchema).optional(),
  technicalTools: z.array(z.string()).optional(),
  softSkills: z.array(z.string()).optional(),
  status: jobStatusSchema.optional(),
  applicationType: applicationMethodSchema.optional().default("INTERNAL"),
   externalApplyUrl: z.string().url("Please enter a valid URL").optional().nullable(),
   expiresAt: z
     .preprocess(
       (val) => (val && typeof val === "string" && val.trim() ? new Date(val) : null),
       z.date().nullable().optional()
     ),
   closedAt: z.coerce.date().optional().nullable(),
}).refine((data) => {
  if (data.activityType === "OTHER" && (!data.activityCustom || data.activityCustom.trim().length === 0)) {
    return false;
  }
  return true;
}, {
  message: "Custom activity name is required when activity type is 'Other'",
  path: ["activityCustom"],
}).refine((data) => {
  if (data.applicationType === "EXTERNAL") {
    return !!data.externalApplyUrl && data.externalApplyUrl.length > 0;
  }
  return true;
}, {
  message: "External apply URL is required when application type is EXTERNAL",
  path: ["externalApplyUrl"],
}).refine((data) => {
  if (data.expiresAt && data.expiresAt <= new Date()) {
    return false;
  }
  return true;
}, {
  message: "Expiration date must be in the future",
  path: ["expiresAt"],
});

export const updateJobOfferSchema = updateJobOfferBaseSchema;

// ==================== Lifecycle Transition Validation ====================

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["CLOSED", "ARCHIVED"],
  CLOSED: ["ARCHIVED"],
  ARCHIVED: ["DRAFT"],
  EXPIRED: [],
};

export function isValidStatusTransition(fromStatus: string, toStatus: string): boolean {
  const allowed = VALID_TRANSITIONS[fromStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus);
}

export function getInvalidTransitionError(fromStatus: string, toStatus: string): string {
  const allowed = VALID_TRANSITIONS[fromStatus] ?? [];
  return `Invalid status transition from ${fromStatus} to ${toStatus}. Allowed transitions: ${allowed.length > 0 ? allowed.join(", ") : "none"}`;
}

// ==================== Job URL Scraping Schema ====================

export const scrapeJobUrlSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
  language: z.enum(["en", "fr"]).default("en").optional(),
});

export const jobOfferFilterSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(10),
  companyId: z.string().uuid().optional(),
  status: jobStatusSchema.optional(),
  contractType: contractTypeSchema.optional(),
  employmentType: employmentTypeSchema.optional(),
  activityType: activityTypeSchema.optional(),
  location: z.string().optional(),
  search: z.string().optional(),
});

// ==================== Application Schemas ====================

export const applicationStatusSchema = z.enum([
  "NOUVEAU",
  "EN_COURS_EXAMEN",
  "ENTRETIEN",
  "EMBAUCHES",
  "REFUSE",
]);

export const createApplicationSchema = z.object({
  jobOfferId: z.string().uuid("Invalid job offer ID"),
  coverLetter: z.string().max(2000, "Cover letter must be under 2000 characters").optional().default(""),
});

export const updateApplicationSchema = z.object({
  status: applicationStatusSchema.optional(),
  notes: z.string().max(2000).optional(),
  isSaved: z.boolean().optional(),
});

export const toggleSavedSchema = z.object({
  isSaved: z.boolean(),
});

// ==================== Types ====================

export type CreateJobOfferInput = z.infer<typeof createJobOfferSchema>;
export type UpdateJobOfferInput = z.infer<typeof updateJobOfferSchema>;
export type JobOfferFilterInput = z.infer<typeof jobOfferFilterSchema>;
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type ApplicationMethod = z.infer<typeof applicationMethodSchema>;
export type ActivityType = z.infer<typeof activityTypeSchema>;

export type ScrapeJobUrlInput = z.infer<typeof scrapeJobUrlSchema>;

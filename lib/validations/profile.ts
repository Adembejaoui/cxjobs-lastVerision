import { z } from "zod";

// ==================== Candidate Schemas ====================

export const jobRoleTargetSchema = z.enum([
  "CALL_CENTER",
  "SALES",
  "TECH_SUPPORT",
  "CUSTOMER_SERVICE",
  "ADMIN",
  "GENERAL"
]);

export const workModeSchema = z.enum(["ONSITE", "REMOTE", "HYBRID"]);

export const shiftTypeSchema = z.enum(["DAY", "NIGHT", "FLEXIBLE", "ROTATION"]);

export const skillLevelSchema = z.string();

export const skillSchema = z.object({
  name: z.string().min(1, "Skill name is required"),
  level: skillLevelSchema.optional(),
});

export const languageLevelSchema = z.string();

export const languageSchema = z.object({
  name: z.string().min(1, "Language name is required"),
  level: languageLevelSchema.optional(),
});

export const experienceSchema = z.object({
  title: z.string().min(1, "Job title is required"),
  company: z.string().min(1, "Company name is required"),
  location: z.string().optional(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()).optional().nullable(),
  current: z.boolean().optional().default(false),
  description: z.string().optional(),
});

export const educationSchema = z.object({
  institution: z.string().min(1, "Institution name is required"),
  degree: z.string().min(1, "Degree is required"),
  field: z.string().optional(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()).optional().nullable(),
});

export const candidateProfileSchema = z.object({
  targetJobRole: jobRoleTargetSchema.optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  headline: z.string().optional().nullable(),
  summary: z.string().max(2000, "Summary must be 2000 characters or less").optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  resumeUrl: z.string().optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
  preferredJobTypes: z.array(z.string()).optional().nullable(),
  workMode: workModeSchema.optional().nullable(),
  shiftType: shiftTypeSchema.optional().nullable(),
  salaryExpectation: z.number().optional().nullable(),
  skills: z.array(skillSchema).optional().nullable(),
  experiences: z.array(experienceSchema).optional().nullable(),
  languages: z.array(languageSchema).optional().nullable(),
  education: z.array(educationSchema).optional().nullable(),
});

// ==================== Company Schemas ====================

export const companySizeSchema = z.enum(["STARTUP", "SMALL", "MEDIUM", "LARGE", "ENTERPRISE"]);

export const subscriptionPlanSchema = z.enum(["ESSENTIAL", "GROW", "PREMIUM"]);

export const benefitCategorySchema = z.enum([
  "HEALTH",
  "FINANCIAL",
  "WORK_ENVIRONMENT",
  "CAREER_GROWTH",
  "WORK_LIFE_BALANCE",
  "OTHER",
]);

export const benefitScopeSchema = z.enum(["CORE", "ADDITIONAL"]);

// Benefit item schema for company benefits management
export const benefitItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Benefit name is required"),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  category: benefitCategorySchema.optional().default("OTHER"),
  scope: benefitScopeSchema.optional().default("ADDITIONAL"),
});

// Culture item schema with optional image support
export const cultureItemSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().default(""),
  imageUrl: z.string().optional().nullable(),
});

export const companyProfileSchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  description: z.string().max(5000, "Description must be 5000 characters or less").optional().nullable(),
  mission: z.string().max(2000, "Mission must be 2000 characters or less").optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  coverImageUrl: z.string().optional().nullable(),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")).nullable(),
  industry: z.string().optional().nullable(),
  companySize: companySizeSchema.optional().nullable(),
  location: z.string().optional().nullable(),
  foundedYear: z.number().min(1800).max(new Date().getFullYear()).optional().nullable(),
  isRemoteFriendly: z.boolean().optional().nullable(),
  isHybridFriendly: z.boolean().optional().nullable(),
  benefits: z.array(benefitItemSchema).optional().nullable(),
  culture: z.array(cultureItemSchema).optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
  twitterUrl: z.string().optional().nullable(),
  facebookUrl: z.string().optional().nullable(),
});

// ==================== Types ====================

export type SkillInput = z.infer<typeof skillSchema>;
export type LanguageInput = z.infer<typeof languageSchema>;
export type ExperienceInput = z.infer<typeof experienceSchema>;
export type EducationInput = z.infer<typeof educationSchema>;
export type CultureItemInput = z.infer<typeof cultureItemSchema>;
export type CandidateProfileInput = z.infer<typeof candidateProfileSchema>;
export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

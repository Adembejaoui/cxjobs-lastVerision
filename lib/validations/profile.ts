import { z } from "zod";
import { getRequiredFields } from "../job-role-config";
import { linkedinUrlSchema } from "./linkedin";

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

// Candidate gender has exactly two valid values, stored exactly as written:
// "Male" or "Female". Validation is an exact, case-sensitive match with no
// lowercasing or capitalization, so "male"/"female", "Prefer not to say" and
// every other value are rejected and never written.
export const genderSchema = z.enum(["Male", "Female"], {
  error: "Please select Male or Female.",
});

/**
 * Gender for `candidateProfileSchema`.
 *
 * Surrounding whitespace is trimmed (matching the project's handling of other
 * free-text input), but the value is otherwise compared verbatim: there is no
 * case folding, so "Male" and "Female" are the only accepted values and are
 * stored exactly as typed. "", whitespace, "male" and "Prefer not to say" are
 * rejected rather than stored.
 *
 * It stays optional here: `POST /api/profile` is also the endpoint for unrelated
 * partial updates (uploading a CV, changing a preference), and an omitted key
 * must not fail or clear anything. Requiredness is enforced against the FINAL
 * persisted state by `getCandidateRequiredFieldErrors`, which every candidate
 * save and every onboarding completion runs.
 */
const candidateGenderSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  genderSchema.nullish()
);

/**
 * Date of birth for `candidateProfileSchema`, stored as a `Date` to match the
 * Prisma `DateTime?` column and the existing storage convention.
 *
 * `undefined` (key absent) is passed through so an unrelated partial update
 * leaves the stored value untouched; `null` and `""` map to `null` (explicit
 * clear, rejected later when the field is required); and an unparseable value is
 * passed through unchanged so it is REJECTED instead of silently becoming null.
 */
const candidateDateOfBirthSchema = z.preprocess(
  (value) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    if (value instanceof Date) return value;
    if (typeof value !== "string" && typeof value !== "number") return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  },
  z.date({ error: "Please enter a valid date of birth." }).nullable().optional()
);

export const skillLevelSchema = z.string();

export const skillSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Skill name is required"),
  level: skillLevelSchema.optional(),
});

export const languageLevelSchema = z.string();

export const languageSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Language name is required"),
  level: languageLevelSchema.optional(),
});

export const experienceSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Job title is required"),
  company: z.string().min(1, "Company name is required"),
  location: z.string().optional(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()).optional().nullable(),
  current: z.boolean().optional().default(false),
  description: z.string().optional(),
});

export const educationSchema = z.object({
  id: z.string().optional(),
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
  linkedinUrl: linkedinUrlSchema,
  preferredJobTypes: z.array(z.string()).optional().nullable(),
  workMode: workModeSchema.optional().nullable(),
  shiftType: shiftTypeSchema.optional().nullable(),
  dateOfBirth: candidateDateOfBirthSchema,
  gender: candidateGenderSchema,
  salaryExpectation: z.number().optional().nullable(),
  skills: z.array(skillSchema).optional().nullable(),
  experiences: z.array(experienceSchema).optional().nullable(),
  languages: z.array(languageSchema).optional().nullable(),
  education: z.array(educationSchema).optional().nullable(),
});

// ==================== Candidate Onboarding Completion ====================

/**
 * Server-side completion requirements for candidate onboarding.
 *
 * `/api/profile` is also the ordinary profile-editing endpoint, so
 * `candidateProfileSchema` above must stay permissive for partial updates. These
 * requirements are therefore NOT enforced by that schema: they are applied only
 * at the moment the server would flip `User.isOnboarded` to true, against the
 * FINAL candidate state (persisted row merged with the incoming update) rather
 * than against the request body. A client cannot reach the onboarded state by
 * posting `{}` or `{ targetJobRole: "SALES" }`.
 *
 * Role-dependent requirements are never hardcoded here: they come from
 * `requiredFields` in `lib/job-role-config.ts`, so `languages`, `experience` and
 * `education` are mandatory only for the roles that declare them.
 */

/** Normalized candidate state that onboarding completion is checked against. */
export interface CandidateOnboardingState {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  location?: string | null;
  targetJobRole?: string | null;
  gender?: string | null;
  dateOfBirth?: Date | string | null;
  skills?: ReadonlyArray<{ name?: string | null } | null> | null;
  languages?: ReadonlyArray<{ name?: string | null } | null> | null;
  experiences?: ReadonlyArray<
    { title?: string | null; company?: string | null } | null
  > | null;
  education?: ReadonlyArray<{ school?: string | null; degree?: string | null } | null> | null;
}

/** Persisted candidate shape (Prisma `Candidate` plus its relations). */
export interface PersistedCandidateOnboardingState {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  location?: string | null;
  targetJobRole?: string | null;
  gender?: string | null;
  dateOfBirth?: Date | string | null;
  skills?: ReadonlyArray<{ name?: string | null }> | null;
  languages?: ReadonlyArray<{ name?: string | null }> | null;
  experiences?: ReadonlyArray<{ title?: string | null; company?: string | null }> | null;
  education?: ReadonlyArray<{ school?: string | null; degree?: string | null }> | null;
}

/** Candidate profile update as accepted by `candidateProfileSchema`. */
export type CandidateProfileUpdate = z.infer<typeof candidateProfileSchema>;

export type CandidateOnboardingErrors = Record<string, string>;

function isBlankValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim().length === 0)
  );
}

function hasValidNameEntries(
  entries: ReadonlyArray<{ name?: string | null } | null> | null | undefined
): boolean {
  return Array.isArray(entries) && entries.some((entry) => !isBlankValue(entry?.name));
}

/**
 * A gender value counts only on an exact, case-sensitive match with "Male" or
 * "Female". No case folding: a lowercase "male"/"female" is not a valid gender.
 */
function hasValidGender(gender: string | null | undefined): boolean {
  if (typeof gender !== "string") return false;
  const value = gender.trim();
  return value === "Male" || value === "Female";
}

/** A date of birth counts only when it is present and a real calendar date. */
function hasValidDateOfBirth(value: Date | string | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && value.trim().length === 0) return false;
  const parsed = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(parsed.getTime());
}

/**
 * Requirements that must hold for the FINAL candidate state on every candidate
 * profile save and on onboarding completion: gender and date of birth are both
 * required, and gender accepts only "Male"/"Female".
 *
 * This is intentionally separate from `getCandidateOnboardingErrors`, which
 * additionally covers the one-time onboarding fields. Splitting them lets an
 * ordinary profile edit enforce the always-required pair while remaining free of
 * the onboarding-only fields.
 */
export function getCandidateRequiredFieldErrors(
  state: CandidateOnboardingState | null | undefined
): CandidateOnboardingErrors {
  const errors: CandidateOnboardingErrors = {};
  const candidate = state ?? {};

  if (!hasValidGender(candidate.gender)) {
    errors.gender = "Please select Male or Female.";
  }
  if (!hasValidDateOfBirth(candidate.dateOfBirth)) {
    errors.dateOfBirth = "Date of birth is required.";
  }

  return errors;
}

/**
 * Resolves whether the final candidate state satisfies onboarding completion.
 * Returns one specific, human-readable message per invalid field; an empty
 * object means the candidate may be marked as onboarded.
 */
export function getCandidateOnboardingErrors(
  state: CandidateOnboardingState | null | undefined
): CandidateOnboardingErrors {
  const errors: CandidateOnboardingErrors = {};
  const candidate = state ?? {};

  // Always-required pair, shared with the profile-save path so both enforce an
  // identical rule instead of drifting apart.
  Object.assign(errors, getCandidateRequiredFieldErrors(candidate));

  if (isBlankValue(candidate.firstName)) {
    errors.firstName = "First name is required.";
  }
  if (isBlankValue(candidate.lastName)) {
    errors.lastName = "Last name is required.";
  }
  if (isBlankValue(candidate.phone)) {
    errors.phone = "Phone number is required.";
  }
  if (isBlankValue(candidate.location)) {
    errors.location = "Location is required.";
  }

  const roleId = isBlankValue(candidate.targetJobRole) ? "" : String(candidate.targetJobRole);
  if (!roleId) {
    errors.targetJobRole = "Please select a target job role.";
  }

  if (!hasValidNameEntries(candidate.skills)) {
    errors.skills = "Please add at least one skill.";
  }

  // Role-dependent requirements, sourced from the shared job role config.
  const roleRequiredFields = roleId ? getRequiredFields(roleId) : [];

  if (roleRequiredFields.includes("languages") && !hasValidNameEntries(candidate.languages)) {
    errors.languages = "Please add at least one language.";
  }

  if (
    roleRequiredFields.includes("experience") &&
    !(
      Array.isArray(candidate.experiences) &&
      candidate.experiences.some(
        (entry) => !isBlankValue(entry?.title) && !isBlankValue(entry?.company)
      )
    )
  ) {
    errors.experiences = "Please add at least one experience.";
  }

  if (
    roleRequiredFields.includes("education") &&
    !(
      Array.isArray(candidate.education) &&
      candidate.education.some(
        (entry) => !isBlankValue(entry?.school) && !isBlankValue(entry?.degree)
      )
    )
  ) {
    errors.education = "Please add at least one education entry.";
  }

  return errors;
}

/**
 * Builds the candidate state that WILL be persisted after applying `update` on
 * top of `existing`, so completion is validated against the resulting row rather
 * than against the (possibly partial) request body.
 *
 * The override rules mirror exactly what the route does with the same data:
 *  - a scalar key present in the update overrides the persisted value (including
 *    an explicit `null`, which clears the column);
 *  - an absent or `undefined` scalar key leaves the persisted value untouched;
 *  - a relation is replaced whenever the update carries the key, and is cleared
 *    to an empty list otherwise, because the route synchronizes relations with
 *    `submitted ?? []` and therefore deletes every row when the key is omitted.
 *    Validating the same rule is what keeps `isOnboarded = true` impossible for a
 *    candidate whose relations were just wiped.
 */
export function buildCandidateOnboardingState(
  existing: PersistedCandidateOnboardingState | null | undefined,
  update: CandidateProfileUpdate
): CandidateOnboardingState {
  const persisted = existing ?? {};

  const pick = (
    key: "firstName" | "lastName" | "phone" | "location" | "targetJobRole" | "gender" | "dateOfBirth"
  ) => {
    const submitted = update[key];
    return submitted === undefined ? (persisted[key] ?? null) : (submitted ?? null);
  };

  const pickRelation = <K extends "skills" | "languages" | "experiences" | "education">(key: K) =>
    update[key] ?? [];

  return {
    firstName: pick("firstName") as string | null,
    lastName: pick("lastName") as string | null,
    phone: pick("phone") as string | null,
    location: pick("location") as string | null,
    targetJobRole: pick("targetJobRole") as string | null,
    gender: pick("gender") as string | null,
    dateOfBirth: pick("dateOfBirth") as Date | null,
    skills: pickRelation("skills"),
    languages: pickRelation("languages"),
    experiences: pickRelation("experiences"),
    education: pickRelation("education").map((entry) => ({
      school: entry?.institution,
      degree: entry?.degree,
    })),
  };
}

/** Raised when a candidate tries to complete onboarding with an invalid profile. */
export class CandidateOnboardingIncompleteError extends Error {
  readonly errors: CandidateOnboardingErrors;

  constructor(errors: CandidateOnboardingErrors) {
    super("Candidate onboarding profile is incomplete");
    this.name = "CandidateOnboardingIncompleteError";
    this.errors = errors;
  }
}

// ==================== Company Schemas ====================

export const companySizeSchema = z.string();

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

// Benefit item schema for company benefits management.
// `id` is only ever sent for a benefit that already exists in the database;
// newly added rows are submitted without one. The server treats a supplied id
// as a row it must verify belongs to the authenticated company.
export const benefitItemSchema = z.object({
  id: z.uuid().optional(),
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
  icon: z.string().optional().nullable(),
});

export const companyProfileSchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  description: z.string().max(5000, "Description must be 5000 characters or less").optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  coverImageUrl: z.string().optional().nullable(),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")).nullable(),
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

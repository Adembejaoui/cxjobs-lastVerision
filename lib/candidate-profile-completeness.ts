/**
 * "Completed profile" rule for applying to a job (launch plan A1).
 * Client-safe: the apply page shows the same result the API enforces.
 *
 * Required: phone and location (recruiters cannot contact or place a
 * candidate without them), plus at least half of the profile sections.
 */

export interface CandidateCompletenessInput {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  location?: string | null;
  headline?: string | null;
  resumeUrl?: string | null;
  skillsCount: number;
  languagesCount: number;
  experiencesCount: number;
}

export const REQUIRED_PROFILE_FIELDS = ["phone", "location"] as const;
export const MIN_PROFILE_COMPLETION = 50;

export interface CandidateCompleteness {
  percent: number;
  missingRequired: Array<(typeof REQUIRED_PROFILE_FIELDS)[number]>;
  canApply: boolean;
}

const filled = (v: string | null | undefined) => typeof v === "string" && v.trim().length > 0;

export function candidateCompleteness(c: CandidateCompletenessInput): CandidateCompleteness {
  const checks = [
    filled(c.firstName),
    filled(c.lastName),
    filled(c.phone),
    filled(c.location),
    filled(c.headline),
    filled(c.resumeUrl),
    c.skillsCount > 0,
    c.languagesCount > 0,
    c.experiencesCount > 0,
  ];
  const percent = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const missingRequired = REQUIRED_PROFILE_FIELDS.filter((f) => !filled(c[f]));
  return { percent, missingRequired, canApply: missingRequired.length === 0 && percent >= MIN_PROFILE_COMPLETION };
}

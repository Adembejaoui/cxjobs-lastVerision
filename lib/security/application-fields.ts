/**
 * Field-level access control for Application records.
 *
 * `notes` holds recruiter-internal assessments and must never reach the
 * candidate. Candidate-facing queries use this explicit allow-list instead of
 * `include` (which returns every scalar column, notes included), so a column
 * added later is hidden from candidates by default.
 */
export const CANDIDATE_APPLICATION_SCALARS = {
  id: true,
  candidateId: true,
  jobOfferId: true,
  coverLetter: true,
  cvUrl: true,
  status: true,
  isSaved: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Recruiter-only Application columns. */
export const RECRUITER_ONLY_APPLICATION_FIELDS = ["notes"] as const;

/**
 * Defence in depth for serializers: removes recruiter-only fields from any
 * application-shaped object (or array of them) before it is returned to a
 * candidate.
 */
export function stripRecruiterOnlyFields<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripRecruiterOnlyFields(v)) as T;
  if (value && typeof value === "object") {
    const copy = { ...(value as Record<string, unknown>) };
    for (const f of RECRUITER_ONLY_APPLICATION_FIELDS) delete copy[f];
    return copy as T;
  }
  return value;
}

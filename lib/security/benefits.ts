/**
 * Benefits (`CompanyBenefit`) are tenant-owned: each row has a `companyId`.
 * A job offer may only reference benefits of the company that owns the job.
 * Client-supplied benefit IDs are never trusted.
 */

export interface BenefitLookup {
  companyBenefit: {
    findMany(args: {
      where: { id: { in: string[] }; companyId: string };
      select: { id: true };
    }): Promise<Array<{ id: string }>>;
  };
}

export type BenefitValidation =
  | { ok: true; benefitIds: string[] }
  | { ok: false; invalidIds: string[] };

/**
 * Returns the de-duplicated list when EVERY id exists and belongs to
 * `companyId`; otherwise the offending ids. Run it with the same transaction
 * client that performs the write so check and use are atomic.
 */
export async function validateBenefitOwnership(
  db: BenefitLookup,
  companyId: string,
  benefitIds: readonly string[]
): Promise<BenefitValidation> {
  const unique = Array.from(new Set(benefitIds));
  if (unique.length === 0) return { ok: true, benefitIds: [] };

  const owned = await db.companyBenefit.findMany({
    where: { id: { in: unique }, companyId },
    select: { id: true },
  });
  const ownedSet = new Set(owned.map((b) => b.id));
  const invalidIds = unique.filter((id) => !ownedSet.has(id));
  return invalidIds.length === 0 ? { ok: true, benefitIds: unique } : { ok: false, invalidIds };
}

/**
 * Job-offer columns a COMPANY may not set directly. `publishedAt`/`closedAt`
 * are derived from status transitions server-side; `featured`/`highlight`
 * are platform-controlled promotion flags.
 */
export const COMPANY_PROTECTED_JOB_FIELDS = ["featured", "highlight", "publishedAt", "closedAt"] as const;

export function stripCompanyProtectedJobFields<T extends Record<string, unknown>>(data: T): T {
  const copy = { ...data };
  for (const f of COMPANY_PROTECTED_JOB_FIELDS) delete copy[f];
  return copy;
}

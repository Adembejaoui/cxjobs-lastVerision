/**
 * Company activity and public job visibility (Phase 6A, audit finding F-04).
 *
 * The existing suspension model is reused, not replaced:
 *   - A company is owned by exactly one user (`companies.userId` is unique).
 *   - An administrator suspends a company by setting that user's
 *     `isActive = false` (PATCH /api/admin/users/[id]), which also bumps
 *     `sessionVersion` so every session of that account is revoked.
 *     Reactivation is the same endpoint with `isActive = true`.
 *   - `companies.deletedAt` is a soft-delete marker. Nothing sets it today,
 *     but it is honoured so a future deletion flow is covered automatically.
 *
 * A company is "active" (eligible for any public activity) only when it is
 * not soft-deleted AND its owning account is active. These conditions are
 * expressed as Prisma `where` fragments so the database filters the rows:
 * the suspension state is never selected into, or inferable from, a public
 * response beyond "not found".
 */
import type { Prisma } from "@/app/generated/prisma/client";

/** `companies` rows eligible for public activity. */
export function activeCompanyWhere(): Prisma.companiesWhereInput {
  return { deletedAt: null, users: { isActive: true } };
}

/**
 * Job offers a candidate or anonymous visitor may see and apply to:
 * published, not deleted, not expired, and owned by an active company.
 * `now` is evaluated per call so cached readers re-check expiry on refresh.
 */
export function publicJobWhere(now: Date = new Date()): Prisma.JobOfferWhereInput {
  return {
    status: "PUBLISHED",
    deletedAt: null,
    AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    company: activeCompanyWhere(),
  };
}

export interface CompanyActivityState {
  deletedAt: Date | null;
  users: { isActive: boolean } | null;
}

/** In-memory form of `activeCompanyWhere`, for rows already loaded from the DB. */
export function isCompanyActive(company: CompanyActivityState | null | undefined): boolean {
  return !!company && company.deletedAt === null && company.users?.isActive === true;
}

/** Select fragment that loads exactly what `isCompanyActive` needs. */
export const COMPANY_ACTIVITY_SELECT = {
  deletedAt: true,
  users: { select: { isActive: true } },
} as const;

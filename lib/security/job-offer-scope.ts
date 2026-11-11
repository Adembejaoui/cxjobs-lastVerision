/**
 * Decides the data scope for GET /api/job-offers from TRUSTED identity only.
 *
 *  - Anonymous / CANDIDATE / unknown roles: public catalogue (PUBLISHED only).
 *    `companyId` is a harmless public filter here.
 *  - ADMIN: every non-deleted job; `companyId` and `status` filters honoured.
 *  - COMPANY with a company profile: its own jobs in any status, but ONLY when
 *    it explicitly asks for them with its own `companyId`. Without a
 *    `companyId` a recruiter browsing the public catalogue sees the public
 *    catalogue (it used to see only its own jobs). A `companyId` naming
 *    ANOTHER company never widens access: it falls back to that company's
 *    public (PUBLISHED) listing.
 *  - COMPANY without a company profile: public catalogue only. A missing
 *    profile can never yield an unfiltered private query.
 */

export type JobOfferListScope =
  | { kind: "public"; companyId?: string }
  | { kind: "admin"; companyId?: string; status?: string }
  | { kind: "owner"; companyId: string; status?: string };

export interface JobOfferScopeInput {
  role?: string | null;
  userId?: string | null;
  requestedCompanyId?: string;
  requestedStatus?: string;
}

export async function resolveJobOfferListScope(
  input: JobOfferScopeInput,
  findOwnCompanyId: (userId: string) => Promise<string | null>
): Promise<JobOfferListScope> {
  const { role, userId, requestedCompanyId, requestedStatus } = input;

  if (role === "ADMIN" && userId) {
    return { kind: "admin", companyId: requestedCompanyId, status: requestedStatus };
  }

  if (role === "COMPANY" && userId && requestedCompanyId) {
    const ownCompanyId = await findOwnCompanyId(userId);
    if (ownCompanyId && requestedCompanyId === ownCompanyId) {
      return { kind: "owner", companyId: ownCompanyId, status: requestedStatus };
    }
    return { kind: "public", companyId: requestedCompanyId };
  }

  return { kind: "public", companyId: requestedCompanyId };
}

/** Base Prisma `where` for a private (admin/owner) scope. */
export function privateScopeBaseWhere(scope: Exclude<JobOfferListScope, { kind: "public" }>): Record<string, unknown> {
  const where: Record<string, unknown> = { deletedAt: null };
  if (scope.companyId) where.companyId = scope.companyId;
  if (scope.status) where.status = scope.status;
  return where;
}

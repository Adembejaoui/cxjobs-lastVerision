/**
 * Company slug changes keep old links working (launch plan A6).
 *
 * When a company changes its public slug, the old slug is recorded in
 * `company_slug_redirects`; /companies/<old> then permanently redirects to
 * the current slug. A slug that is (or was) another company's cannot be
 * claimed, so an old link can never silently start showing a different
 * company.
 */
import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/** True when `slug` is free for `companyId` (null = a company being created). */
export async function isCompanySlugAvailable(db: Db, slug: string, companyId: string | null): Promise<boolean> {
  const [current, redirect] = await Promise.all([
    db.companies.findFirst({
      where: { slug: { equals: slug, mode: "insensitive" }, ...(companyId ? { NOT: { id: companyId } } : {}) },
      select: { id: true },
    }),
    db.companySlugRedirect.findUnique({ where: { slug }, select: { companyId: true } }),
  ]);
  if (current) return false;
  if (redirect && redirect.companyId !== companyId) return false;
  return true;
}

/** Call inside the transaction that changes the slug. */
export async function recordCompanySlugChange(
  tx: Prisma.TransactionClient,
  companyId: string,
  oldSlug: string,
  newSlug: string
): Promise<void> {
  if (oldSlug === newSlug) return;
  await tx.companySlugRedirect.upsert({
    where: { slug: oldSlug },
    create: { slug: oldSlug, companyId },
    update: { companyId },
  });
  // Moving back to an earlier slug: it is current again, not a redirect.
  await tx.companySlugRedirect.deleteMany({ where: { slug: newSlug, companyId } });
}

/**
 * Current slug of the active company that previously used `slug`, or null.
 * Used by the public company page and API when no company has `slug` today.
 */
export async function resolveCompanySlugRedirect(slug: string): Promise<string | null> {
  const redirect = await prisma.companySlugRedirect.findUnique({
    where: { slug },
    select: { company: { select: { slug: true, deletedAt: true, users: { select: { isActive: true } } } } },
  });
  const company = redirect?.company;
  if (!company || company.deletedAt !== null || company.users?.isActive !== true) return null;
  return company.slug !== slug ? company.slug : null;
}

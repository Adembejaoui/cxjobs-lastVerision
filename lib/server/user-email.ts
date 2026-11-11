/**
 * Email identity helpers (NF-06).
 *
 * Email addresses are compared case-insensitively. New addresses are stored
 * lowercase (`normalizeEmail`, applied by the zod schemas), but rows created
 * before that may still hold mixed case, so lookups:
 *
 *  1. try an exact match on the normalized address (uses the unique index);
 *  2. fall back to a case-insensitive query, then RE-CHECK every candidate in
 *     JS with a strict lowercase comparison. The re-check matters: Prisma's
 *     `mode: "insensitive"` may compile to ILIKE, where `_` and `%` inside an
 *     address act as wildcards ("a_b@x.io" would also match "axb@x.io").
 *
 * When legacy data holds several case variants of one address, the lookup is
 * ambiguous and returns null rather than guessing which account is meant.
 */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface EmailLookupDb<T extends { email: string }> {
  findUnique(args: { where: { email: string }; select?: unknown }): Promise<T | null>;
  findMany(args: {
    where: { email: { equals: string; mode: "insensitive" } };
    select?: unknown;
    take: number;
  }): Promise<T[]>;
}

export async function findUserByEmail<T extends { email: string }>(
  db: EmailLookupDb<T>,
  rawEmail: string,
  select?: Record<string, boolean>
): Promise<T | null> {
  const email = normalizeEmail(rawEmail);
  if (!email) return null;
  // `email` must be selected for the re-check below.
  const sel = select ? { ...select, email: true } : undefined;

  const exact = await db.findUnique({ where: { email }, ...(sel ? { select: sel } : {}) });
  if (exact) return exact;

  const candidates = await db.findMany({
    where: { email: { equals: email, mode: "insensitive" } },
    ...(sel ? { select: sel } : {}),
    take: 3,
  });
  const matches = candidates.filter((u) => normalizeEmail(u.email) === email);
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Every account that uses this address under ANY case variant. An exact match
 * on the normalized address is returned on its own; otherwise the
 * case-insensitive candidates are re-checked strictly (see header).
 *
 * Unlike `findUserByEmail`, ambiguity is NOT collapsed to null. Callers that
 * must refuse to create a second account for an address (registration, OAuth
 * sign-up, invitation checks) need "taken" to stay true even when legacy data
 * holds several variants.
 */
export async function findEmailOwners<T extends { email: string }>(
  db: EmailLookupDb<T>,
  rawEmail: string,
  select?: Record<string, boolean>
): Promise<T[]> {
  const email = normalizeEmail(rawEmail);
  if (!email) return [];
  const sel = select ? { ...select, email: true } : undefined;

  const exact = await db.findUnique({ where: { email }, ...(sel ? { select: sel } : {}) });
  if (exact) return [exact];

  const candidates = await db.findMany({
    where: { email: { equals: email, mode: "insensitive" } },
    ...(sel ? { select: sel } : {}),
    take: 3,
  });
  return candidates.filter((u) => normalizeEmail(u.email) === email);
}

/** True when ANY account (any case variant) already uses this address. */
export async function emailIsTaken<T extends { email: string }>(
  db: EmailLookupDb<T>,
  rawEmail: string
): Promise<boolean> {
  return (await findEmailOwners(db, rawEmail, { id: true })).length > 0;
}

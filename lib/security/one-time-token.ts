import crypto from "crypto";

/**
 * One-time tokens (password reset, email verification).
 *
 * The raw token is 256 bits from the CSPRNG and is only ever sent to the user.
 * The database stores SHA-256(token): a leaked table row or backup cannot be
 * replayed. SHA-256 (not bcrypt) is appropriate because the input is a
 * high-entropy random value, and it keeps lookups indexable.
 */

export function hashOneTimeToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateOneTimeToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: hashOneTimeToken(token) };
}

/** Raw tokens are 64 lowercase hex chars; reject anything else early. */
export function isWellFormedToken(token: unknown): token is string {
  return typeof token === "string" && /^[0-9a-f]{64}$/.test(token);
}

export interface TokenRow {
  id: string;
  userId: string | null;
  expires: Date;
}

export interface ConsumeDeps<Tx> {
  /** Look up by HASH. */
  findByHash(tx: Tx, tokenHash: string): Promise<TokenRow | null>;
  /**
   * Delete the row only if it is still unexpired; returns rows deleted. This
   * conditional delete is the single-use guarantee: of two concurrent
   * requests with the same token, only one can delete it.
   */
  deleteIfValid(tx: Tx, id: string, now: Date): Promise<number>;
  isUserActive(tx: Tx, userId: string): Promise<boolean>;
  /** Apply the effect (set password / mark verified). */
  apply(tx: Tx, userId: string): Promise<void>;
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

export type ConsumeResult = { ok: true; userId: string } | { ok: false; reason: "invalid" | "expired" };

/**
 * Atomically validate, consume and apply a one-time token. Effects are applied
 * in the same transaction as the consuming delete, so a failure rolls both
 * back and a replay can never re-apply them.
 */
export async function consumeOneTimeToken<Tx>(
  rawToken: unknown,
  deps: ConsumeDeps<Tx>,
  now: Date = new Date()
): Promise<ConsumeResult> {
  if (!isWellFormedToken(rawToken)) return { ok: false, reason: "invalid" };
  const tokenHash = hashOneTimeToken(rawToken);

  return deps.transaction(async (tx) => {
    const row = await deps.findByHash(tx, tokenHash);
    if (!row || !row.userId) return { ok: false, reason: "invalid" } as const;
    if (row.expires <= now) return { ok: false, reason: "expired" } as const;

    const deleted = await deps.deleteIfValid(tx, row.id, now);
    if (deleted !== 1) return { ok: false, reason: "invalid" } as const;

    if (!(await deps.isUserActive(tx, row.userId))) return { ok: false, reason: "invalid" } as const;

    await deps.apply(tx, row.userId);
    return { ok: true, userId: row.userId } as const;
  });
}

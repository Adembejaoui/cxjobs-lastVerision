/**
 * Pure, dependency-injected Auth.js callback logic so it can be unit-tested
 * without a database or AUTH_SECRET. `lib/auth.ts` wires the real loaders.
 *
 * Security invariants:
 *  - Privileged claims (id, role, isOnboarded, emailVerified) are only ever
 *    taken from the authenticated sign-in result or from the database.
 *  - Data passed to `update()` (client `useSession().update`, a POST to
 *    /api/auth/session, or server `unstable_update`) is NEVER merged into the
 *    token. An update only triggers a fresh read of the user row.
 *  - A missing or deactivated user invalidates the token (returns null).
 *  - Session revocation: the token carries the user's `sessionVersion` (`sv`).
 *    Incrementing it in the database (password reset, suspension, identity
 *    change, deletion) invalidates every existing token for that user:
 *      · immediately, via a per-request lookup of the published version
 *        (Redis, bounded latency, see lib/server/session-revocation.ts);
 *      · at the latest after `refreshAfterSeconds`, via the DB re-read, even
 *        if Redis is unavailable.
 *  - Claim freshness is tracked in `claimsAt`, NOT `iat`: Auth.js re-stamps
 *    `iat` every time it re-encodes the cookie, which would postpone the
 *    periodic DB re-read indefinitely for an active session.
 */

export interface TokenUserRecord {
  id: string;
  role: string;
  isActive: boolean;
  isOnboarded: boolean;
  emailVerified: Date | null;
  sessionVersion: number;
}

export interface AppJwt {
  id?: string;
  role?: string;
  isOnboarded?: boolean;
  emailVerified?: boolean;
  /** sessionVersion of the user when the claims were derived. */
  sv?: number;
  /** Unix seconds when the claims were last derived from the database. */
  claimsAt?: number;
  iat?: number;
  [key: string]: unknown;
}

export interface JwtCallbackInput {
  token: AppJwt;
  user?: { id?: string; role?: string; isOnboarded?: boolean } | null;
  trigger?: "signIn" | "signUp" | "update";
  /** Untrusted. Intentionally ignored except as a refresh signal. */
  session?: unknown;
  /**
   * Set only on OAuth sign-in when the provider asserted a verified email
   * (e.g. Google `email_verified: true`). Derived server-side in lib/auth.ts
   * from the provider's ID token profile, never from client input.
   */
  providerVerifiedEmail?: boolean;
}

export interface JwtCallbackDeps {
  loadUser: (id: string) => Promise<TokenUserRecord | null>;
  now?: () => number;
  /** Max age (seconds) of DB-derived claims before they are re-read. */
  refreshAfterSeconds?: number;
  requireEmailVerification?: boolean;
  /** Persists emailVerified for a trusted-provider sign-in. */
  markEmailVerified?: (id: string) => Promise<void>;
  /**
   * Latest published sessionVersion for the user, or null when unknown /
   * unavailable. Must be cheap and must not throw.
   */
  getPublishedSessionVersion?: (id: string) => Promise<number | null>;
}

// Claims are re-read from the DB at most every 15 minutes per session (one
// primary-key lookup). Sign-in and `update` always force a re-read. This is
// also the worst-case revocation delay when Redis is unavailable.
export const DEFAULT_REFRESH_SECONDS = 15 * 60;

function applyRecord(token: AppJwt, record: TokenUserRecord, nowSec: number): AppJwt {
  return {
    ...token,
    id: record.id,
    role: record.role,
    isOnboarded: record.isOnboarded,
    emailVerified: record.emailVerified !== null,
    sv: record.sessionVersion,
    claimsAt: nowSec,
  };
}

export async function jwtCallback(
  { token, user, trigger, providerVerifiedEmail }: JwtCallbackInput,
  deps: JwtCallbackDeps
): Promise<AppJwt | null> {
  const nowSec = Math.floor((deps.now?.() ?? Date.now()) / 1000);
  const refreshAfter = deps.refreshAfterSeconds ?? DEFAULT_REFRESH_SECONDS;

  // Initial sign-in: `user` comes from authorize()/the OAuth adapter, which
  // are server-side. Still re-read the row so all claims share one source.
  const userId = user?.id ?? token.id;
  if (!userId) return token;

  const isSignIn = !!user;
  const isUpdate = trigger === "update";
  const tokenVersion = typeof token.sv === "number" ? token.sv : 0;

  // Fast revocation check on every request for an existing session.
  if (!isSignIn && deps.getPublishedSessionVersion) {
    const published = await deps.getPublishedSessionVersion(userId);
    if (published !== null && published > tokenVersion) return null;
  }

  // Tokens minted before `claimsAt` existed have none: refresh them now.
  const claimsAge = nowSec - (typeof token.claimsAt === "number" ? token.claimsAt : 0);
  const needsRefresh = isSignIn || isUpdate || claimsAge > refreshAfter;

  if (!needsRefresh) return token;

  let record = await deps.loadUser(userId);
  if (!record || !record.isActive) return null;
  // Authoritative revocation check (works even when Redis is down).
  if (!isSignIn && record.sessionVersion !== tokenVersion) return null;
  if (isSignIn && providerVerifiedEmail && record.emailVerified === null && deps.markEmailVerified) {
    await deps.markEmailVerified(record.id);
    record = { ...record, emailVerified: new Date(nowSec * 1000) };
  }
  if (deps.requireEmailVerification && record.emailVerified === null) return null;

  return applyRecord(token, record, nowSec);
}

export interface CredentialsUserRecord {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  isOnboarded: boolean;
  passwordHash: string | null;
  emailVerified: Date | null;
}

export type CredentialsResult =
  | { ok: true; user: { id: string; email: string; name: string | null; role: string; isOnboarded: boolean } }
  | { ok: false; reason: "invalid" | "unverified" };

export interface AuthorizeDeps {
  findUserByEmail: (email: string) => Promise<CredentialsUserRecord | null>;
  comparePassword: (plain: string, hash: string) => Promise<boolean>;
  /** Hash used to equalise timing when the user does not exist. */
  dummyHash: string;
  requireEmailVerification?: boolean;
}

/**
 * Credential check. Every failure path performs one bcrypt comparison so
 * response timing does not reveal whether an email is registered. The
 * verification check runs only AFTER a correct password, so it cannot be used
 * to enumerate accounts.
 */
export async function authorizeCredentials(
  email: string,
  password: string,
  deps: AuthorizeDeps
): Promise<CredentialsResult> {
  const record = await deps.findUserByEmail(email);
  if (!record || !record.passwordHash || !record.isActive) {
    await deps.comparePassword(password, deps.dummyHash);
    return { ok: false, reason: "invalid" };
  }
  const valid = await deps.comparePassword(password, record.passwordHash);
  if (!valid) return { ok: false, reason: "invalid" };
  if (deps.requireEmailVerification && record.emailVerified === null) {
    return { ok: false, reason: "unverified" };
  }
  return {
    ok: true,
    user: {
      id: record.id,
      email: record.email,
      name: record.name,
      role: record.role,
      isOnboarded: record.isOnboarded,
    },
  };
}

/**
 * Feature flag for issue A. Defaults OFF because the application currently
 * has no email delivery: enabling it before verification emails are sent
 * would lock every new credentials account out. Accepts "true"/"1".
 */
export function isEmailVerificationRequired(env: Record<string, string | undefined> = process.env): boolean {
  const v = env.REQUIRE_EMAIL_VERIFICATION?.trim().toLowerCase();
  return v === "true" || v === "1";
}

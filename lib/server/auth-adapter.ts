/**
 * Email-identity hardening for the Auth.js database adapter (H8).
 *
 * Auth.js (`handleLoginOrRegister`) handles an OAuth sign-in for an account
 * that is NOT yet linked like this:
 *   1. `getUserByEmail(profile.email)` finds a user → `OAuthAccountNotLinked`
 *      (we never set `allowDangerousEmailAccountLinking`, so nothing is
 *      linked; the person must sign in with their existing method);
 *   2. no user → `createUser(profile)` creates a NEW account.
 *
 * The stock PrismaAdapter looks the address up with an EXACT, case-sensitive
 * match. A legacy row stored as `User@Example.com` was therefore invisible to
 * a Google sign-in as `user@example.com`, and step 2 silently created a second,
 * duplicate account for the same person.
 *
 * This wrapper changes only two methods:
 *   - `getUserByEmail` sees every case variant (`findEmailOwners`), INCLUDING
 *     ambiguous legacy data, so step 1 refuses instead of step 2 duplicating.
 *     Returning a user here never links anything by itself: linking would
 *     require `allowDangerousEmailAccountLinking`, which must stay off.
 *   - `createUser` stores the normalized address and only server-chosen
 *     fields. Whatever a provider `profile()` returns, a new OAuth account is
 *     always an unverified, not-onboarded, active CANDIDATE. The address is
 *     marked verified later only if the provider asserts it for the SAME
 *     address (`providerVerifiesUserEmail`).
 *
 * Every other adapter method (already-linked accounts, account linking for a
 * signed-in user, sessions, tokens) is delegated unchanged.
 */
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { findEmailOwners, normalizeEmail, type EmailLookupDb } from "./user-email";

export type EmailOwnerDb = EmailLookupDb<{ id: string; email: string }>;

export function withEmailIdentityGuards(base: Adapter, users: EmailOwnerDb): Adapter {
  const { getUser, createUser } = base;
  if (!getUser || !createUser) {
    throw new Error("Auth adapter must implement getUser and createUser");
  }

  return {
    ...base,

    async getUserByEmail(email: string) {
      const owners = await findEmailOwners(users, email, { id: true });
      if (owners.length === 0) return null;
      // Several legacy variants: any of them is "an existing account"; the
      // only consequence is OAuthAccountNotLinked, never a link.
      return getUser(owners[0].id);
    },

    async createUser(user: AdapterUser) {
      const email = normalizeEmail(typeof user.email === "string" ? user.email : "");
      if (!email) throw new Error("OAuth profile has no email address");
      // No `id`: in Auth.js it is the provider's subject id, never ours. The
      // database generates the user id.
      const data = {
        email,
        name: typeof user.name === "string" ? user.name : null,
        image: typeof user.image === "string" ? user.image : null,
        emailVerified: null,
        role: "CANDIDATE",
        isOnboarded: false,
        isActive: true,
      };
      // The app's User row has more columns than AdapterUser; PrismaAdapter
      // passes the object straight to prisma.user.create.
      return createUser(data as unknown as AdapterUser);
    },
  };
}

/**
 * True only when the provider asserts ownership of the SAME address that the
 * signed-in account holds. Without the address comparison, linking a verified
 * Google account to a signed-in user with a different (unverified) address
 * would mark that unrelated address as verified.
 */
export function providerVerifiesUserEmail(
  account: { provider?: string } | null | undefined,
  profile: { email?: unknown; email_verified?: unknown } | null | undefined,
  user: { email?: unknown } | null | undefined
): boolean {
  if (account?.provider !== "google") return false;
  if (profile?.email_verified !== true) return false;
  const providerEmail = typeof profile.email === "string" ? normalizeEmail(profile.email) : "";
  const userEmail = typeof user?.email === "string" ? normalizeEmail(user.email) : "";
  return providerEmail !== "" && providerEmail === userEmail;
}

/**
 * Gate for every Google sign-in (lib/auth.ts `signIn` callback): an address is
 * required and Google must assert it is verified (strictly boolean `true`).
 */
export function isTrustedGoogleProfile(
  user: { email?: unknown } | null | undefined,
  profile: { email_verified?: unknown } | null | undefined
): boolean {
  return typeof user?.email === "string" && user.email.trim() !== "" && profile?.email_verified === true;
}

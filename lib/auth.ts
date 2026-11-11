import NextAuth, { CredentialsSignin } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import prisma from "./prisma";
import { getAuthUserRecord } from "./auth-user-record";
import { logger } from "./logger";
import crypto from "crypto";
import {
  authorizeCredentials,
  isEmailVerificationRequired,
  jwtCallback,
  type AppJwt,
  type CredentialsUserRecord,
} from "./auth-callbacks";
import { findUserByEmail, normalizeEmail, type EmailLookupDb } from "./server/user-email";
import { checkRateLimitsAsync } from "./rate-limit";
import { getClientIp } from "./utils";
import { getPublishedSessionVersion } from "./server/session-revocation";
import {
  isTrustedGoogleProfile,
  providerVerifiesUserEmail,
  withEmailIdentityGuards,
  type EmailOwnerDb,
} from "./server/auth-adapter";

const DUMMY_PASSWORD_HASH =
  "$2b$12$Tzq0gYe4R7DTwIx4PZoKxucAmQLvVLBoUrVni61m/TL.bIq6vqwG6";

interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  isOnboarded: boolean;
}

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

if (!authSecret) {
  throw new Error(
    "AUTH_SECRET environment variable is required. Generate one with: openssl rand -base64 32"
  );
}

class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}

class LoginRateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

// Brute-force protection for credentials login. Per-IP bounds a single
// source; per-account bounds distributed guessing against one email. Emails
// are hashed so Redis never stores them in clear text.
const LOGIN_IP_LIMIT = { windowMs: 15 * 60_000, max: 30 };
const LOGIN_ACCOUNT_LIMIT = { windowMs: 15 * 60_000, max: 10 };

function hashForKey(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);
}

// Request-scoped (React cache) lookup shared with getAuthenticatedUser(), so
// a render reads the users row at most once. Never a cross-request cache.
async function loadTokenUser(id: string) {
  return getAuthUserRecord(id);
}

export const { handlers, signIn, signOut, auth,unstable_update } = NextAuth({
  trustHost: true,
  // Case-insensitive email ownership + server-chosen fields for new OAuth
  // users (H8, lib/server/auth-adapter.ts). Never combine this with
  // `allowDangerousEmailAccountLinking`: the provider must stay non-linking.
  adapter: withEmailIdentityGuards(
    PrismaAdapter(prisma as unknown as Parameters<typeof PrismaAdapter>[0]),
    prisma.user as unknown as EmailOwnerDb
  ),
  secret: authSecret,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (typeof credentials?.email !== "string" || typeof credentials?.password !== "string") {
          return null;
        }
        if (!credentials.email || !credentials.password || credentials.password.length > 256) {
          return null;
        }

        // Canonical form for rate-limit keys and lookups (NF-06).
        const email = normalizeEmail(credentials.email);
        const password = credentials.password;

        const ip = request ? getClientIp(request) : "unknown";
        const rl = await checkRateLimitsAsync([
          { key: `login-ip:${ip}`, config: LOGIN_IP_LIMIT },
          { key: `login-acct:${hashForKey(email)}`, config: LOGIN_ACCOUNT_LIMIT },
        ]);
        if (!rl.allowed) {
          throw new LoginRateLimitedError();
        }

        const result = await authorizeCredentials(email, password, {
          // Case-insensitive, legacy-row tolerant (lib/server/user-email.ts).
          findUserByEmail: (e) =>
            findUserByEmail(prisma.user as unknown as EmailLookupDb<CredentialsUserRecord>, e, {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
              isOnboarded: true,
              passwordHash: true,
              emailVerified: true,
            }),
          comparePassword: (plain, hash) => bcrypt.compare(plain, hash),
          dummyHash: DUMMY_PASSWORD_HASH,
          requireEmailVerification: isEmailVerificationRequired(),
        });

        if (!result.ok) {
          if (result.reason === "unverified") throw new EmailNotVerifiedError();
          return null;
        }
        return result.user;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile, trigger }) {
      // Client-supplied `session` update data is deliberately not read: an
      // update only forces claims to be re-derived from the database.
      // Only a provider assertion about the SAME address counts (a Google
      // account linked to a signed-in user may carry a different address).
      const providerVerifiedEmail = providerVerifiesUserEmail(account, profile, user);

      const next = await jwtCallback(
        { token: token as AppJwt, user, trigger, providerVerifiedEmail },
        {
          loadUser: loadTokenUser,
          markEmailVerified: async (id) => {
            await prisma.user.update({ where: { id }, data: { emailVerified: new Date() } });
          },
          requireEmailVerification: isEmailVerificationRequired(),
          getPublishedSessionVersion,
        }
      );
      return next as typeof token | null;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.isOnboarded = token.isOnboarded as boolean;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        // Trusted-provider policy: Google asserts address ownership via
        // `email_verified`. An unverified Google address is never accepted.
        if (!user.email || !isTrustedGoogleProfile(user, profile)) {
          return false;
        }

        const existingUser = await findUserByEmail(
          prisma.user as unknown as EmailLookupDb<{ email: string; isActive: boolean }>,
          user.email,
          { id: true, isActive: true }
        );

        if (existingUser) {
          if (!existingUser.isActive) {
            return false;
          }
          return true;
        }
      }
      return true;
    },
  },
  events: {
    async createUser({ user }) {
      logger.info("New user created", {
        userId: user.id,
        role: user.role,
      });
    },
  },
});

declare module "next-auth" {
  interface User {
    role?: string;
    isOnboarded?: boolean;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
      isOnboarded: boolean;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    isOnboarded?: boolean;
    emailVerified?: boolean;
    sv?: number;
    claimsAt?: number;
    iat?: number;
  }
}

export type { AuthUser };

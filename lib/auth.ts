import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import prisma from "./prisma";
import { logger } from "./logger";

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

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
   adapter: PrismaAdapter(prisma as unknown as Parameters<typeof PrismaAdapter>[0]),
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash || !user.isActive) {
          await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
          return null;
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isOnboarded: user.isOnboarded,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isOnboarded = user.isOnboarded;
        token.iat = Math.floor(Date.now() / 1000);
      }

      if (token.id) {
        const now = Math.floor(Date.now() / 1000);
        const tokenAge = now - (token.iat as number);

        if (tokenAge > 3600) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, isOnboarded: true, isActive: true },
          });

          if (dbUser) {
            token.role = dbUser.role;
            token.isOnboarded = dbUser.isOnboarded;
            token.iat = Math.floor(Date.now() / 1000);
          }
        }
      }

      if (trigger === "update" && session) {
        token = { ...token, ...session };
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.isOnboarded = token.isOnboarded as boolean;
      }
      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) {
          return false;
        }

        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

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
    iat?: number;
  }
}

export type { AuthUser };

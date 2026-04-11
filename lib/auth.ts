import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import prisma from "./prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
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

        if (!user || !user.passwordHash) {
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
      // Always fetch fresh user data from database to get latest isOnboarded status
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, isOnboarded: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.isOnboarded = dbUser.isOnboarded;
        }
      }

      // Initial sign in - add user data to token
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isOnboarded = user.isOnboarded;
      }

      // Update session when user data changes
      if (trigger === "update" && session) {
        token = { ...token, ...session };
      }

      return token;
    },
    async session({ session, token }) {
      // Add token data to session
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.isOnboarded = token.isOnboarded as boolean;
      }
      return session;
    },
    async signIn({ user, account }) {
      // For OAuth providers, check if user exists
      if (account?.provider === "google") {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        // If user doesn't exist, they will be created by the adapter
        // If user exists but has no password (OAuth only), allow sign in
        if (existingUser) {
          return true;
        }
      }
      return true;
    },
  },
  events: {
    async createUser({ user }) {
      // Log new user creation
      console.log(`New user created: ${user.email}`);
    },
  },
});

// Type extensions for NextAuth
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
  }
}

import { cache } from "react";
import prisma from "./prisma";

/**
 * Single source of truth for the authenticated user row.
 *
 * The same user record is needed in two places during a request:
 *  - the Auth.js `jwt` callback, to refresh role/onboarding claims and to reject
 *    deactivated accounts,
 *  - `getAuthenticatedUser()`, which resolves the display user for the dashboard.
 *
 * Both used to issue their own `prisma.user.findUnique`, so a single dashboard
 * render could hit the users table twice. `cache()` deduplicates the lookup for
 * the lifetime of the current React request scope only: it is never shared across
 * requests or users, and outside a React render (Route Handlers, scripts) it
 * simply calls through without memoizing.
 */
export const getAuthUserRecord = cache(async (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      isActive: true,
      isOnboarded: true,
    },
  })
);

export type AuthUserRecord = NonNullable<Awaited<ReturnType<typeof getAuthUserRecord>>>;

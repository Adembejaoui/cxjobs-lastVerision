/**
 * Dashboard routing policy (Phase 4A / Task C).
 *
 * Every decision is made from the DATABASE user record
 * (`getAuthenticatedUser` → `getAuthUserRecord`, request-scoped), never from
 * the JWT claims: those can lag the database by up to 15 minutes, and two
 * guards reading different sources is how redirect loops start.
 *
 * Where onboarding happens:
 *   - CANDIDATE: /onboarding/candidate (outside the dashboard shell).
 *   - COMPANY:   the company profile page, inside the shell. Saving it
 *                (POST /api/profile) sets `isOnboarded`. Signup already sends
 *                invited companies there (`?welcome=1`).
 *
 * Root cause of the loop this replaces: the shell sent a not-onboarded COMPANY
 * to /onboarding/company, which is the invitation-registration page and sends
 * every signed-in user back to /dashboard → /dashboard/company → shell → …
 * The profile page, the only place a company can finish onboarding, sat
 * behind the same guard and was unreachable.
 */

export interface DashboardUser {
  role: string;
  isActive: boolean;
  isOnboarded: boolean;
}

export const LOGIN_PATH = "/login";
export const CANDIDATE_ONBOARDING_PATH = "/onboarding/candidate";
export const COMPANY_ONBOARDING_PATH = "/dashboard/company/profile";

/** The home of each role. Unknown roles go to the public site. */
export function dashboardHomeFor(role: string): string {
  switch (role) {
    case "COMPANY":
      return "/dashboard/company";
    case "CANDIDATE":
      return "/dashboard/candidate";
    case "ADMIN":
      return "/dashboard/admin";
    default:
      return "/";
  }
}

/**
 * Shared dashboard shell (`app/(dashboard)/layout.tsx`). Returns the redirect
 * target, or null to render.
 *
 * A not-onboarded COMPANY is let into the shell on purpose: the company area
 * layout below decides, so the profile page stays reachable.
 */
export function resolveDashboardShellRedirect(user: DashboardUser | null): string | null {
  if (!user || !user.isActive) return LOGIN_PATH;
  if (user.role === "CANDIDATE" && !user.isOnboarded) return CANDIDATE_ONBOARDING_PATH;
  return null;
}

/**
 * Company pages other than the profile page
 * (`app/(dashboard)/dashboard/company/(onboarded)/layout.tsx`).
 */
export function resolveCompanyAreaRedirect(user: DashboardUser | null): string | null {
  if (!user || !user.isActive) return LOGIN_PATH;
  // Straight to the right home (not via /dashboard), so a lagging claim
  // elsewhere can never bounce the request back here.
  if (user.role !== "COMPANY") return dashboardHomeFor(user.role);
  if (!user.isOnboarded) return COMPANY_ONBOARDING_PATH;
  return null;
}

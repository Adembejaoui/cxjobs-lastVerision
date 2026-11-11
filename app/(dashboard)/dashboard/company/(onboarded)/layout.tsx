import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { resolveCompanyAreaRedirect } from "@/lib/security/dashboard-access";

/**
 * Guard for every company page EXCEPT the profile page, which lives outside
 * this route group so a not-onboarded company can always reach it to finish
 * onboarding (see lib/security/dashboard-access.ts). The route group does not
 * change any URL.
 *
 * The user record is the request-scoped DB read the parent shell already
 * made, so this guard adds no query.
 */
export default async function CompanyOnboardedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authResult = await getAuthenticatedUser();
  const target = resolveCompanyAreaRedirect(authResult instanceof NextResponse ? null : authResult.user);
  if (target) {
    redirect(target);
  }

  return <>{children}</>;
}

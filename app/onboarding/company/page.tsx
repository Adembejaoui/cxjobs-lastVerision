import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import CompanyInvitation from "@/components/auth/company-invitation";

/**
 * Company invitation onboarding.
 *
 * The invitation token is a bearer secret carried in the URL FRAGMENT
 * (`/onboarding/company#token=…`), which browsers never send to the server.
 * This server component therefore never sees, validates or renders the token:
 * <CompanyInvitation> reads it client-side, scrubs it from the address bar and
 * validates it through POST /api/auth/invitation (token in the body only).
 * Legacy `?token=` links still work: the client accepts and scrubs them.
 */
export default async function CompanyOnboardingPage() {
  const session = await auth();
  if (session?.user?.id) {
    // Signed-in users never register through an invitation; the dashboard
    // routes them by role.
    redirect("/dashboard");
  }

  return <CompanyInvitation />;
}

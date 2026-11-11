import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { dashboardHomeFor } from "@/lib/security/dashboard-access";

export default async function DashboardPage() {
  // Role from the database (the same request-scoped read the shell layout
  // made), not the JWT claim, so this router and the guards always agree.
  const authResult = await getAuthenticatedUser();

  if (authResult instanceof NextResponse) {
    redirect("/login");
  }

  redirect(dashboardHomeFor(authResult.user.role));
}

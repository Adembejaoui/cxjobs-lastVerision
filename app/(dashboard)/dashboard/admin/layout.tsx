import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";

/**
 * Admin route guard.
 *
 * The dashboard shell (sidebar + header) is provided by the parent
 * `app/(dashboard)/layout.tsx`, so this layout only enforces server-side
 * authorization and renders children through the existing shell.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authResult = await requireAdmin();

  if (authResult instanceof NextResponse) {
    if (authResult.status === 401) {
      redirect("/login");
    }
    redirect("/");
  }

  return <>{children}</>;
}
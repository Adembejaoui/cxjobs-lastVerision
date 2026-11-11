import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { resolveDashboardShellRedirect } from "@/lib/security/dashboard-access";
import prisma from "@/lib/prisma";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { MobileSidebar } from "@/components/dashboard/sidebar";
import { DashboardHeader } from "@/components/dashboard/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authResult = await getAuthenticatedUser();

  if (authResult instanceof NextResponse) {
    redirect("/login");
  }

  const user = authResult.user;

  // DB-derived decision (lib/security/dashboard-access.ts). A not-onboarded
  // COMPANY is let in: the company area layout sends it to the profile page,
  // where onboarding is completed.
  const target = resolveDashboardShellRedirect(user);
  if (target) {
    redirect(target);
  }
  const userRole = user.role;

  // Fetch profile data for sidebar image source
  let profileImage: string | null = user.image ?? null;
  let companyData = null;
  if (userRole === "COMPANY") {
    companyData = await prisma.companies.findUnique({
      where: { userId: user.id },
      select: { id: true, name: true, logoUrl: true },
    });
  } else if (userRole === "CANDIDATE") {
    const candidate = await prisma.candidate.findUnique({
      where: { userId: user.id },
      select: { avatarUrl: true },
    });
    profileImage = candidate?.avatarUrl ?? null;
  }

  const displayUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    image: userRole === "COMPANY" ? null : profileImage,
    role: userRole,
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar - Hidden on mobile and tablet */}
      <DashboardSidebar
        userRole={userRole}
        user={displayUser}
        company={companyData}
        className="hidden lg:flex"
      />

      {/* Mobile Sidebar */}
      <MobileSidebar userRole={userRole} user={displayUser} company={companyData} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col lg:pl-[275px]">
        {/* Header */}
        <DashboardHeader user={displayUser} />

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

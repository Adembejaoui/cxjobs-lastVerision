import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
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

  if (user.role !== "ADMIN" && !user.isOnboarded) {
    if (user.role === "CANDIDATE") {
      redirect("/onboarding/candidate");
    } else if (user.role === "COMPANY") {
      redirect("/onboarding/company");
    }
  }
  const userRole = user.role;
  const displayUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: userRole,
  };

  // Fetch company data for COMPANY users to display in sidebar
  let companyData = null;
  if (userRole === "COMPANY") {
    companyData = await prisma.companies.findUnique({
      where: { userId: user.id },
      select: { id: true, name: true, logoUrl: true },
    });
  }

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

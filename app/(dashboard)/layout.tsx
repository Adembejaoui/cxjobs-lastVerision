import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
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

  if (!user.isOnboarded) {
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

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar - Hidden on mobile and tablet */}
      <DashboardSidebar
        userRole={userRole}
        user={displayUser}
        className="hidden lg:flex"
      />

      {/* Mobile Sidebar */}
      <MobileSidebar userRole={userRole} user={displayUser} />

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

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { MobileSidebar } from "@/components/dashboard/sidebar";
import { DashboardHeader } from "@/components/dashboard/header";
import prisma from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!session?.user?.isOnboarded) {
    const freshUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isOnboarded: true, role: true },
    });

    if (freshUser?.isOnboarded) {
      session.user.isOnboarded = true;
    } else {
      if (freshUser?.role === "CANDIDATE") {
        redirect("/onboarding/candidate");
      } else if (freshUser?.role === "COMPANY") {
        redirect("/onboarding/company");
      }
    }
  }
  const userRole = session?.user.role;
  const user = {
    id: session?.user.id as string,
    name: session?.user.name,
    email: session?.user.email,
    image: session?.user.image,
    role: userRole,
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar - Hidden on mobile and tablet */}
      <DashboardSidebar
        userRole={userRole}
        user={user}
        className="hidden lg:flex"
      />

      {/* Mobile Sidebar */}
      <MobileSidebar userRole={userRole} user={user} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col lg:pl-[275px]">
        {/* Header */}
        <DashboardHeader user={user} />

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

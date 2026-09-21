"use client";

interface UserData {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
}

interface DashboardHeaderProps {
  user: UserData;
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const getRoleTitle = () => {
    switch (user.role) {
      case "COMPANY":
        return "Recruiter Dashboard";
      case "CANDIDATE":
        return "Candidate Dashboard";
      case "ADMIN":
        return "Admin Dashboard";
      default:
        return "Dashboard";
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-4 lg:px-8">
      {/* Page Title - Hidden on mobile */}
      <div className="hidden lg:block">
        <h1 className="text-xl font-bold text-slate-900">{getRoleTitle()}</h1>
        <p className="text-sm text-slate-500">Welcome back, {user.name || "User"}</p>
      </div>


     

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* User Avatar - Mobile only */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#47d79d] text-xs font-bold text-[#071738] lg:hidden">
          {user.name?.charAt(0).toUpperCase() || "U"}
        </div>
      </div>
    </header>
  );
}

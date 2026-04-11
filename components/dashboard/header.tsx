"use client";

import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

      {/* Search - Takes remaining space on desktop */}
      <div className="flex flex-1 items-center gap-4 lg:ml-8 lg:max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-full pl-10 lg:w-[400px]"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-slate-600" />
          <span className="absolute right-1 top-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#47d79d] opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#47d79d]"></span>
          </span>
        </Button>

        {/* User Avatar - Mobile only */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#47d79d] text-xs font-bold text-[#071738] lg:hidden">
          {user.name?.charAt(0).toUpperCase() || "U"}
        </div>
      </div>
    </header>
  );
}

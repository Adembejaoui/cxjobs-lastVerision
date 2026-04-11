"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  Settings, 
  Bell, 
  LogOut,
  Menu,
  X,
  Building2,
  Search,
  FileText,
  User,
  ChevronDown,
  PanelLeft,
  PlusCircle,
  BarChart3,
  Shield
} from "lucide-react";
import { auth } from "@/lib/auth";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
}

interface SidebarProps {
  userRole?: string;
  userName?: string;
  userEmail?: string;
}

// Navigation items based on user role
const candidateNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
  { title: "Browse Jobs", href: "/jobs", icon: <Search className="w-5 h-5" /> },
  { title: "My Applications", href: "/dashboard/applications", icon: <FileText className="w-5 h-5" /> },
  { title: "Job Alerts", href: "/dashboard/alerts", icon: <Bell className="w-5 h-5" /> },
  { title: "Profile", href: "/dashboard/candidate", icon: <User className="w-5 h-5" /> },
  { title: "Settings", href: "/dashboard/settings", icon: <Settings className="w-5 h-5" /> },
];

const companyNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
  { title: "My Jobs", href: "/dashboard/jobs", icon: <Briefcase className="w-5 h-5" /> },
  { title: "Company Profile", href: "/dashboard/company", icon: <Building2 className="w-5 h-5" /> },
  { title: "Analytics", href: "/dashboard/analytics", icon: <BarChart3 className="w-5 h-5" /> },
  { title: "Settings", href: "/dashboard/settings", icon: <Settings className="w-5 h-5" /> },
];

const adminNavItems: NavItem[] = [
  { title: "Admin Dashboard", href: "/admin", icon: <Shield className="w-5 h-5" /> },
  { title: "Users", href: "/admin/users", icon: <Users className="w-5 h-5" /> },
  { title: "Companies", href: "/admin/companies", icon: <Building2 className="w-5 h-5" /> },
  { title: "Jobs", href: "/admin/jobs", icon: <Briefcase className="w-5 h-5" /> },
  { title: "Applications", href: "/admin/applications", icon: <FileText className="w-5 h-5" /> },
  { title: "Audit Logs", href: "/admin/audit-logs", icon: <BarChart3 className="w-5 h-5" /> },
  { title: "Settings", href: "/admin/settings", icon: <Settings className="w-5 h-5" /> },
];

export function Sidebar({ userRole, userName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Get navigation items based on role
  const getNavItems = () => {
    switch (userRole) {
      case "ADMIN":
        return adminNavItems;
      case "COMPANY":
        return companyNavItems;
      case "CANDIDATE":
      default:
        return candidateNavItems;
    }
  };

  const navItems = getNavItems();

  // Close mobile sidebar when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-background border shadow-sm"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-screen bg-background border-r transition-all duration-300 flex flex-col",
          // Desktop
          isOpen ? "w-64" : "w-20",
          // Mobile
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">CX</span>
            </div>
            {isOpen && (
              <span className="font-semibold text-lg">CXJobs</span>
            )}
          </div>
          
          {/* Close buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="hidden lg:flex p-1.5 rounded-md hover:bg-accent"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-md hover:bg-accent"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    title={!isOpen ? item.title : undefined}
                  >
                    {item.icon}
                    {isOpen && <span>{item.title}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Profile Section */}
        <div className="border-t p-3">
          <div 
            className={cn(
              "flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer transition-colors",
              !isOpen && "justify-center"
            )}
            onClick={() => isOpen && setIsProfileOpen(!isProfileOpen)}
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            {isOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {userName || "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {userEmail || "user@example.com"}
                </p>
              </div>
            )}
          </div>

          {/* Expanded Profile Menu */}
          {isOpen && isProfileOpen && (
            <div className="mt-2 pt-2 border-t space-y-1">
              <Link
                href="/dashboard/profile"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <User className="w-4 h-4" />
                <span>Profile</span>
              </Link>
              <Link
                href="/dashboard/settings"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </Link>
              <button
                onClick={async () => {
                  // Sign out using NextAuth
                  const { signOut } = await import("next-auth/react");
                  signOut({ callbackUrl: "/login" });
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* Sign Out button when collapsed */}
          {!isOpen && (
            <button
              onClick={async () => {
                const { signOut } = await import("next-auth/react");
                signOut({ callbackUrl: "/login" });
              }}
              className="w-full flex items-center justify-center p-2 mt-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

export default Sidebar;

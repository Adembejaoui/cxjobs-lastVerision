"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  BarChart3,
  ImageIcon,
  Building2,
  FileText,
  Bell,
  Settings,
  LogOut,
  Search,
  User,
  ChevronLeft,
  ChevronRight,
  X,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import { useState, useCallback } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface UserData {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
}

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: number;
}

interface DashboardSidebarProps {
  userRole?: string;
  user?: UserData;
  className?: string;
}

const companyNavItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard/company" },
  { label: "Manage Jobs", icon: Briefcase, href: "/dashboard/company/jobs" },
  { label: "Analytics", icon: BarChart3, href: "/dashboard/company/analytics" },
  { label: "Media Manager", icon: ImageIcon, href: "/dashboard/company/media" },
  { label: "Company Profile", icon: Building2, href: "/dashboard/company/profile" },
  { label: "Settings", icon: Settings, href: "/dashboard/company/settings" },
];

const candidateNavItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard/candidate" },
  { label: "Browse Jobs", icon: Search, href: "/jobs" },
  { label: "My Applications", icon: FileText, href: "/dashboard/candidate/applications" },
  { label: "Job Alerts", icon: Bell, href: "/dashboard/candidate/alerts" },
  { label: "Profile", icon: User, href: "/dashboard/candidate/profile" },
  { label: "Settings", icon: Settings, href: "/dashboard/candidate/settings" },
];

function getInitials(name?: string | null) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function DashboardSidebar({ userRole, user, className }: DashboardSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const role = userRole || user?.role || "CANDIDATE";
  const navItems = role === "COMPANY" ? companyNavItems : candidateNavItems;

  const isActiveRoute = useCallback(
    (href: string) => {
      if (href === "/dashboard/company" || href === "/dashboard/candidate") {
        return pathname === href;
      }
      return pathname.startsWith(href);
    },
    [pathname]
  );

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col bg-[#071738] text-white transition-all duration-300",
        isCollapsed ? "w-[80px]" : "w-[275px]",
        className
      )}
    >
      {/* Logo Section */}
      <div className="flex items-center justify-between px-6 pt-7 pb-10">
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#0d224d]">
            <div className="absolute inset-0 rounded-full border-2 border-[#46d39a]" />
            <span className="text-lg font-black text-white">✖</span>
          </div>

          <div
            className={cn(
              "overflow-hidden text-[18px] font-extrabold tracking-tight transition-all duration-300",
              isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            )}
          >
            <span className="text-white">CX</span>
            <span className="text-[#39d98a]">JOBS</span>
          </div>
        </Link>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white lg:block"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveRoute(item.href);

            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-4 rounded-2xl px-4 py-3.5 text-[15px] font-medium transition-all",
                    isActive
                      ? "bg-white/6 text-[#47d79d]"
                      : "text-white/75 hover:bg-white/5 hover:text-white",
                    isCollapsed && "justify-center px-2"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-10 w-[3px] -translate-y-1/2 rounded-r-full bg-[#47d79d]" />
                  )}

                  <Icon
                    className={cn(
                      "h-5 w-5 flex-shrink-0 transition-colors",
                      isActive
                        ? "text-[#47d79d]"
                        : "text-white/80 group-hover:text-white"
                    )}
                    strokeWidth={2.2}
                  />

                  <span
                    className={cn(
                      "whitespace-nowrap transition-all duration-300",
                      isCollapsed ? "hidden w-0 opacity-0" : "w-auto opacity-100"
                    )}
                  >
                    {item.label}
                  </span>

                  {item.badge && !isCollapsed && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#47d79d] px-1.5 text-xs font-bold text-[#071738]">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer - User Card */}
      <div className="border-t border-white/10 p-4">
        <div
          className={cn(
            "flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-4 transition-all",
            isCollapsed && "justify-center px-2"
          )}
        >
          {user?.image ? (
            <img
              src={user.image}
              alt={user.name || "User"}
              className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#46d39a] text-sm font-bold text-[#071738]">
              {getInitials(user?.name)}
            </div>
          )}

          <div
            className={cn(
              "min-w-0 flex-1 overflow-hidden transition-all duration-300",
              isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            )}
          >
            <p className="truncate text-sm font-semibold text-white">
              {user?.name || "User"}
            </p>
            <p className="truncate text-xs text-white/55 capitalize">
              {role.toLowerCase()}
            </p>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className={cn(
              "flex-shrink-0 rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white",
              isCollapsed && "hidden"
            )}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

// Mobile Sidebar Component
interface MobileSidebarProps {
  userRole?: string;
  user?: UserData;
}

export function MobileSidebar({ userRole, user }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const role = userRole || user?.role || "CANDIDATE";
  const navItems = role === "COMPANY" ? companyNavItems : candidateNavItems;

  const isActiveRoute = useCallback(
    (href: string) => {
      if (href === "/dashboard/company" || href === "/dashboard/candidate") {
        return pathname === href;
      }
      return pathname.startsWith(href);
    },
    [pathname]
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="fixed left-4 top-4 z-50 lg:hidden"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-[300px] border-r border-white/10 bg-[#071738] p-0"
      >
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>

        {/* Logo */}
        <div className="flex items-center justify-between px-6 pt-7 pb-8">
          <Link
            href="/"
            className="flex items-center gap-3"
            onClick={() => setOpen(false)}
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#0d224d]">
              <div className="absolute inset-0 rounded-full border-2 border-[#46d39a]" />
              <span className="text-lg font-black text-white">✖</span>
            </div>
            <div className="text-[18px] font-extrabold tracking-tight">
              <span className="text-white">CX</span>
              <span className="text-[#39d98a]">JOBS</span>
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActiveRoute(item.href);

              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "group relative flex items-center gap-4 rounded-2xl px-5 py-4 text-[15px] font-medium transition-all",
                      isActive
                        ? "bg-white/6 text-[#47d79d]"
                        : "text-white/75 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-12 w-[4px] -translate-y-1/2 rounded-r-full bg-[#47d79d]" />
                    )}
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        isActive
                          ? "text-[#47d79d]"
                          : "text-white/80 group-hover:text-white"
                      )}
                      strokeWidth={2.2}
                    />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-[#071738] p-4">
          <div className="flex items-center gap-4 rounded-2xl bg-white/5 px-4 py-4">
            {user?.image ? (
              <img
                src={user.image}
                alt={user.name || "User"}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#46d39a] text-sm font-bold text-[#071738]">
                {getInitials(user?.name)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {user?.name || "User"}
              </p>
              <p className="text-xs text-white/55 capitalize">
                {role.toLowerCase()}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

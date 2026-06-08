"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useSession, signOut } from "next-auth/react"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { User, LogOut, Settings, LayoutDashboard, Menu, X } from "lucide-react"
import { useState } from "react"

const navigation = [
  { name: "Find Jobs", href: "/jobs" },
  { name: "Companies", href: "/companies" },
  { name: "About Us", href: "/about" },

]

export function Navbar() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { data: session, status } = useSession()
  const isLoading = status === "loading"
  const user = session?.user

  // Determine dashboard link based on user role
  const getDashboardLink = () => {
    if (!user) return "/login"
    switch (user.role) {
      case "ADMIN":
        return "/dashboard"
      case "COMPANY":
        return "/dashboard/company/jobs"
      case "CANDIDATE":
        return "/dashboard/candidate/applications"
      default:
        return "/dashboard"
    }
  }

  const getDashboardName = () => {
    if (!user) return ""
    switch (user.role) {
      case "ADMIN":
        return "Admin Dashboard"
      case "COMPANY":
        return "My Jobs"
      case "CANDIDATE":
        return "My Applications"
      default:
        return "Dashboard"
    }
  }

  return (
    <header className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-12">
            <Link href="/" className="text-2xl font-bold">
              <span className="text-teal-600">CX</span>Jobs
            </Link>
            <nav className="hidden items-center gap-8 md:flex">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`text-sm font-medium transition-colors hover:text-slate-900 ${
                    pathname === item.href
                      ? "border-b-2 border-teal-600 pb-1 text-slate-900"
                      : "text-slate-600"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
                      {user.image ? (
                        <img src={user.image} alt={user.name || "User"} className="h-8 w-8 rounded-full" />
                      ) : (
                        <User className="h-4 w-4 text-slate-600" />
                      )}
                    </div>
                    <span className="font-medium text-slate-900">{user.name || user.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span>{user.name || "User"}</span>
                      <span className="text-xs font-normal text-slate-500">{user.email}</span>
                      <span className="text-xs font-normal text-teal-600 mt-1">{user.role}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={getDashboardLink()} className="cursor-pointer">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={user.role === "COMPANY" ? "/dashboard/company/profile" : "/dashboard/candidate/profile"} className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="cursor-pointer text-red-600"
                    onClick={() => signOut({ callbackUrl: "/" })}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-slate-900">
                  Log In
                </Link>
                <Link href="/register">
                  <Button className="bg-blue-900 hover:bg-blue-800">Post a Job</Button>
                </Link>
              </>
            )}
            
            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t mt-4">
            <nav className="flex flex-col gap-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`text-sm font-medium transition-colors hover:text-slate-900 ${
                    pathname === item.href
                      ? "text-teal-600"
                      : "text-slate-600"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              {!user && (
                <div className="flex flex-col gap-2 pt-4 border-t">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full">Log In</Button>
                  </Link>
                  <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full bg-blue-900">Post a Job</Button>
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}

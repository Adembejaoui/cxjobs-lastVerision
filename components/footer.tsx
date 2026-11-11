"use client"

import Link from "next/link"
import { useUser } from "@/components/auth/user-provider"

type FooterUser = {
  role?: string
} | null

function getDashboardLink(user: FooterUser) {
  switch (user?.role) {
    case "ADMIN":
      return "/dashboard"
    case "COMPANY":
      return "/dashboard/company"
    case "CANDIDATE":
      return "/dashboard/candidate"
    default:
      return "/dashboard"
  }
}

/** Omit `user` to read the signed-in user from the client session (A10). */
export function Footer({ user: userProp }: { user?: FooterUser }) {
  const sessionUser = useUser()
  const user = userProp !== undefined ? userProp : sessionUser
  const accountHref = user ? getDashboardLink(user) : "/login"
  const accountLabel = user ? "Dashboard" : "Log In"

  return (
    <footer className="border-t bg-[linear-gradient(135deg,#1E3A5F_0%,#162A45_50%,#1E3A5F_100%)] py-12 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="text-xl font-bold text-white">
              <span className="text-teal-400">CX</span> Jobs
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-slate-400">
              CX Jobs connects talent and employers in the customer experience industry.
            </p>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-teal-400">
              Explore
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/jobs" className="hover:text-white">
                  Browse Jobs
                </Link>
              </li>
              <li>
                <Link href="/companies" className="hover:text-white">
                  Explore Companies
                </Link>
              </li>
              <li>
                <Link href="/career-guide" className="hover:text-white">
                  Career Guide
                </Link>
              </li>
            </ul>
          </div>


          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-teal-400">
              Account &amp; Legal
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={accountHref} className="hover:text-white">
                  {accountLabel}
                </Link>
              </li>
              {!user && (
                <li>
                  <Link href="/register" className="hover:text-white">
                    Create Account
                  </Link>
                </li>
              )}
              <li>
                <Link href="/terms" className="hover:text-white">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-700 pt-8">
          <p className="text-center text-xs text-slate-400 sm:text-left">
            <span className="font-semibold tracking-wide text-slate-300">CX JOBS</span> &nbsp;© 2026 CX Jobs. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

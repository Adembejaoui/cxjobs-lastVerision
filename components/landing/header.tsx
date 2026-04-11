"use client"

import Link from "next/link"
import { useState } from "react"

interface LandingHeaderProps {
  palette: {
    navy: string
    navyDark: string
    green: string
    greenSoft: string
    bg: string
    text: string
    muted: string
    border: string
    white: string
  }
}

export function LandingHeader({ palette }: LandingHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-20 w-full border-b bg-white/90 backdrop-blur" style={{ borderColor: palette.border }}>
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="grid h-11 w-11 place-items-center rounded-lg border bg-white shadow-sm" style={{ borderColor: palette.border }}>
              <div className="text-lg font-black tracking-tight">
                <span style={{ color: palette.green }}>CX</span>
                <span style={{ color: palette.navy }}>J</span>
              </div>
            </div>
            <div className="text-xl font-extrabold tracking-tight" style={{ color: palette.navy }}>
              <span style={{ color: palette.green }}>CX</span>Jobs
            </div>
          </Link>
        </div>

        <nav className="hidden items-center gap-9 text-sm font-semibold lg:flex" style={{ color: palette.text }}>
          <Link href="/jobs" className="transition hover:opacity-70">Find Jobs</Link>
          <Link href="/companies" className="transition hover:opacity-70">Companies</Link>
          <Link href="/salaries" className="transition hover:opacity-70">Salaries</Link>
          <Link href="/register" className="transition hover:opacity-70" style={{ color: palette.green }}>For Employers</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:scale-[1.02] sm:block"
            style={{ backgroundColor: palette.navy }}
          >
            Sign In
          </Link>
          <button 
            className="grid h-10 w-10 place-items-center rounded-xl border lg:hidden"
            style={{ borderColor: palette.border }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span className="text-lg">{mobileMenuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-t bg-white lg:hidden" style={{ borderColor: palette.border }}>
          <nav className="mx-auto flex max-w-[1180px] flex-col gap-1 px-6 py-4">
            <Link 
              href="/jobs" 
              className="rounded-lg px-4 py-3 text-sm font-semibold transition hover:bg-slate-50"
              style={{ color: palette.text }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Find Jobs
            </Link>
            <Link 
              href="/companies" 
              className="rounded-lg px-4 py-3 text-sm font-semibold transition hover:bg-slate-50"
              style={{ color: palette.text }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Companies
            </Link>
            <Link 
              href="/salaries" 
              className="rounded-lg px-4 py-3 text-sm font-semibold transition hover:bg-slate-50"
              style={{ color: palette.text }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Salaries
            </Link>
            <Link 
              href="/register" 
              className="rounded-lg px-4 py-3 text-sm font-semibold transition hover:bg-slate-50"
              style={{ color: palette.green }}
              onClick={() => setMobileMenuOpen(false)}
            >
              For Employers
            </Link>
            <Link 
              href="/login" 
              className="mt-2 rounded-xl px-4 py-3 text-center text-sm font-bold text-white"
              style={{ backgroundColor: palette.navy }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign In
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}

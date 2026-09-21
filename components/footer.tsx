"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t bg-[linear-gradient(135deg,#1E3A5F_0%,#162A45_50%,#1E3A5F_100%)] py-12 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-teal-400">
              Job Seekers
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/jobs" className="hover:text-white">
                  Search Jobs
                </Link>
              </li>
              <li>
                <a href="#" className="hover:text-white">
                  Resume Builder
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white">
                  Salary Calculator
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-teal-400">
              Employers
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-white">
                  Post a Job
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white">
                  Hiring Solutions
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white">
                  Pricing
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-teal-400">
              Support
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-white">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white">
                  Contact Us
                </a>
              </li>
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
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-teal-400">
              Subscribe to Alerts
            </h4>
            <div className="flex gap-2">
              <Input
                placeholder="Your email"
                className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
              />
              <Button className="bg-teal-500 hover:bg-teal-600 px-3">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-700 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-xs text-slate-400">
              CX JOBS &nbsp; © 2024 CX Jobs Inc. all rights reserved.
            </p>
            <div className="flex gap-4 text-xs text-slate-400">
              <a href="#" className="hover:text-white">
                TWITTER
              </a>
              <a href="#" className="hover:text-white">
                LINKEDIN
              </a>
              <a href="#" className="hover:text-white">
                FACEBOOK
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

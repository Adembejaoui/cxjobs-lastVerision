"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function FeaturedEmployer() {
  return (
    <Card className="border-0 bg-[linear-gradient(135deg,#1E3A5F_0%,#162A45_50%,#1E3A5F_100%)] p-6 text-white overflow-hidden relative">
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-teal-500/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
      
      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wide text-teal-400">
            Featured RPO
          </div>
          <div className="px-2 py-1 bg-teal-500/20 rounded text-xs font-medium text-teal-300">
            Hiring Now
          </div>
        </div>
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <span className="text-3xl">🎓</span>
          </div>
          <div>
            <h3 className="text-lg font-bold">Velocity Retail Partners</h3>
            <p className="text-xs text-blue-200">Global Outsourcing Solutions</p>
          </div>
        </div>
        
        <p className="mb-4 text-sm leading-relaxed text-blue-100">
          We're hiring <span className="text-teal-400 font-bold">200+ agents</span> this month! 
          Join our team and work with world-class brands.
        </p>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-teal-400">200+</div>
            <div className="text-xs text-blue-200">Openings</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-teal-400">$500</div>
            <div className="text-xs text-blue-200">Bonus</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-teal-400">Day 1</div>
            <div className="text-xs text-blue-200">HMO</div>
          </div>
        </div>
        
        <ul className="mb-6 space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span className="text-teal-400">✓</span> Signing Bonus up to $500
          </li>
          <li className="flex items-center gap-2">
            <span className="text-teal-400">✓</span> HMO on Day 1
          </li>
          <li className="flex items-center gap-2">
            <span className="text-teal-400">✓</span> Night Differential Pay
          </li>
          <li className="flex items-center gap-2">
            <span className="text-teal-400">✓</span> Professional Growth
          </li>
        </ul>
        <Button className="w-full bg-teal-500 hover:bg-teal-600 font-semibold">Apply Now</Button>
      </div>
    </Card>
  )
}

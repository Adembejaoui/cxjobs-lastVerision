'use client'

import React from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

interface CompanyData {
  name: string
  logoUrl?: string | null
  location?: string | null
  companySize?: string | null
  industry?: string | null
}

interface HeroProps {
  company: CompanyData
}

export function Hero({ company }: HeroProps) {
  const getCompanySizeDisplay = (size: string | null | undefined): string => {
    switch (size) {
      case 'STARTUP':
        return '1-10 employees'
      case 'SMALL':
        return '11-50 employees'
      case 'MEDIUM':
        return '51-200 employees'
      case 'LARGE':
        return '201-1000 employees'
      case 'ENTERPRISE':
        return '1000+ employees'
      default:
        return '50+ employees'
    }
  }

  return (
    <section className="relative h-96 bg-gradient-to-b from-primary/20 to-primary/5 overflow-hidden">
      {/* Background pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute right-0 top-0 w-1/2 h-full">
          <Image
            src="https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&h=600&fit=crop"
            alt="Office building"
            fill
            className="object-cover object-right"
            priority
          />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 h-full flex items-center">
        <div className="flex items-end gap-6 w-full">
          {/* Company Logo */}
          <div className="w-24 h-24 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg border-4 border-background">
            {company.logoUrl ? (
              <img 
                src={company.logoUrl} 
                alt={company.name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <span className="text-sm font-bold text-center px-2">
                {company.name.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          {/* Text Content */}
          <div className="flex-1 pb-4">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              {company.name}
            </h1>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2 text-foreground">
                <span className="text-lg">📍</span>
                <span>{company.location || 'Location TBD'}</span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <span className="text-lg">👥</span>
                <span>{getCompanySizeDisplay(company.companySize)}</span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <span className="text-lg">⭐</span>
                <span>Rated 4.5</span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <span className="text-lg">🏢</span>
                <span>{company.industry || 'Technology'}</span>
              </div>
            </div>
          </div>

          {/* Follow Button */}
          <Button 
            className="bg-primary text-primary-foreground hover:bg-primary/90 mb-4 flex-shrink-0"
            size="lg"
          >
            Follow Company
          </Button>
        </div>
      </div>
    </section>
  )
}

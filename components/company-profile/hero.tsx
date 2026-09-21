'use client'

import React from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

/* eslint-disable @next/next/no-img-element */

interface CompanyData {
  name: string
  logoUrl?: string | null
  location?: string | null
  companySize?: string | null
}

interface HeroProps {
  company: CompanyData
}

export function Hero({ company }: HeroProps) {
  const getCompanySizeDisplay = (size: string | null | undefined): string => {
    return size ? `${size} employees` : 'Size not set';
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
          <div className="w-40 h-36 bg-white border border-border rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
            {company.logoUrl ? (
              <img 
                src={company.logoUrl} 
                alt={company.name}
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <span className="text-sm font-bold text-center px-2 text-muted-foreground">
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

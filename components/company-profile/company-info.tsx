import React from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Heart, MapPin, Calendar, Users } from 'lucide-react'

/* eslint-disable @next/next/no-img-element */

interface CompanyInfoProps {
  name: string
  logoUrl?: string | null
  location?: string | null
  companySize?: string | null
  foundedYear?: number | null
  showActions?: boolean
}

export function CompanyInfo({ 
  name, 
  logoUrl, 
  location, 
  companySize, 


  foundedYear,
  showActions = true 
}: CompanyInfoProps) {
  const getCompanySizeDisplay = (size: string | null | undefined): string => {
    return size || '50+';
  }

  return (
    <Card className="px-6 py-6 border border-border shadow-sm  relative z-10 mx-4 md:mx-8 lg:mx-auto lg:max-w-7xl">
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="flex gap-6 items-start flex-1">
          {/* Company Logo - Larger size */}
          <div className="w-28 h-28 md:w-36 md:h-36 bg-white border border-border rounded-2xl flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={name}
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <span className="text-2xl md:text-4xl font-bold text-center text-muted-foreground">
                {name.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          {/* Company Details */}
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
              {name}
            </h1>
            <div className="flex flex-wrap gap-3 items-center">
              {location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{location}</span>
                </div>
              )}
              
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              <Users className="h-4 w-4 text-muted-foreground mr-1" />
                {getCompanySizeDisplay(companySize)} employees
              </Badge>
              {foundedYear && (
                
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  <Calendar className="h-4 w-4 text-muted-foreground mr-1" />
                  Founded {foundedYear}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {showActions && (
          <div className="flex gap-3 mt-4 md:mt-0">
            <Button variant="outline" size="icon" className="hover:bg-primary/10">
              <Heart className="h-5 w-5" />
            </Button>
        
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              Follow Company
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
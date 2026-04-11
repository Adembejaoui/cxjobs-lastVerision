import React from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Heart, Share2, Star } from 'lucide-react'

interface CompanyInfoProps {
  name: string
  logoUrl?: string | null
  location?: string | null
  companySize?: string | null
  industry?: string | null
  rating?: number
  reviewCount?: number
  foundedYear?: number | null
  showActions?: boolean
}

export function CompanyInfo({ 
  name, 
  logoUrl, 
  location, 
  companySize, 
  industry, 
  rating = 4.5,
  reviewCount = 125,
  foundedYear,
  showActions = true 
}: CompanyInfoProps) {
  const getCompanySizeDisplay = (size: string | null | undefined): string => {
    switch (size) {
      case 'STARTUP':
        return '1-10'
      case 'SMALL':
        return '11-50'
      case 'MEDIUM':
        return '51-200'
      case 'LARGE':
        return '201-1000'
      case 'ENTERPRISE':
        return '1000+'
      default:
        return '50+'
    }
  }

  return (
    <Card className="px-6 py-6 border border-border shadow-sm -mt-12 relative z-10 mx-4 md:mx-8 lg:mx-auto lg:max-w-7xl">
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="flex gap-6 items-start flex-1">
          {/* Company Logo - Larger size */}
          <div className="w-24 h-24 md:w-32 md:h-32 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg border-4 border-background">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={name}
                className="w-full h-full object-cover rounded-xl"
              />
            ) : (
              <span className="text-2xl md:text-4xl font-bold text-center">
                {name.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          {/* Company Details */}
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
              {name}
            </h1>
            <p className="text-muted-foreground text-lg mb-3">
              {industry || 'Technology Company'}
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                <span className="font-semibold text-foreground">{rating}</span>
                <span className="text-muted-foreground text-sm">({reviewCount} reviews)</span>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                {getCompanySizeDisplay(companySize)} employees
              </Badge>
              {foundedYear && (
                <Badge variant="secondary" className="bg-secondary/10 text-secondary border-secondary/20">
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
            <Button variant="outline" size="icon" className="hover:bg-primary/10">
              <Share2 className="h-5 w-5" />
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

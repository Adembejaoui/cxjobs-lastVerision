import React from 'react'
import { Card } from '@/components/ui/card'

interface AboutSectionProps {
  description?: string | null
  mission?: string | null
}

export function AboutSection({ description, mission }: AboutSectionProps) {
  
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-6 pb-3 border-l-4 border-primary">
          About Us
        </h2>
        
        {/* Mission Statement */}
        {mission && (
          <div className="mb-6 p-4 rounded-lg border-l-4 border-primary">
            <p className="text-primary font-medium italic">{mission}</p>
          </div>
        )}
        
        {/* Description */}
        <p className="text-muted-foreground leading-relaxed">
          {description ? description : 'No description provided for this company.'}
        </p>
      </div>
    </section>
  )
}

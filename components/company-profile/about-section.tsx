import React from 'react'

interface AboutSectionProps {
  description?: string | null
}

export function AboutSection({ description }: AboutSectionProps) {
   
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl  font-bold text-foreground mb-6 pb-3  ">
          About Us
        </h2>
        
        {/* Description */}
        <p className="text-muted-foreground leading-relaxed">
          {description ? description : 'No description provided for this company.'}
        </p>
      </div>
    </section>
  )
}

import React from 'react'
import { Card } from '@/components/ui/card'

interface Benefit {
  icon: string
  title: string
  description: string
}

interface BenefitsSectionProps {
  benefits?: string[] | null
}

export function BenefitsSection({ benefits }: BenefitsSectionProps) {
  const staticBenefits: Benefit[] = [
    {
      icon: '🎓',
      title: 'Training Programs',
      description: 'Paid foundational and continuous upskilling workshops.'
    },
    {
      icon: '📈',
      title: 'Clear Career Paths',
      description: 'Structured internal mobility plans for lead & manager roles.'
    },
    {
      icon: '⚕️',
      title: 'Premium Healthcare',
      description: 'Comprehensive medical and dental insurance from Day 1.'
    },
    {
      icon: '☕',
      title: 'On-site Perks',
      description: 'Free coffee, sleeping quarters, and recreation zones.'
    },
    {
      icon: '🏋️',
      title: 'Wellness Programs',
      description: 'Gym memberships and mental health support available.'
    },
    {
      icon: '🎉',
      title: 'Team Events',
      description: 'Regular team building activities and company celebrations.'
    }
  ]

  // Use dynamic benefits if provided, otherwise fall back to static
  const displayBenefits = benefits && benefits.length > 0 
    ? benefits.map((b, i) => ({
        icon: ['🎓', '📈', '⚕️', '☕', '🏋️', '🎉'][i % 6],
        title: b,
        description: 'Employee benefit provided by the company.'
      }))
    : staticBenefits

  return (
    <section className="space-y-6">
      <h3 className="text-2xl font-bold text-foreground pb-3  flex items-center gap-2">
        <span>💼</span> Employee Benefits
      </h3>
      <div className="flex flex-col gap-3">
        {displayBenefits.map((benefit, idx) => (
          <Card key={idx} className="p-4 hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <span className="text-2xl flex-shrink-0">{benefit.icon}</span>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground">{benefit.title}</h4>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}

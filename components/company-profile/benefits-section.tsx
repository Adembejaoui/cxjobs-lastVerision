
import { Card } from '@/components/ui/card'
import { DynamicIcon } from '@/lib/icon-map'

interface Benefit {
  id: string
  icon: string | null
  title: string
  description: string | null
}

interface BenefitsSectionProps {
  benefits?: Benefit[] | null
}

export function BenefitsSection({ benefits }: BenefitsSectionProps) {
  const staticBenefits: Benefit[] = [
    {
      id: 'static-training-programs',
      icon: 'award',
      title: 'Training Programs',
      description: 'Paid foundational and continuous upskilling workshops.'
    },
    {
      id: 'static-career-paths',
      icon: 'trending-up',
      title: 'Clear Career Paths',
      description: 'Structured internal mobility plans for lead & manager roles.'
    },
    {
      id: 'static-healthcare',
      icon: 'heart',
      title: 'Premium Healthcare',
      description: 'Comprehensive medical and dental insurance from Day 1.'
    },
    {
      id: 'static-perks',
      icon: 'coffee',
      title: 'On-site Perks',
      description: 'Free coffee, sleeping quarters, and recreation zones.'
    },
    {
      id: 'static-wellness',
      icon: 'sparkles',
      title: 'Wellness Programs',
      description: 'Gym memberships and mental health support available.'
    },
    {
      id: 'static-team-events',
      icon: 'gift',
      title: 'Team Events',
      description: 'Regular team building activities and company celebrations.'
    }
  ]

  const displayBenefits =
    benefits && benefits.length > 0 ? benefits : staticBenefits




  return (
    <section className="space-y-6">
      <h3 className="text-2xl font-bold text-foreground pb-3 flex items-center gap-2">
        <span>💼</span> Employee Benefits
      </h3>
      <div className="flex flex-col gap-3">
        {displayBenefits.map((benefit) => {
          return (
            <Card
              key={benefit.id}
              className="p-4 hover:shadow-md transition cursor-pointer"

            >
              <div className="flex items-center gap-3 select-none">
                <span className="text-2xl flex-shrink-0">
                  {benefit.icon ? (
                    <DynamicIcon name={benefit.icon} className="h-6 w-6" />
                  ) : (
                    <span>💼</span>
                  )}
                </span>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">
                    {benefit.title}
                  </h4>
                </div>
              </div>

            </Card>
          )
        })} 
      </div>
    </section>
  )
}

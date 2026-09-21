import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Briefcase } from 'lucide-react'

interface JobOpening {
  title: string
  location: string
  salary?: string | null
  contractType?: string
  activityType?: string | null
  activityCustom?: string | null
}

interface JobOpeningsProps {
  jobs?: JobOpening[]
  totalCount?: number
}

function activityTypeLabel(type: string | null | undefined, custom: string | null | undefined): string {
  if (!type) return ''
  const labels: Record<string, string> = {
    CUSTOMER_SERVICE: 'Customer Service',
    SALES_LEAD_GENERATION: 'Sales & Lead Generation',
    TECHNICAL_IT_SUPPORT: 'Technical & IT Support',
    DEBT_COLLECTION_LITIGATION: 'Debt Collection & Litigation',
    BACK_OFFICE_DIGITAL_SERVICES: 'Back-office & Digital Services',
    SURVEYS_MARKET_RESEARCH: 'Surveys & Market Research',
    OTHER: custom || 'Other',
  }
  return labels[type] || type
}

export function JobOpenings({ jobs, totalCount }: JobOpeningsProps) {
  const hasJobs = jobs && jobs.length > 0
  const count = totalCount || (hasJobs ? jobs!.length : 0)

  const getStatusBadgeColor = (status: string | undefined) => {
    switch (status?.toUpperCase()) {
      case 'IMMEDIATE':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'HOT JOB':
        return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'FULL-TIME':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      default:
        return 'bg-secondary text-secondary-foreground border-border'
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-foreground pb-3 ">
          Active Job Openings
        </h2>
        {hasJobs && (
          <span className="text-sm font-semibold text-muted-foreground bg-muted px-3 py-1 rounded">
            {count} Open Role{count !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {hasJobs ? (
        <div className="space-y-3">
          {jobs!.map((job, idx) => (
            <Card key={idx} className="p-5 hover:shadow-md transition border border-border">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="font-semibold text-foreground text-lg">{job.title}</h3>
                    {job.contractType && (
                      <Badge 
                        variant="outline" 
                        className={`text-xs font-bold ${getStatusBadgeColor(job.contractType)}`}
                      >
                        {job.contractType}
                      </Badge>
                    )}
                    {job.activityType && (
                      <Badge 
                        variant="outline" 
                        className="text-xs font-bold bg-purple-50 text-purple-700 border-purple-200"
                      >
                        {activityTypeLabel(job.activityType, job.activityCustom)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <span>📍 {job.location}</span>
                    {job.salary && <span>💰 {job.salary}</span>}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-10 border border-border text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-muted p-4">
              <Briefcase className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                No open positions right now
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                This company doesn&apos;t have any active job openings at the moment. 
                Check back later or explore other companies.
              </p>
            </div>
          </div>
        </Card>
      )}

      {hasJobs && (
        <Button 
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base font-semibold"
        >
          View All Open Positions
        </Button>
      )}
    </section>
  )
}

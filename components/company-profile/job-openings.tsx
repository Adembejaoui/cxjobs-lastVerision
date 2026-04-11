import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface JobOpening {
  title: string
  location: string
  salary?: string | null
  contractType?: string
}

interface JobOpeningsProps {
  jobs?: JobOpening[]
  totalCount?: number
}

export function JobOpenings({ jobs, totalCount }: JobOpeningsProps) {
  const staticJobs: JobOpening[] = [
    {
      title: 'Bilingual Client Success Lead (FR/EN)',
      location: 'Miami, FL (on-site)',
      salary: '$5,100/mo',
      contractType: 'FULL-TIME'
    },
    {
      title: 'Senior Technical Support Associate',
      location: 'Remote',
      salary: '$4,500/mo',
      contractType: 'HOT JOB'
    },
    {
      title: 'Team Lead - Customer Operations',
      location: 'Chicago, IL (Hybrid)',
      salary: '$5,800/mo',
      contractType: 'IMMEDIATE'
    }
  ]

  const displayJobs = jobs && jobs.length > 0 ? jobs : staticJobs
  const count = totalCount || displayJobs.length

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
        <h2 className="text-3xl font-bold text-foreground pb-3 border-l-4 border-primary">
          Active Job Openings
        </h2>
        <span className="text-sm font-semibold text-muted-foreground bg-muted px-3 py-1 rounded">
          {count} Open Role{count !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {displayJobs.map((job, idx) => (
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

      <Button 
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base font-semibold"
      >
        View All Open Positions
      </Button>
    </section>
  )
}

import { Suspense } from 'react'
import JobsPageClient from './JobsPageClient'

export const metadata = {
  title: 'Browse Jobs | CXJobs',
  description: 'Find your next opportunity with thousands of job listings in the CX industry',
}

// ISR Configuration - cache for 5 minutes, allow client to fetch initial data
export const revalidate = 300;

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen px-4 py-5">Loading jobs...</div>}>
      <JobsPageClient />
    </Suspense>
  )
}

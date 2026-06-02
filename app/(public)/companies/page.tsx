import CompaniesPageClient from './CompaniesPageClient'

export const metadata = {
  title: 'Browse Companies | CXJobs',
  description: 'Explore top-rated companies in the CX industry and find your ideal workplace',
}

// ISR Configuration - cache for 10 minutes
export const revalidate = 600;

export default function CompaniesPage() {
  return <CompaniesPageClient />
}

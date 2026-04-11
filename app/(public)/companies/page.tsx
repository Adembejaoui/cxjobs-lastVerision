import CompaniesPageClient from './CompaniesPageClient'
import prisma from '@/lib/prisma'

export const metadata = {
  title: 'Browse Companies | CXJobs',
  description: 'Explore top-rated companies in the CX industry and find your ideal workplace',
}

export default async function CompaniesPage() {
  // Fetch initial companies from database
  const companies = await prisma.company.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logoUrl: true,
      coverImageUrl: true,
      industry: true,
      companySize: true,
      location: true,
      createdAt: true,
      _count: {
        select: { jobs: true },
      },
    },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  // Get total count
  const totalCompanies = await prisma.company.count({
    where: {
      deletedAt: null,
    },
  });

  return <CompaniesPageClient initialCompanies={companies} totalCompanies={totalCompanies} />
}

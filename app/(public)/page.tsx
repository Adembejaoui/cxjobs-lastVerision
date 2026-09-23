import CXHeroSearch from "@/components/landing/cx-hero-search";
import { CoverflowCarousel } from "@/components/landing/coverflow-carousel";
import prisma from "@/lib/prisma";

async function getFeaturedCompanies() {
  const companies = await prisma.companies.findMany({
    where: {
      deletedAt: null,
      logoUrl: { not: null },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      location: true,
      foundedYear: true,
    },
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  return companies.map((company) => ({
    src: company.logoUrl!,
    alt: `${company.name} - Customer Experience Company`,
    companyName: company.name,
    foundedYear: company.foundedYear || new Date().getFullYear(),
    location: company.location || "Global",
  }));
}



export default async function CXJobsLandingPage() {
  const slides = await getFeaturedCompanies();
  const displaySlides = slides.length > 0 ? slides : [];

  return (
    <main className="flex min-h-screen flex-col bg-slate-50">
      <CXHeroSearch />
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-[#1f3d73] md:text-4xl">
              Featured Companies
            </h2>
            <p className="mt-2 text-[#4d5f7c] max-w-2xl mx-auto">
              Explore our curated selection of customer experience employers
              across global markets
            </p>
          </div>
          <CoverflowCarousel
            slides={displaySlides}
            showCaption
            showNavigation
            showPagination
            loop
            cardWidth="clamp(100px, 20vw, 200px)"
            label="Featured CX Companies"
          />
        </div>
      </section>
    </main>
  );
}

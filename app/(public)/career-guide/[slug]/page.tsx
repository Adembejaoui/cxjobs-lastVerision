import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Lightbulb, Clock, BookOpen } from "lucide-react";
import { getCareerGuide, getAllCareerGuides } from "@/lib/career-guides";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CareerGuidePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CareerGuidePageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const guide = getCareerGuide(resolvedParams.slug);
  
  if (!guide) {
    return { title: "Guide Not Found | CXJobs" };
  }
  
  return {
    title: `${guide.title} | CXJobs Career Guide`,
    description: guide.fullDescription,
    openGraph: {
      title: guide.title,
      description: guide.fullDescription,
      type: "article",
    },
  };
}

export async function generateStaticParams() {
  const guides = getAllCareerGuides();
  return guides.map((guide) => ({ slug: guide.slug }));
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
      <div className="mt-2 h-1 w-16 rounded-full bg-teal-600" />
    </div>
  );
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
      <div className="flex gap-3">
        <Lightbulb className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
        <div className="text-sm text-amber-800">{children}</div>
      </div>
    </div>
  );
}

export default async function CareerGuideDetailPage({ params }: CareerGuidePageProps) {
  const resolvedParams = await params;
  const guide = getCareerGuide(resolvedParams.slug);

  if (!guide) {
    notFound();
  }

  const Icon = guide.icon;
  const allGuides = getAllCareerGuides();
  const currentIndex = allGuides.findIndex((g) => g.slug === guide.slug);
  const prevGuide = currentIndex > 0 ? allGuides[currentIndex - 1] : null;
  const nextGuide = currentIndex < allGuides.length - 1 ? allGuides[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Back Navigation */}
      <nav className="bg-white border-b border-slate-200" aria-label="Breadcrumb">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/career-guide"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-teal-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Career Guide
          </Link>
        </div>
      </nav>

      {/* Article Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${guide.color.replace("text-", "bg-").replace("600", "100")} ${guide.color}`}>
              <Icon className="h-6 w-6" strokeWidth={2} />
            </div>
            <div>
              <BookOpen className="h-4 w-4 text-teal-600" />
              <span className="ml-2 text-sm font-medium text-slate-600">Career Guide</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl mb-6">
            {guide.title}
          </h1>
          <p className="text-lg text-slate-600 mb-8 max-w-2xl">
            {guide.fullDescription}
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>{guide.readingTime}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-xs">
                {guide.sections.length} Sections
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-xs">
                {guide.keyTakeaways.length} Key Takeaways
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Article Content */}
      <article className="py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="prose prose-slate max-w-none">
            {guide.sections.map((section, sectionIndex) => (
              <section key={sectionIndex} className="mb-12 pb-8 last:mb-0 last:pb-0 border-b border-slate-100 last:border-0">
                <SectionTitle title={section.title} />
                
                <div className="space-y-5 text-slate-700 leading-relaxed">
                  {section.content.map((paragraph, paraIndex) => (
                    <p key={paraIndex} className="text-base">
                      {paragraph}
                    </p>
                  ))}

                  {section.tips && section.tips.length > 0 && (
                    <div className="space-y-3 mt-6">
                      {section.tips.map((tip, tipIndex) => (
                        <TipBox key={tipIndex}>{tip}</TipBox>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            ))}

            {/* Key Takeaways */}
            <section className="mt-12 pt-8 border-t border-slate-200">
              <SectionTitle title="Key Takeaways" />
              <ul className="space-y-3" role="list">
                {guide.keyTakeaways.map((takeaway, index) => (
                  <li key={index} className="flex gap-3">
                    <CheckCircle className="h-5 w-5 flex-shrink-0 text-teal-600 mt-0.5" />
                    <span className="text-slate-700">{takeaway}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </article>

      {/* Navigation */}
      <nav className="bg-white border-t border-slate-200" aria-label="Guide navigation">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {prevGuide ? (
              <Link
                href={`/career-guide/${prevGuide.slug}`}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-teal-300 hover:text-teal-600 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Previous: {prevGuide.title}</span>
              </Link>
            ) : (
              <div className="flex-1" />
            )}
            
            <Link
              href="/career-guide"
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-teal-300 hover:text-teal-600 transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              All Guides
            </Link>
            
            {nextGuide ? (
              <Link
                href={`/career-guide/${nextGuide.slug}`}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-teal-300 hover:text-teal-600 transition-colors"
              >
                <span>Next: {nextGuide.title}</span>
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </Link>
            ) : (
              <div className="flex-1" />
            )}
          </div>
        </div>
      </nav>

      {/* Related Guides */}
      <section className="bg-slate-50 py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">
            Explore More Guides
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {allGuides
              .filter((g) => g.slug !== guide.slug)
              .map((relatedGuide) => {
                const RelatedIcon = relatedGuide.icon;
                return (
                  <Link
                    key={relatedGuide.slug}
                    href={`/career-guide/${relatedGuide.slug}`}
                    className="group block"
                  >
                    <Card className="h-full transition-all duration-300 hover:shadow-lg">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div
                            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${relatedGuide.color.replace("text-", "bg-").replace("600", "100")} ${relatedGuide.color}`}
                          >
                            <RelatedIcon className="h-5 w-5" strokeWidth={2} />
                          </div>
                          <span className="text-sm text-slate-500 flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {relatedGuide.readingTime}
                          </span>
                        </div>
                        <CardTitle className="mt-3 text-lg font-semibold text-slate-900 group-hover:text-teal-600 transition-colors">
                          {relatedGuide.title}
                        </CardTitle>
                        <CardDescription className="text-sm text-slate-600">
                          {relatedGuide.shortDescription}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                );
              })}
          </div>
        </div>
      </section>
    </div>
  );
}
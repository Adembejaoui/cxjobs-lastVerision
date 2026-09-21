import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, BookOpen } from "lucide-react";
import { getAllCareerGuides } from "@/lib/career-guides";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Career Guide | CXJobs",
  description:
    "Explore expert career guides to improve your job search, ace interviews, and build a strong professional profile.",
};

export default function CareerGuidePage() {
  const guides = getAllCareerGuides();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-4 py-1.5 text-sm font-medium text-teal-700 mb-6">
              <BookOpen className="h-4 w-4" />
              Career Guide
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Career Guides for Job Seekers
            </h1>
            <p className="mt-6 text-lg text-slate-600">
              Expert advice to help you find the right job, succeed in interviews,
              and build a professional profile that attracts recruiters.
            </p>
          </div>
        </div>
      </section>

      {/* Guides Grid */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((guide) => {
              const Icon = guide.icon;
              return (
                <Link
                  key={guide.slug}
                  href={`/career-guide/${guide.slug}`}
                  className="group block"
                >
                  <Card className={`h-full transition-all duration-300 hover:shadow-lg border-slate-200 ${guide.bgColor}`}>
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div
                          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${guide.color.replace("text-", "bg-").replace("600", "100")} text-teal-600 group-hover:scale-110 transition-transform`}
                        >
                          <Icon className="h-6 w-6" strokeWidth={2} />
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-slate-500">
                          <Clock className="h-4 w-4" />
                          <span>{guide.readingTime}</span>
                        </div>
                      </div>
                      <CardTitle className="mt-4 text-xl font-semibold text-slate-900 group-hover:text-teal-600 transition-colors">
                        {guide.title}
                      </CardTitle>
                      <CardDescription className="text-base text-slate-600">
                        {guide.shortDescription}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ul className="space-y-3 text-sm text-slate-600" role="list">
                        {guide.sections.slice(0, 4).map((section, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                            {section.title}
                          </li>
                        ))}
                        {guide.sections.length > 4 && (
                          <li className="flex items-center gap-2 text-teal-600 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                            +{guide.sections.length - 4} more sections
                          </li>
                        )}
                      </ul>
                    </CardContent>
                    <CardFooter className="pt-4 border-t border-slate-100">
                      <Button
                        variant="outline"
                        className="w-full group-hover:bg-teal-50 group-hover:border-teal-300 group-hover:text-teal-700 transition-colors"
                      >
                        Read Guide
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </CardFooter>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* CTA */}
          <div className="mt-16 text-center">
            <p className="text-slate-600">
              More guides coming soon. Check back regularly for new content!
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
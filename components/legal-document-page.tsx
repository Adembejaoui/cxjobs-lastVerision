import { Metadata } from "next";
import Link from "next/link";
import { FileText, Scale, Shield } from "lucide-react";
import { LegalDocument } from "@/data/legal-documents";
import { Badge } from "@/components/ui/badge";

interface LegalDocumentPageProps {
  document: LegalDocument;
}

export function generateLegalMetadata(document: LegalDocument): Metadata {
  return {
    title: `${document.title} | CXJobs`,
    description: document.description,
    openGraph: {
      title: document.title,
      description: document.description,
      type: "article",
    },
  };
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      <div className="mt-2 h-1 w-16 rounded-full bg-teal-600" />
    </div>
  );
}

export function LegalDocumentPage({ document }: LegalDocumentPageProps) {
  const relatedDocuments = [
    {
      slug: "terms",
      title: "Terms of Service",
      description:
        "Define the terms and conditions for using the CXJobs website and platform services.",
      icon: Scale,
    },
    {
      slug: "privacy",
      title: "Privacy Policy",
      description:
        "Learn how CXJobs collects, uses, stores, and protects your personal data.",
      icon: Shield,
    },
  ].filter((doc) => doc.slug !== document.slug);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Article Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <FileText className="h-6 w-6" strokeWidth={2} />
            </div>
            <div>
              <span className="text-sm font-medium text-slate-600">
                Legal Document
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl mb-6">
            {document.title}
          </h1>
          <p className="text-lg text-slate-600 mb-8 max-w-2xl">
            {document.description}
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-xs">
                {document.sections.length} Sections
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Last updated: {document.lastUpdated}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Article Content */}
      <article className="py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-12">
            {document.sections.map((section) => (
              <section key={section.id} className="scroll-mt-20">
                <SectionTitle title={section.title} />

                <div className="space-y-5 text-slate-700 leading-relaxed">
                  {section.content.map((paragraph, paraIndex) => {
                    if (paragraph === "") {
                      return <div key={paraIndex} className="h-2" />;
                    }
                    return (
                      <p key={paraIndex} className="text-base">
                        {paragraph}
                      </p>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </article>

      {/* Related Documents */}
      {relatedDocuments.length > 0 && (
        <section className="bg-white border-t border-slate-200 py-12 sm:py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">
              Related Legal Documents
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {relatedDocuments.map((related) => {
                const RelatedIcon = related.icon;
                return (
                  <Link
                    key={related.slug}
                    href={`/${related.slug}`}
                    className="group block"
                  >
                    <div className="rounded-xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:shadow-lg hover:border-teal-300">
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600 group-hover:bg-teal-100 transition-colors">
                          <RelatedIcon className="h-5 w-5" strokeWidth={2} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-slate-900 group-hover:text-teal-600 transition-colors">
                            {related.title}
                          </h3>
                          <p className="mt-1 text-sm text-slate-600">
                            {related.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
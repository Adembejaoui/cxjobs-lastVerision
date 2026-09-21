import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLegalDocument } from "@/data/legal-documents";
import { LegalDocumentPage, generateLegalMetadata } from "@/components/legal-document-page";

export async function generateMetadata(): Promise<Metadata> {
  const document = getLegalDocument("terms");
  if (!document) {
    return { title: "Terms of Service | CXJobs" };
  }
  return generateLegalMetadata(document);
}

export default function TermsPage() {
  const document = getLegalDocument("terms");

  if (!document) {
    notFound();
  }

  return <LegalDocumentPage document={document} />;
}
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLegalDocument } from "@/data/legal-documents";
import { LegalDocumentPage, generateLegalMetadata } from "@/components/legal-document-page";

export async function generateMetadata(): Promise<Metadata> {
  const document = getLegalDocument("privacy");
  if (!document) {
    return { title: "Privacy Policy | CXJobs" };
  }
  return generateLegalMetadata(document);
}

export default function PrivacyPage() {
  const document = getLegalDocument("privacy");

  if (!document) {
    notFound();
  }

  return <LegalDocumentPage document={document} />;
}
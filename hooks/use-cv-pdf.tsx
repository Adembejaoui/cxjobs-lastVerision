"use client";

import { useState, useCallback, useMemo } from "react";
import { pdf } from "@react-pdf/renderer";
import { CVPDFDocument, Candidate } from "@/components/cv/cv-pdf-document";
import { logger } from "@/lib/logger";

interface UseCVPDFOptions {
  candidate: Candidate;
  watermarkSrc?: string | null;
}

interface UseCVPDFReturn {
  generatePDF: () => Promise<boolean>;
  isGenerating: boolean;
  error: string | null;
}

export function useCVPDF({ candidate, watermarkSrc }: UseCVPDFOptions): UseCVPDFReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveWatermarkSrc = useCallback(async (): Promise<string | null> => {
    const src = watermarkSrc?.trim();
    if (!src) return null;
    if (src.startsWith("data:")) return src;

    const response = await fetch(src, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch watermark image: ${response.status}`);
    }

    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }
        reject(new Error("Failed to read watermark image as data URL"));
      };
      reader.onerror = () => reject(new Error("Failed to convert watermark image"));
      reader.readAsDataURL(blob);
    });
  }, [watermarkSrc]);

  const sanitizedCandidate = useMemo(() => {
    return {
      ...candidate,
      firstName: candidate.firstName || null,
      lastName: candidate.lastName || null,
      summary: candidate.summary || null,
      location: candidate.location || null,
      phone: candidate.phone || null,
      avatarUrl: candidate.avatarUrl || null,
      linkedinUrl: candidate.linkedinUrl || null,
      targetJobRole: candidate.targetJobRole || null,
      experiences: candidate.experiences.map((exp) => ({
        ...exp,
        company: exp.company,
        title: exp.title,
        location: exp.location || null,
        startDate: new Date(exp.startDate),
        endDate: exp.endDate ? new Date(exp.endDate) : null,
        isCurrent: exp.isCurrent,
        description: exp.description || null,
      })),
      education: candidate.education.map((edu) => ({
        ...edu,
        school: edu.school,
        degree: edu.degree,
        fieldOfStudy: edu.fieldOfStudy || null,
        startDate: new Date(edu.startDate),
        endDate: edu.endDate ? new Date(edu.endDate) : null,
        isCurrent: edu.isCurrent,
      })),
      languages: candidate.languages.map((lang) => ({
        ...lang,
        name: lang.name,
        proficiency: lang.proficiency,
      })),
      skills: candidate.skills.map((skill) => ({
        ...skill,
        name: skill.name,
        level: skill.level || null,
      })),
      user: candidate.user
        ? {
            email: candidate.user.email || null,
            image: candidate.user.image || null,
          }
        : undefined,
    };
  }, [candidate]);

  const generatePDF = useCallback(async (): Promise<boolean> => {
    setIsGenerating(true);
    setError(null);

    try {
      const watermarkDataUrl = await resolveWatermarkSrc();

    

      const blob = await pdf(
        <CVPDFDocument candidate={sanitizedCandidate} watermarkSrc={watermarkDataUrl ?? watermarkSrc ?? null} />
      ).toBlob();

      if (!blob || blob.size === 0) {
        throw new Error("Generated PDF is empty");
      }

      const url = URL.createObjectURL(blob);

      const fullName = [
        sanitizedCandidate.firstName,
        sanitizedCandidate.lastName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
      const fileName = `${fullName.replace(/\s+/g, "_") || "CV"}_CV.pdf`;

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);

      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to generate PDF";
      logger.error("PDF generation failed");
      setError(errorMessage);
      return false;
    } finally {
      setIsGenerating(false);
    }
  }, [resolveWatermarkSrc, sanitizedCandidate, watermarkSrc]);

  return {
    generatePDF,
    isGenerating,
    error,
  };
}

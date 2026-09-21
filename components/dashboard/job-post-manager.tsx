"use client";

import { useState, useCallback, useRef } from "react";
import { JobFormDialog } from "@/components/dashboard/job-form-dialog";
import { JobPostChoiceModal } from "@/components/dashboard/job-post-choice-modal";
import { JobUrlModal } from "@/components/dashboard/job-url-modal";
import type { JobUrlScrapeOutput } from "@/lib/ai-service";

type ScrapedJobData = JobUrlScrapeOutput;

export function AllJobModals() {
  const [phase, setPhase] = useState<"closed" | "choice" | "url" | "manual">("closed");

  const [scrapedData, setScrapedData] = useState<ScrapedJobData | null>(null);

  const [jobRefKey, setJobRefKey] = useState(0);

  const isTransitioningRef = useRef(false);

  const closeAll = useCallback(() => {
    setScrapedData(null);
    setPhase("closed");
    setJobRefKey((k) => k + 1);
  }, []);

  const handleManual = () => {
    setScrapedData(null);
    setPhase("manual");
  };

  const handleUrl = () => {
    setScrapedData(null);
    setPhase("url");
  };

  const handleScrapedData = (data: ScrapedJobData) => {
    isTransitioningRef.current = true;
    setScrapedData(data);
    setPhase("manual");
  };

  const handleFormClose = () => {
    isTransitioningRef.current = false;
    closeAll();
  };

  const handleFormSuccess = () => {
    isTransitioningRef.current = false;
    setJobRefKey((k) => k + 1);
    closeAll();
    window.dispatchEvent(new Event("jobs-needs-refresh"));
  };

  return (
    <>
      <JobPostChoiceModal
        open={phase === "choice"}
        onOpenChange={(open) => {
          if (!open && phase === "choice" && !isTransitioningRef.current) {
            setPhase("closed");
          }
        }}
        onChooseManual={handleManual}
        onChooseUrl={handleUrl}
      />

      <JobUrlModal
        open={phase === "url"}
        onOpenChange={(open) => {
          if (!open && phase === "url" && !isTransitioningRef.current) {
            setPhase("closed");
          }
          isTransitioningRef.current = false;
        }}
        onScrapedData={handleScrapedData}
      />

      <JobFormDialog
        key={`form-${jobRefKey}`}
        open={phase === "manual"}
        onOpenChange={handleFormClose}
        job={scrapedData
          ? {
              title: scrapedData.title,
              description: scrapedData.description,
              requirements: scrapedData.requirements,
              salary: scrapedData.salary,
              salaryMin: scrapedData.salaryMin,
              salaryMax: scrapedData.salaryMax,
              salaryCurrency: scrapedData.salaryCurrency,
              location: scrapedData.location,
              contractType: scrapedData.contractType,
              isRemote: scrapedData.isRemote,
              isHybrid: scrapedData.isHybrid,
              activityType: scrapedData.activityType,
              activityCustom: scrapedData.activityCustom,
              technicalTools: scrapedData.technicalTools,
              softSkills: scrapedData.softSkills,
              languages: scrapedData.languages?.map((l) => ({
                language: l.name,
                level: l.level ?? "REQUIRED",
              })),
            }
          : null}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}
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
        // ScrapedJobData's `languages` uses {name, level} vs JobOffer's {language, level}.
        // JobFormDialog remaps it inside the !isEditMode branch — safe to cast here.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        job={scrapedData as any}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}
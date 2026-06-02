"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { JobFormDialog } from "@/components/dashboard/job-form-dialog";
import { JobPostChoiceModal } from "@/components/dashboard/job-post-choice-modal";
import { JobUrlModal } from "@/components/dashboard/job-url-modal";
import type { JobUrlScrapeOutput } from "@/lib/ai-service";
import { useRouter } from "next/navigation";

type ScrapedJobData = JobUrlScrapeOutput;

export function JobPostFlow({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  type Phase = "closed" | "choice" | "url" | "form";

  const [phase, setPhase] = useState<Phase>("closed");
  const [scrapedData, setScrapedData] = useState<ScrapedJobData | null>(null);
  const formKeyRef = useRef(0);
  const isTransitioningRef = useRef(false);

  const closeAll = useCallback(() => {
    setScrapedData(null);
    setPhase("closed");
    formKeyRef.current += 1;
  }, []);

  const openManual = useCallback(() => {
    setScrapedData(null);
    setPhase("form");
  }, []);

  const openUrl = useCallback(() => {
    setScrapedData(null);
    setPhase("url");
  }, []);

  const onScrapedData = useCallback((data: ScrapedJobData) => {
    isTransitioningRef.current = true;
    setScrapedData(data);
    setPhase("form");
  }, []);

  const onFormClose = useCallback(() => {
    isTransitioningRef.current = false;
    closeAll();
  }, [closeAll]);

  const onFormSuccess = useCallback(() => {
    isTransitioningRef.current = false;
    window.dispatchEvent(new Event("jobs-needs-refresh"));
    closeAll();
  }, [closeAll]);

  return (
    <>
      {trigger ? (
        <button onClick={() => setPhase("choice")}>{trigger}</button>
      ) : (
        <button
          onClick={() => setPhase("choice")}
          className="flex items-center gap-2 rounded-xl bg-[#162f67] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#162f67]/20 hover:bg-[#1e4d9c] transition-colors"
        >
          Post New Job
        </button>
      )}

      <JobPostChoiceModal
        open={phase === "choice"}
        onOpenChange={(open) => {
          if (!open && phase === "choice" && !isTransitioningRef.current) {
            setPhase("closed");
          }
        }}
        onChooseManual={openManual}
        onChooseUrl={openUrl}
      />

      <JobUrlModal
        open={phase === "url"}
        onOpenChange={(open) => {
          if (!open && phase === "url" && !isTransitioningRef.current) {
            setPhase("closed");
          }
          isTransitioningRef.current = false;
        }}
        onScrapedData={onScrapedData}
      />

      <JobFormDialog
        key={`job-form-${formKeyRef.current}`}
        open={phase === "form"}
        onOpenChange={onFormClose}
        job={scrapedData ? scrapedData as any : undefined}
        onSuccess={onFormSuccess}
      />
    </>
  );
}

/** Listens to the `jobs-needs-refresh` window event and calls `router.refresh()`. */
export function useJobRefresh() {
  const router = useRouter();
  useEffect(() => {
    const handler = () => router.refresh();
    window.addEventListener("jobs-needs-refresh", handler);
    return () => window.removeEventListener("jobs-needs-refresh", handler);
  }, [router]);
}
"use client";

import { useState } from "react";

import {
  Globe,
  Loader2,
  AlertCircle,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import { showError } from "@/lib/toast";

interface RawLanguage {
  name: string;
  level?: string;
}

interface ScrapedJobData {
  title: string;
  description: string;
  location: string;
  requirements?: string[];
  salary?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string;
  contractType?: string;
  experienceLevel?: string;
  isRemote?: boolean;
  isHybrid?: boolean;
  technicalTools?: string[];
  softSkills?: string[];
  languages?: RawLanguage[];
}

interface JobUrlModalProps {
  open: boolean;

  onOpenChange: (
    open: boolean
  ) => void;

  onScrapedData: (
    data: ScrapedJobData
  ) => void;
}

type Step =
  | "prompt"
  | "fetching"
  | "preview"
  | "error";

export function JobUrlModal({
  open,
  onOpenChange,
  onScrapedData,
}: JobUrlModalProps) {
  const [step, setStep] =
    useState<Step>("prompt");

  const [url, setUrl] =
    useState("");

  const [errorMsg, setErrorMsg] =
    useState<string | null>(null);

  const [scrapedData, setScrapedData] =
    useState<ScrapedJobData | null>(
      null
    );

  const reset = () => {
    setStep("prompt");
    setUrl("");
    setErrorMsg(null);
    setScrapedData(null);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleFetch = async () => {
    const trimmed = url.trim();

    if (!trimmed) {
      setErrorMsg(
        "Paste a valid job offer URL first."
      );

      return;
    }

    setErrorMsg(null);

    setStep("fetching");

    try {
      const res = await fetch(
        "/api/job-offers/scrape-from-url",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            url: trimmed,
          }),
        }
      );

      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({}));

        throw new Error(
          body.error ||
            "Failed to fetch the page."
        );
      }

      const body = await res.json();

if (
         body.success &&
         body.data
       ) {
         const normalizedData: ScrapedJobData =
           {
             ...body.data,
             languages:
               body.data.languages?.map(
                 (lang: any) => ({
                   name:
                     lang.name ||
                     lang.language ||
                     "",

                   level:
                     lang.level ||
                     "Not specified",
                 })
               ) || [],
           };

         setScrapedData(
           normalizedData
         );

         setStep("preview");
       } else {
        throw new Error(
          body.error ||
            "No data returned."
        );
      }
    } catch (err: any) {
      const msg =
        err.message ||
        "Something went wrong.";

      setErrorMsg(msg);

      showError(
        "Import failed",
        {
          description: msg,
        }
      );

      setStep("error");
    }
  };

  const handleProceed = () => {
    if (!scrapedData) return;

    onScrapedData(scrapedData);
    setStep("prompt");
    setScrapedData(null);
  };

  const handleRetry = () => {
    setStep("prompt");
    setErrorMsg(null);
  };

  const fieldCount =
    scrapedData
      ? [
          scrapedData.title,

          scrapedData.description,

          scrapedData
            .requirements?.length
            ? `${scrapedData.requirements.length} requirements`
            : null,

          scrapedData.salary,

          scrapedData.location,

          scrapedData.contractType,

          scrapedData
            .experienceLevel,

          scrapedData
            .technicalTools
            ?.length
            ? `${scrapedData.technicalTools.length} tools`
            : null,

          scrapedData.softSkills
            ?.length
            ? `${scrapedData.softSkills.length} soft skills`
            : null,

          scrapedData.languages
            ?.length
            ? `${scrapedData.languages.length} languages`
            : null,
        ].filter(Boolean).length
      : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-[#162f67]" />

            Import Job Offer
          </DialogTitle>

          <DialogDescription>
            {step === "prompt" &&
              "Paste a job URL and we will extract the details."}

            {step === "fetching" &&
              "Fetching and analysing the page..."}

            {step === "preview" &&
              `We found ${fieldCount} field(s).`}

            {step === "error" &&
              "Import failed."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {step === "prompt" && (
            <div className="space-y-3">
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(
                    e.target.value
                  );

                  setErrorMsg(
                    null
                  );
                }}
                placeholder="https://example.com/job"
                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                autoFocus
              />

              {errorMsg && (
                <p className="text-xs text-red-500">
                  {errorMsg}
                </p>
              )}
            </div>
          )}

          {step === "fetching" && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-[#162f67]" />

              <p className="text-sm text-slate-500">
                Analysing the page...
              </p>
            </div>
          )}

          {step === "preview" &&
            scrapedData && (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {scrapedData.title && (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-semibold uppercase text-slate-400 mb-1">
                      Title
                    </p>

                    <p className="text-sm font-medium">
                      {
                        scrapedData.title
                      }
                    </p>
                  </div>
                )}

                {scrapedData.location && (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-semibold uppercase text-slate-400 mb-1">
                      Location
                    </p>

                    <p className="text-sm">
                      {
                        scrapedData.location
                      }
                    </p>
                  </div>
                )}

                {scrapedData.description && (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-semibold uppercase text-slate-400 mb-1">
                      Description
                    </p>

                    <p className="text-sm text-slate-600 line-clamp-4">
                      {
                        scrapedData.description
                      }
                    </p>
                  </div>
                )}
              </div>
            )}
        </DialogBody>

        <DialogFooter>
          {step === "prompt" && (
            <>
              <Button
                variant="outline"
                onClick={
                  handleClose
                }
              >
                Cancel
              </Button>

              <Button
                onClick={
                  handleFetch
                }
                className="bg-[#162f67] hover:bg-[#1e4d9c] text-white"
              >
                <Globe className="h-4 w-4 mr-1.5" />

                Fetch
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button
                variant="outline"
                onClick={
                  handleRetry
                }
              >
                Try Another URL
              </Button>

              <Button
                onClick={
                  handleProceed
                }
                className="bg-[#162f67] hover:bg-[#1e4d9c] text-white"
              >
                Continue to Form
              </Button>
            </>
          )}

          {step === "error" && (
            <>
              <Button
                variant="outline"
                onClick={
                  handleClose
                }
              >
                Cancel
              </Button>

              <Button
                onClick={
                  handleRetry
                }
              >
                Try Again
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
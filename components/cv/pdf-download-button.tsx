"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { useCVPDF } from "@/hooks/use-cv-pdf";
import { toast } from "sonner";
import { Candidate } from "./cv-pdf-document";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
} from "@/components/ui/dialog";

interface CooldownInfo {
  remainingMs: number;
  remainingDays: number;
  remainingHours: number;
  remainingMinutes: number;
  nextExportAt: string;
}

interface PDFDownloadButtonProps {
  candidate: Candidate;
  fullName?: string;
}

type ModalState = "closed" | "cooldown" | "confirm";

export function PDFDownloadButton({ candidate }: PDFDownloadButtonProps) {
  const watermarkSrc = "https://hvbbactmgfhecqbetlhg.supabase.co/storage/v1/object/public/cv/logo%20cxjob.png";

  const {
    checkEligibility,
    generatePDFBlob,
    commitExport,
    triggerDownload,
    isChecking,
    isGenerating,
    isCommitting,
    error,
  } = useCVPDF({
    candidate,
    watermarkSrc,
  });

  const [modalState, setModalState] = useState<ModalState>("closed");
  const [cooldownInfo, setCooldownInfo] = useState<CooldownInfo | null>(null);
  const [countdown, setCountdown] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  const formatCountdown = (ms: number): string => {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((ms % (60 * 1000)) / 1000);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const startCountdownInterval = useCallback((remainingMs: number, nextExportAt: string, onEnd: () => void) => {
    const interval = setInterval(() => {
      const remaining = new Date(nextExportAt).getTime() - Date.now();
      if (remaining <= 0) {
        clearInterval(interval);
        onEnd();
      } else {
        setCountdown(formatCountdown(remaining));
      }
    }, 1000);

    setTimeout(() => clearInterval(interval), remainingMs + 1000);
    return interval;
  }, []);

  const handleCooldownModalOpen = useCallback((info: CooldownInfo) => {
    setCooldownInfo(info);
    setCountdown(formatCountdown(info.remainingMs));
    setModalState("cooldown");
    startCountdownInterval(info.remainingMs, info.nextExportAt, () => {
      setModalState("closed");
      setCooldownInfo(null);
    });
  }, [startCountdownInterval]);

  const handleDownload = useCallback(async () => {
    if (isExporting) return;

    const eligibilityResult = await checkEligibility();

    if (!eligibilityResult.success) {
      if (eligibilityResult.cooldown) {
        handleCooldownModalOpen(eligibilityResult.cooldown);
      } else if (eligibilityResult.error) {
        toast.error(eligibilityResult.error);
      }
      return;
    }

    setModalState("confirm");
  }, [checkEligibility, handleCooldownModalOpen, isExporting]);

  const handleConfirmExport = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    setModalState("closed");

    try {
      const blob = await generatePDFBlob();

      if (!blob) {
        return;
      }

      const commitResult = await commitExport();

      if (!commitResult.success) {
        if (commitResult.cooldown) {
          handleCooldownModalOpen(commitResult.cooldown);
        } else if (commitResult.error) {
          toast.error(commitResult.error);
        }
        return;
      }

      triggerDownload(blob);
      toast.success("CV downloaded successfully!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Export failed";
      toast.error(errorMessage);
    } finally {
      setIsExporting(false);
    }
  }, [generatePDFBlob, commitExport, triggerDownload, handleCooldownModalOpen, isExporting]);

  const handleCancel = useCallback(() => {
    setModalState("closed");
    setCooldownInfo(null);
  }, []);

  const isLoading = isChecking || isGenerating || isCommitting || isExporting;
  const buttonText = isGenerating ? "Generating..." : isCommitting ? "Finalizing..." : isChecking ? "Checking..." : isExporting ? "Exporting..." : "Download PDF";

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleDownload}
        disabled={isLoading}
        className="gap-2 bg-[#071738] hover:bg-[#0d224d]"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {buttonText}
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Download PDF
          </>
        )}
      </Button>
      {error && (
        <div className="flex items-center gap-1 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Cooldown Modal */}
      <Dialog open={modalState === "cooldown"} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export Limit Reached</DialogTitle>
            <DialogDescription>
              You can export your CV once every 7 days.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {cooldownInfo && (
              <div className="rounded-lg bg-amber-50 p-5 border border-amber-200">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-amber-900">Next export available in:</p>
                    <p className="text-2xl font-bold text-amber-700 font-mono mt-1">{countdown}</p>
                    <p className="text-sm text-amber-600 mt-1">
                      Available on {new Date(cooldownInfo.nextExportAt).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <p className="text-sm text-slate-600">
              This limit helps ensure fair usage for all candidates. Your CV will be ready for download
              once the cooldown period ends.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pre-Export Confirmation Modal */}
      <Dialog open={modalState === "confirm"} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <DialogTitle>Ready to export your CV?</DialogTitle>
            </div>
            <DialogDescription>
              A successful export starts a 7-day cooldown. You won&apos;t be able to export your CV again until the cooldown ends. Have you completed and checked all the information you want to include in your CV?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={handleCancel} disabled={isExporting}>
              Cancel
            </Button>
            <Button onClick={handleConfirmExport} disabled={isExporting} className="bg-[#071738] hover:bg-[#0d224d]">
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Exporting...
                </>
              ) : (
                "Confirm & Export CV"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
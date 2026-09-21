"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { useCVPDF } from "@/hooks/use-cv-pdf";
import { toast } from "sonner";
import { Candidate } from "./cv-pdf-document";

interface PDFDownloadButtonProps {
  candidate: Candidate;
  fullName?: string;
}

export function PDFDownloadButton({ candidate }: PDFDownloadButtonProps) {
  const watermarkSrc = "https://hvbbactmgfhecqbetlhg.supabase.co/storage/v1/object/public/cv/logo%20cxjob.png";

  const { generatePDF, isGenerating, error } = useCVPDF({
    candidate,
    watermarkSrc,
  });

  const handleDownload = useCallback(async () => {
    const success = await generatePDF();
    if (success) {
      toast.success("CV downloaded successfully!");
    } else if (error) {
      toast.error(error);
    }
  }, [generatePDF, error]);

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleDownload}
        disabled={isGenerating}
        className="gap-2 bg-[#071738] hover:bg-[#0d224d]"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating...
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
    </div>
  );
}

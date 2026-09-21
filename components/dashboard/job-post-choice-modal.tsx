"use client";

import { FileText, Globe, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface JobPostChoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChooseManual: () => void;
  onChooseUrl: () => void;
}

export function JobPostChoiceModal({
  open,
  onOpenChange,
  onChooseManual,
  onChooseUrl,
}: JobPostChoiceModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#162f67]" />
            Create New Job
          </DialogTitle>
          <DialogDescription>
            Choose how you would like to create your job listing.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Manual option */}
          <button
            onClick={() => {
              onOpenChange(false);
              onChooseManual();
            }}
            className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-[#162f67] hover:shadow-md group"
          >
            <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-[#162f67] group-hover:text-white transition-colors">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Fill Manually
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Write or copy-paste each field yourself. Full control over every
                detail.
              </p>
            </div>
          </button>

          {/* URL import option */}
          <button
            onClick={() => {
              onOpenChange(false);
              onChooseUrl();
            }}
            className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-[#162f67] hover:shadow-md group"
          >
            <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-[#162f67] group-hover:text-white transition-colors">
              <Globe className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Import from URL
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Paste an existing job offer URL. We&apos;ll extract the details
                and pre-fill the form for you.
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

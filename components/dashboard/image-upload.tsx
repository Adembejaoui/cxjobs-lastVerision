"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  type: "logo" | "cover-image" | "culture-image";
  className?: string;
  previewClassName?: string;
  aspectRatio?: "square" | "video" | "free";
  maxSize?: string;
  label?: string;
  currentImageUrl?: string;
}

export function ImageUpload({
  value,
  onChange,
  type,
  className,
  previewClassName,
  aspectRatio = "square",
  maxSize = "5MB",
  label,
  currentImageUrl,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(value || currentImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const aspectRatioClasses = {
    square: "aspect-square",
    video: "aspect-video",
    free: "aspect-auto",
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/upload?type=${type}`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Upload failed");
      }

      const uploadedUrl = data.data.url;
      setPreview(uploadedUrl);
      onChange(uploadedUrl);
    } catch (err: any) {
      setError(err.message || "Failed to upload image");
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const displayPreview = preview || currentImageUrl;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        id={`${type}-upload`}
        disabled={isUploading}
      />

      {displayPreview ? (
        <div className="relative group">
          <div
            className={cn(
              "rounded-lg border-2 border-dashed border-slate-200 overflow-hidden bg-slate-50",
              aspectRatioClasses[aspectRatio],
              previewClassName
            )}
          >
            <img
              src={displayPreview}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Overlay with actions */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-white/90 hover:bg-white"
            >
              <Upload className="h-4 w-4 mr-1" />
              Change
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemove}
              className="bg-red-500/90 hover:bg-red-500"
            >
              <X className="h-4 w-4 mr-1" />
              Remove
            </Button>
          </div>

          {isUploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
        </div>
      ) : (
        <label
          htmlFor={`${type}-upload`}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 cursor-pointer hover:border-slate-300 hover:bg-slate-100 transition-colors",
            aspectRatioClasses[aspectRatio],
            previewClassName
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              <span className="text-sm text-slate-500">Uploading...</span>
            </>
          ) : (
            <>
              <div className="p-3 rounded-full bg-slate-100">
                {type === "logo" ? (
                  <ImageIcon className="h-6 w-6 text-slate-400" />
                ) : (
                  <Upload className="h-6 w-6 text-slate-400" />
                )}
              </div>
              <div className="text-center">
                <span className="text-sm text-slate-600 font-medium">
                  Click to upload
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  PNG, JPG or WEBP (max. {maxSize})
                </p>
              </div>
            </>
          )}
        </label>
      )}

      {error && (
        <p className="text-sm text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}

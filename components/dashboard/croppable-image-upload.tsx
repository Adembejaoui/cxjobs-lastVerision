"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useState, useCallback, useRef } from "react";
import Cropper, { Area } from "react-easy-crop";
import {
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  AlertCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { validateImageClientSide, ValidationResult } from "@/lib/image-validation-client";
import { IMAGE_CONFIG, ImageType } from "@/lib/image-config";

// ── Props ──────────────────────────────────────────────────────
interface CroppableImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  type: "logo" | "cover-image" | "culture-image" | "avatar";
  className?: string;
  previewClassName?: string;
  maxSize?: string;
  label?: string;
  currentImageUrl?: string;
  /**
   * When set, the upload is performed on behalf of the given user ID.
   * Only meaningful for ADMIN users; the server verifies the target is a
   * COMPANY user with a company record. Normal user uploads omit this.
   */
  targetUserId?: string;
}

// ── Adjustment state applied to the source image before crop ───
interface Adjustments {
  brightness: number; // -1 … 1  (0 = original)
  contrast: number;   // -1 … 1  (0 = original)
  saturation: number; // -1 … 1  (0 = original)
  rotate: number;     // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
}

const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  rotate: 0,
  flipH: false,
  flipV: false,
};

// ── Crop aspect-ratio config ───────────────────────────────────
type AspectLabel = "1:1" | "16:5" | "4:3";

const TYPE_TO_ASPECT: Record<ImageType, AspectLabel> = {
  avatar: "1:1",
  logo: "1:1",
  "cover-image": "16:5",
  "culture-image": "4:3",
  "hero-banner": "16:5",
  "square-banner": "1:1",
};

const ASPECT_VALUE: Record<AspectLabel, number> = {
  "1:1": 1,
  "16:5": 16 / 5,
  "4:3": 4 / 3,
};

const ASPECT_CLASS: Record<AspectLabel, string> = {
  "1:1": "aspect-square",
  "16:5": "aspect-[16/5]",
  "4:3": "aspect-[4/3]",
};

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

/**
 * Apply brightness / contrast / saturation / rotation / flip to an ImageElement
 * and return the rasterised buffer in the requested format.
 */
function adjustAndRender(
  source: HTMLImageElement,
  adj: Adjustments,
  mimeType: string = "image/jpeg",
  quality: number = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("No 2d context"));

    const rot = ((adj.rotate % 360) + 360) % 360;
    const swapped = rot === 90 || rot === 270;
    canvas.width = swapped ? source.naturalHeight : source.naturalWidth;
    canvas.height = swapped ? source.naturalWidth : source.naturalHeight;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(adj.flipH ? -1 : 1, adj.flipV ? -1 : 1);

    const b = 1 + adj.brightness;
    const c = 1 + adj.contrast;
    const s = 1 + adj.saturation;
    ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s})`;

    ctx.drawImage(
      source,
      -source.naturalWidth / 2,
      -source.naturalHeight / 2,
    );
    ctx.restore();

    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      mimeType,
      quality,
    );
  });
}

// ── Component ──────────────────────────────────────────────────
export function CroppableImageUpload({
  value,
  onChange,
  type,
  className,
  previewClassName,
  maxSize = "5MB",
  label,
  currentImageUrl,
  targetUserId,
}: CroppableImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(
    value || currentImageUrl || null,
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [rawImageEl, setRawImageEl] = useState<HTMLImageElement | null>(null);
  const [adj, setAdj] = useState<Adjustments>({ ...DEFAULT_ADJUSTMENTS });

  // Cropper state
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setCropperRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const aspectLabel = TYPE_TO_ASPECT[type] ?? "1:1";
  const aspect = ASPECT_VALUE[aspectLabel];

  // ── ① File picker ────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Client-side validation (MIME type + file size)
    const validation: ValidationResult = validateImageClientSide({ file, imageType: type });
    if (!validation.valid) {
      setError(validation.error || "Invalid file");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const url = URL.createObjectURL(file);

    createImage(url).then((img) => {
      // Check image dimensions against minimum requirements
      const config = IMAGE_CONFIG[type];
      if (config?.minDimensions) {
        if (img.naturalWidth < config.minDimensions.width || img.naturalHeight < config.minDimensions.height) {
          URL.revokeObjectURL(url);
          setError(`Image dimensions too small. Minimum: ${config.minDimensions.width}x${config.minDimensions.height}px`);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          return;
        }
      }

      setRawImage(url);
      setRawImageEl(img);
      setAdj({ ...DEFAULT_ADJUSTMENTS });
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropperRotation(0);
      setCroppedAreaPixels(null);
      setDialogOpen(true);
    });
  };

  // ── ② Reset edits when new file selected ─────────────────────
  const resetEdits = () => setAdj({ ...DEFAULT_ADJUSTMENTS });

  // ── ③ Build edited preview blob (used for upload) ───────────
  const createEditedBlob = useCallback(async (): Promise<Blob | null> => {
    if (!rawImageEl || !rawImage) return null;

    const isLogo = type === "logo";
    const mimeType = isLogo ? "image/png" : "image/jpeg";
    const quality = isLogo ? undefined : 0.92;

    // If no adjustments made, just return the original buffer
    if (adj.brightness === 0 && adj.contrast === 0 && adj.saturation === 0 &&
        adj.rotate === 0 && !adj.flipH && !adj.flipV) {
      const buf = await (await fetch(rawImage)).arrayBuffer();
      return new Blob([buf], { type: mimeType });
    }

    return adjustAndRender(rawImageEl, adj, mimeType, quality);
  }, [rawImageEl, rawImage, adj, type]);

  // ── ⑤ Crop-complete callback ─────────────────────────────────
  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  // ── ⑥ Canvas-rasterise cropped selection ────────────────────
  const createFinalBlob = useCallback(async (): Promise<Blob | null> => {
    if (!rawImage) return null;

    const isLogo = type === "logo";
    const mimeType = isLogo ? "image/png" : "image/jpeg";
    const quality = isLogo ? undefined : 0.9;

    // A. rasterise adjustments → temp image
    const editedBlob = await createEditedBlob();
    if (!editedBlob) return null;
    const editedUrl = URL.createObjectURL(editedBlob);
    const editedImg = await createImage(editedUrl);
    URL.revokeObjectURL(editedUrl);

    // B. crop from the edited image
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    canvas.width = croppedAreaPixels!.width;
    canvas.height = croppedAreaPixels!.height;
    ctx.drawImage(
      editedImg,
      croppedAreaPixels!.x,
      croppedAreaPixels!.y,
      croppedAreaPixels!.width,
      croppedAreaPixels!.height,
      0, 0,
      croppedAreaPixels!.width,
      croppedAreaPixels!.height,
    );

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), mimeType, quality);
    });
  }, [rawImage, createEditedBlob, croppedAreaPixels, type]);

  // ── ⑦ Upload ─────────────────────────────────────────────────
  const uploadBlob = async (blob: Blob) => {
    const isLogo = type === "logo";
    const ext = isLogo ? "png" : "jpg";
    const formData = new FormData();
    formData.append("file", blob, `edit-${Date.now()}.${ext}`);
    const params = new URLSearchParams({ type });
    if (targetUserId) {
      params.set("targetUserId", targetUserId);
    }
    const res = await fetch(`/api/upload?${params.toString()}`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Upload failed");
    return data.data.url as string;
  };

  // ── ⑧ Apply → save ───────────────────────────────────────────
  const handleSave = async () => {
    if (!rawImage) return;
    setIsUploading(true);
    setError(null);
    try {
      const blob = await createFinalBlob();
      if (!blob) throw new Error("No image to save");
      const url = await uploadBlob(blob);
      setPreview(url);
      onChange(url);
      closeDialog();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsUploading(false);
    }
  };

  // ── helpers ───────────────────────────────────────────────────
  const closeDialog = () => {
    setDialogOpen(false);
    if (rawImage) {
      URL.revokeObjectURL(rawImage);
      setRawImage(null);
    }
    setRawImageEl(null);
    resetEdits();
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropperRotation(0);
    setCroppedAreaPixels(null);
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCancel = () => {
    setError(null);
    closeDialog();
  };

  const displayPreview = preview || currentImageUrl;

  // Circular frame for avatars, soft rounded rectangle for everything else
  const frameRadius = type === "avatar" ? "rounded-full" : "rounded-xl";

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className={cn("flex w-full flex-col items-center gap-2.5", className)}>
      {label && (
        <Label className="self-start text-sm font-medium text-slate-800">
          {label}
        </Label>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="peer sr-only"
        id={`${type}-crop`}
        disabled={isUploading}
      />

      {/* ── Preview with image ─────────────────────────────────── */}
      {displayPreview ? (
        <div className="flex w-full flex-col items-center gap-3">
          <div
            className={cn(
              "relative w-full overflow-hidden bg-slate-100 shadow-sm ring-1 ring-slate-200",
              frameRadius,
              ASPECT_CLASS[aspectLabel],
              previewClassName,
            )}
          >
            <img
              src={displayPreview}
              alt={label ? `${label} preview` : "Image preview"}
              className="h-full w-full object-cover"
            />
            {isUploading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px]">
                <Loader2 className="h-7 w-7 animate-spin text-white" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="h-8 gap-1.5 rounded-lg border-slate-200 bg-white px-3 text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Upload className="h-3.5 w-3.5" />
              Change
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={isUploading}
              className="h-8 gap-1.5 rounded-lg px-3 text-slate-500 hover:bg-red-50 hover:text-red-600"
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        /* ── Upload placeholder ────────────────────────────────── */
        <label
          htmlFor={`${type}-crop`}
          className={cn(
            "group flex w-full cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 bg-slate-50/70 p-4 text-center transition-colors",
            "hover:border-slate-400 hover:bg-slate-100/80",
            "peer-focus-visible:border-slate-500 peer-focus-visible:ring-2 peer-focus-visible:ring-slate-400 peer-focus-visible:ring-offset-2",
            "peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
            frameRadius,
            ASPECT_CLASS[aspectLabel],
            previewClassName,
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
              <span className="text-sm text-slate-500">Uploading…</span>
            </>
          ) : (
            <>
              <div className="rounded-full bg-white p-3 shadow-sm ring-1 ring-slate-200 transition-transform group-hover:scale-105">
                {type === "logo" || type === "avatar" ? (
                  <ImageIcon className="h-5 w-5 text-slate-500" />
                ) : (
                  <Upload className="h-5 w-5 text-slate-500" />
                )}
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-slate-700">
                  Click to upload
                </p>
                <p className="text-xs text-slate-500">
                  Image up to {maxSize} · {aspectLabel} crop
                </p>
              </div>
            </>
          )}
        </label>
      )}

      {error && (
        <div
          role="alert"
          className="flex w-full items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Editor + Crop Dialog ──────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="space-y-1 border-b border-slate-100 px-5 py-4 text-left">
            <DialogTitle className="text-base font-semibold text-slate-900">
              Edit &amp; crop {label ?? type}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Drag to reposition. Use the slider or scroll to zoom.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto bg-slate-50/60 px-5 py-4">
            {/* Crop canvas */}
            <div className="relative h-[min(52vh,380px)] w-full overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-900/10">
              {rawImage && (
                <Cropper
                  image={rawImage}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={aspect}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  onRotationChange={setCropperRotation}
                />
              )}
            </div>

            {/* Zoom control */}
            <div className="flex items-center gap-3 px-1">
              <ZoomOut className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label="Zoom"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-slate-900"
              />
              <ZoomIn className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* ── Footer ─────────────────────────────────────────────── */}
          <DialogFooter className="gap-2 border-t border-slate-100 bg-white px-5 py-3 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isUploading}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isUploading}
              className="min-w-24 rounded-lg"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Apply"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
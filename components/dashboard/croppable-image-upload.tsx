"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import Cropper, { Area } from "react-easy-crop";
import {
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Contrast,
  Sun,
  Droplets,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

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
type AspectLabel = "1:1" | "16:9";

const TYPE_TO_ASPECT: Record<string, AspectLabel> = {
  logo: "1:1",
  "cover-image": "16:9",
  "culture-image": "16:9",
  avatar: "1:1",
};

const ASPECT_VALUE: Record<AspectLabel, number> = {
  "1:1": 1,
  "16:9": 16 / 9,
};

const ASPECT_CLASS: Record<AspectLabel, string> = {
  "1:1": "aspect-square",
  "16:9": "aspect-video",
};

// ── Helpers ────────────────────────────────────────────────────
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

function rotationsEqual(a: number, b: number): boolean {
  return ((a % 360) + 360) % 360 === ((b % 360) + 360) % 360;
}

/**
 * Apply brightness / contrast / saturation / rotation / flip to an ImageElement
 * and return the rasterised buffer (JPEG).
 */
function adjustAndRender(
  source: HTMLImageElement,
  adj: Adjustments,
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

    // Canvas filter syntax: "brightness(X) contrast(Y) saturate(Z)"
    const b = 1 + adj.brightness; // 0…2
    const c = 1 + adj.contrast;   // 0…2
    const s = 1 + adj.saturation; // 0…2
    ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s})`;

    ctx.drawImage(
      source,
      -source.naturalWidth / 2,
      -source.naturalHeight / 2,
    );
    ctx.restore();

    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/jpeg",
      0.92,
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

  // Reset slider value display when "original" is asked for (brightness === 0)
  const sliderVal = (v: number) => (v === 0 ? [0] : [v]);
  const sliderRange = [-100, 100] as const;
  const sliderStep = 5;

  // ── ① File picker ────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const url = URL.createObjectURL(file);

    createImage(url).then((img) => {
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

    // If no adjustments made, just return the original buffer
    if (adj.brightness === 0 && adj.contrast === 0 && adj.saturation === 0 &&
        adj.rotate === 0 && !adj.flipH && !adj.flipV) {
      const buf = await (await fetch(rawImage)).arrayBuffer();
      return new Blob([buf], { type: "image/jpeg" });
    }

    return adjustAndRender(rawImageEl, adj);
  }, [rawImageEl, rawImage, adj]);

  // ── ④ Build cropped-selection preview for the cropper ───────
  const buildCropperImage = useCallback(async (): Promise<string | null> => {
    const blob = await createEditedBlob();
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }, [createEditedBlob]);

  // ── ⑤ Crop-complete callback ─────────────────────────────────
  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  // ── ⑥ Canvas-rasterise cropped selection ────────────────────
  const createFinalBlob = useCallback(async (): Promise<Blob | null> => {
    if (!rawImage) return null;

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
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9);
    });
  }, [rawImage, createEditedBlob, croppedAreaPixels]);

  // ── ⑦ Upload ─────────────────────────────────────────────────
  const uploadBlob = async (blob: Blob) => {
    const formData = new FormData();
    formData.append("file", blob, `edit-${Date.now()}.jpg`);
    const res = await fetch(`/api/upload?type=${type}`, {
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

  const toggleFlipH = () => setAdj((a) => ({ ...a, flipH: !a.flipH }));
  const toggleFlipV = () => setAdj((a) => ({ ...a, flipV: !a.flipV }));
  const rotateCW = () => {
    setAdj((a) => {
      const nr = ((a.rotate + 90) % 360);
      return { ...a, rotate: nr };
    });
    // also rotate crop overlay
    setCropperRotation((r) => (r + 90) % 360);
  };
  const rotateCCW = () => {
    setAdj((a) => {
      const nr = ((a.rotate - 90 + 360) % 360);
      return { ...a, rotate: nr };
    });
    setCropperRotation((r) => (r + 270) % 360);
  };

  const hasEdits =
    adj.brightness !== 0 ||
    adj.contrast !== 0 ||
    adj.saturation !== 0 ||
    adj.rotate !== 0 ||
    adj.flipH ||
    adj.flipV;

  const displayPreview = preview || currentImageUrl;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-sm font-medium text-slate-700">{label}</Label>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        id={`${type}-crop`}
        disabled={isUploading}
      />

      {/* ── Preview with image ─────────────────────────────────── */}
      {displayPreview ? (
        <div className="relative group">
          <div
            className={cn(
              "rounded-lg border-2 border-dashed border-slate-200 overflow-hidden bg-slate-50 relative",
              ASPECT_CLASS[aspectLabel],
              previewClassName,
            )}
          >
            <img
              src={displayPreview}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          </div>
          {/* Hover overlay */}
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
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg z-10">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
        </div>
      ) : (
        /* ── Upload placeholder ────────────────────────────────── */
        <label
          htmlFor={`${type}-crop`}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 cursor-pointer hover:border-slate-300 hover:bg-slate-100 transition-colors",
            ASPECT_CLASS[aspectLabel],
            previewClassName,
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              <span className="text-sm text-slate-500">Uploading…</span>
            </>
          ) : (
            <>
              <div className="p-3 rounded-full bg-slate-100">
                {type === "logo" || type === "avatar" ? (
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

      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}

      {/* ── Editor + Crop Dialog ──────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit &amp; crop {label ?? type}</DialogTitle>
          </DialogHeader>

          {/* Crop canvas */}
          <div
            className="relative w-full bg-slate-900 rounded-lg overflow-hidden"
            style={{ height: 360 }}
          >
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

          {/* ── Adjustment sliders ───────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-1">

            {/* Brightness */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Sun className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs font-medium text-slate-600">Brightness</span>
              </div>
              <Slider
                value={sliderVal(adj.brightness)}
                min={sliderRange[0]}
                max={sliderRange[1]}
                step={sliderStep}
                onValueChange={([v]) =>
                  setAdj((a) => ({ ...a, brightness: v }))
                }
              />
            </div>

            {/* Contrast */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Contrast className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs font-medium text-slate-600">Contrast</span>
              </div>
              <Slider
                value={sliderVal(adj.contrast)}
                min={sliderRange[0]}
                max={sliderRange[1]}
                step={sliderStep}
                onValueChange={([v]) =>
                  setAdj((a) => ({ ...a, contrast: v }))
                }
              />
            </div>

            {/* Saturation */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs font-medium text-slate-600">Saturation</span>
              </div>
              <Slider
                value={sliderVal(adj.saturation)}
                min={sliderRange[0]}
                max={sliderRange[1]}
                step={sliderStep}
                onValueChange={([v]) =>
                  setAdj((a) => ({ ...a, saturation: v }))
                }
              />
            </div>
          </div>

          {/* ── Rotate + Flip ─────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 px-1">
            <Button variant="outline" size="sm" onClick={rotateCCW} disabled={isUploading}>
              <RotateCcw className="h-4 w-4 mr-1" />
              −90°
            </Button>
            <Button variant="outline" size="sm" onClick={rotateCW} disabled={isUploading}>
              <RotateCw className="h-4 w-4 mr-1" />
              +90°
            </Button>
            <Button
              variant={adj.flipH ? "default" : "outline"}
              size="sm"
              onClick={toggleFlipH}
              disabled={isUploading}
            >
              <FlipHorizontal className="h-4 w-4 mr-1" />
              Flip H
            </Button>
            <Button
              variant={adj.flipV ? "default" : "outline"}
              size="sm"
              onClick={toggleFlipV}
              disabled={isUploading}
            >
              <FlipVertical className="h-4 w-4 mr-1" />
              Flip V
            </Button>
            {hasEdits && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetEdits}
                disabled={isUploading}
              >
                Reset all
              </Button>
            )}
          </div>

          {/* ── Footer ─────────────────────────────────────────────── */}
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={isUploading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
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

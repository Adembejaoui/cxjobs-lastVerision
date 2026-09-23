const MB = 1024 * 1024;

export type ImageType =
  | "avatar"
  | "logo"
  | "cover-image"
  | "culture-image"
  | "hero-banner"
  | "square-banner";

export type OutputFormat = "webp" | "png";

export type ResizeFit = "cover" | "contain";

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageBackground {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

export interface ImageConfig {
  width: number;
  height: number;
  aspectRatio: string;
  maxFileSize: number;
  allowedMimeTypes: readonly string[];
  minDimensions: ImageDimensions;
  outputFormat: OutputFormat;
  quality: number;
  fit: ResizeFit;
  position: string;
  background?: ImageBackground;
  sharpen: boolean;
  cropperAspectLabel: string;
  cropperAspectClass: string;
}

export const IMAGE_CONFIG: Record<ImageType, ImageConfig> = {
  avatar: {
    width: 400,
    height: 400,
    aspectRatio: "1:1",
    maxFileSize: 2 * MB,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    minDimensions: { width: 400, height: 400 },
    outputFormat: "webp",
    quality: 90,
    fit: "cover",
    position: "center",
    sharpen: true,
    cropperAspectLabel: "1:1",
    cropperAspectClass: "aspect-square",
  },
  logo: {
    width: 500,
    height: 500,
    aspectRatio: "1:1",
    maxFileSize: 2 * MB,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    minDimensions: { width: 500, height: 500 },
    outputFormat: "png",
    quality: 95,
    fit: "contain",
    position: "center",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    sharpen: false,
    cropperAspectLabel: "1:1",
    cropperAspectClass: "aspect-square",
  },
  "cover-image": {
    width: 1600,
    height: 500,
    aspectRatio: "16:5",
    maxFileSize: 5 * MB,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    minDimensions: { width: 1600, height: 500 },
    outputFormat: "webp",
    quality: 90,
    fit: "cover",
    position: "entropy",
    sharpen: true,
    cropperAspectLabel: "16:5",
    cropperAspectClass: "aspect-[16/5]",
  },
  "culture-image": {
    width: 1200,
    height: 900,
    aspectRatio: "4:3",
    maxFileSize: 5 * MB,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    minDimensions: { width: 1200, height: 900 },
    outputFormat: "webp",
    quality: 90,
    fit: "cover",
    position: "entropy",
    sharpen: true,
    cropperAspectLabel: "4:3",
    cropperAspectClass: "aspect-[4/3]",
  },
  "hero-banner": {
    width: 1600,
    height: 500,
    aspectRatio: "16:5",
    maxFileSize: 5 * MB,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    minDimensions: { width: 1600, height: 500 },
    outputFormat: "webp",
    quality: 90,
    fit: "cover",
    position: "entropy",
    sharpen: true,
    cropperAspectLabel: "16:5",
    cropperAspectClass: "aspect-[16/5]",
  },
  "square-banner": {
    width: 800,
    height: 800,
    aspectRatio: "1:1",
    maxFileSize: 5 * MB,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    minDimensions: { width: 800, height: 800 },
    outputFormat: "webp",
    quality: 90,
    fit: "cover",
    position: "entropy",
    sharpen: true,
    cropperAspectLabel: "1:1",
    cropperAspectClass: "aspect-square",
  },
};

export const UPLOAD_TYPE_TO_IMAGE_TYPE: Record<string, ImageType> = {
  avatar: "avatar",
  logo: "logo",
  "cover-image": "cover-image",
  "culture-image": "culture-image",
  "blog-image": "hero-banner",
};

export interface CroppedArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Area {
  x: number;
  y: number;
}

/** Response payload emitted by `CropImageModal.onConfirm`. */
export interface CoverImageData {
  coverImageUrl: string;
}

export interface LogoImageData {
  logoUrl: string | null;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  bucket?: string;
  error?: string;
}

export type ImageType = 'cover' | 'logo';

export interface ImageUploadConfig {
  bucket: string;
  aspect: number;
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
  targetWidth: number;
  targetHeight: number;
}

export const UPLOAD_CONFIGS: Record<ImageType, ImageUploadConfig> = {
  cover: {
    bucket: 'covers',
    aspect: 16 / 5,
    minZoom: 1,
    maxZoom: 3,
    zoomStep: 0.05,
    targetWidth: 1600,
    targetHeight: 500,
  },
  logo: {
    bucket: 'logos',
    aspect: 1,
    minZoom: 1,
    maxZoom: 3,
    zoomStep: 0.05,
    targetWidth: 500,
    targetHeight: 500,
  },
};

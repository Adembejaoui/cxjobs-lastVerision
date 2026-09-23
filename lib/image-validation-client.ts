import { IMAGE_CONFIG, ImageType } from "./image-config";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ClientValidationOptions {
  file: File;
  imageType: ImageType;
}

const BYTES_PER_MB = 1024 * 1024;

function formatMaxSize(bytes: number): string {
  return `${(bytes / BYTES_PER_MB).toFixed(1)}MB`;
}

export function validateImageClientSide(
  options: ClientValidationOptions
): ValidationResult {
  const { file, imageType } = options;
  const config = IMAGE_CONFIG[imageType];

  if (!config) {
    return { valid: false, error: `Unknown image type: ${imageType}` };
  }

  if (!config.allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${config.allowedMimeTypes.join(", ")}`,
    };
  }

  if (file.size > config.maxFileSize) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${formatMaxSize(config.maxFileSize)}`,
    };
  }

  return { valid: true };
}
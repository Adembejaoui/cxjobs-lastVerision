import sharp from "sharp";
import { IMAGE_CONFIG, ImageType } from "./image-config";
import { ValidationResult, ClientValidationOptions, validateImageClientSide } from "./image-validation-client";

export type { ValidationResult, ClientValidationOptions };

export interface ServerValidationOptions {
  buffer: Buffer;
  imageType: ImageType;
}

function formatDimensions(dimensions: { width: number; height: number }): string {
  return `${dimensions.width}x${dimensions.height}`;
}

export async function validateImageServerSide(
  options: ServerValidationOptions
): Promise<ValidationResult> {
  const { buffer, imageType } = options;
  const config = IMAGE_CONFIG[imageType];

  if (!config) {
    return { valid: false, error: `Unknown image type: ${imageType}` };
  }

  try {
    const metadata = await sharp(buffer).metadata();

    if (!metadata.width || !metadata.height) {
      return { valid: false, error: "Could not read image dimensions" };
    }

    if (
      metadata.width < config.minDimensions.width ||
      metadata.height < config.minDimensions.height
    ) {
      return {
        valid: false,
        error: `Image dimensions too small. Minimum: ${formatDimensions(config.minDimensions)}`,
      };
    }

    const format = metadata.format?.toLowerCase();
    const allowedFormats = config.allowedMimeTypes.map((mime) =>
      mime.split("/")[1]
    );

    if (format && !allowedFormats.includes(format)) {
      return {
        valid: false,
        error: `Unsupported image format: ${format}. Allowed: ${allowedFormats.join(
          ", "
        )}`,
      };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid or corrupted image file" };
  }
}

export async function validateImage(
  file: File,
  imageType: ImageType
): Promise<ValidationResult> {
  const clientResult = validateImageClientSide({ file, imageType });
  if (!clientResult.valid) {
    return clientResult;
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return validateImageServerSide({ buffer, imageType });
}
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  supabase,
  STORAGE_BUCKETS,
  MAX_FILE_SIZES,
  validateFile,
  generateFilePath,
  getPublicUrl,
  getSignedUrl,
  deleteFile,
} from "@/lib/supabase";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import sharp from "sharp";
import path from "path";
import {
  IMAGE_CONFIG,
  UPLOAD_TYPE_TO_IMAGE_TYPE,
  ImageType,
} from "@/lib/image-config";
import { validateImageServerSide } from "@/lib/image-validation";

const UPLOAD_LIMIT = { windowMs: 60_000, max: 20 };
const DELETE_LIMIT = { windowMs: 60_000, max: 10 };

/**
 * Process an image with sharp using centralized IMAGE_CONFIG.
 */
async function processImage(
  buffer: Buffer,
  imageType: ImageType
): Promise<Buffer> {
  const config = IMAGE_CONFIG[imageType];
  if (!config) {
    return buffer;
  }

  const isLogo = imageType === "logo";
  const isAvatar = imageType === "avatar";

  if (isLogo) {
    return sharp(buffer)
      .resize(config.width, config.height, {
        fit: config.fit,
        background: config.background,
      })
      .png({ quality: config.quality })
      .toBuffer();
  }

  if (isAvatar) {
    return sharp(buffer)
      .resize(config.width, config.height, {
        fit: config.fit,
        background: config.background,
      })
      .webp({ quality: config.quality })
      .toBuffer();
  }

  return sharp(buffer)
    .resize(config.width, config.height, {
      fit: config.fit,
      position: config.position,
    })
    .sharpen(config.sharpen ? { sigma: 1.5 } : undefined)
    .webp({ quality: config.quality })
    .toBuffer();
}

/**
 * Upload type configuration
 * Maps upload type (query param) to bucket, auth requirements, and image type
 */
const UPLOAD_CONFIG: Record<
  string,
  { bucket: string; requiresAuth: boolean; allowedRoles?: string[]; imageType?: ImageType }
> = {
  cv: { bucket: STORAGE_BUCKETS.CV, requiresAuth: true, allowedRoles: ["CANDIDATE"] },
  avatar: { bucket: STORAGE_BUCKETS.AVATAR, requiresAuth: true, allowedRoles: ["CANDIDATE"], imageType: "avatar" },
  logo: { bucket: STORAGE_BUCKETS.LOGO, requiresAuth: true, allowedRoles: ["COMPANY"], imageType: "logo" },
  "cover-image": { bucket: STORAGE_BUCKETS.COVER, requiresAuth: true, allowedRoles: ["COMPANY"], imageType: "cover-image" },
  "culture-image": { bucket: STORAGE_BUCKETS.CULTURE, requiresAuth: true, allowedRoles: ["COMPANY"], imageType: "culture-image" },
  "blog-image": { bucket: STORAGE_BUCKETS.BLOG, requiresAuth: true, allowedRoles: ["ADMIN"], imageType: "hero-banner" },
  "hero-banner": { bucket: STORAGE_BUCKETS.BLOG, requiresAuth: true, allowedRoles: ["ADMIN"], imageType: "hero-banner" },
  "square-banner": { bucket: STORAGE_BUCKETS.CULTURE, requiresAuth: true, allowedRoles: ["COMPANY"], imageType: "square-banner" },
};

/**
 * POST /api/upload - Upload a file to Supabase Storage
 *
 * Query parameters:
 * - type: 'cv' | 'avatar' | 'logo' | 'blog-image'
 *
 * Form data:
 * - file: The file to upload
 *
 * Response:
 * - success: boolean
 * - url?: string - The public URL of the uploaded file
 * - error?: string
 */
export async function POST(request: NextRequest) {
  try {
    const userSession = await auth();
    if (!userSession?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const rl = await checkRateLimitAsync(`upload:${userSession.user.id}`, UPLOAD_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many uploads. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    // Get upload type from query
    const { searchParams } = new URL(request.url);
    const uploadType = searchParams.get("type");

    if (!uploadType || !UPLOAD_CONFIG[uploadType]) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid upload type. Allowed: cv, avatar, logo, cover-image, culture-image, blog-image, hero-banner, square-banner",
          code: "INVALID_TYPE",
        },
        { status: 400 }
      );
    }

    const config = UPLOAD_CONFIG[uploadType];

    // Determine image type for validation and processing
    const imageType = config.imageType || UPLOAD_TYPE_TO_IMAGE_TYPE[uploadType];

    // Authentication check
    if (config.requiresAuth) {
      if (!userSession?.user?.id) {
        return NextResponse.json(
          { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
          { status: 401 }
        );
      }

      // Role check
      if (config.allowedRoles && !config.allowedRoles.includes(userSession.user.role)) {
        return NextResponse.json(
          { success: false, error: "You don't have permission to upload this file type", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
    }

    // Enforce request size BEFORE parsing form data (prevents memory exhaustion)
    const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
    const maxBucketSize = MAX_FILE_SIZES[config.bucket] || MAX_FILE_SIZES[STORAGE_BUCKETS.CV];
    if (contentLength > maxBucketSize) {
      return NextResponse.json(
        {
          success: false,
          error: `Request too large. Maximum size: ${(maxBucketSize / (1024 * 1024)).toFixed(1)}MB`,
          code: "REQUEST_TOO_LARGE",
        },
        { status: 413 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided", code: "NO_FILE" },
        { status: 400 }
      );
    }

    // Validate file
    const validation = await validateFile(file, config.bucket);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error, code: "INVALID_FILE" },
        { status: 400 }
      );
    }

    // Authenticated user (needed for path ownership check)
    const userId = userSession.user.id;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Generate unique file path
    const filePath = generateFilePath(config.bucket, userId, file.name);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Server-side image validation (Sharp metadata + dimensions + format)
    if (imageType) {
      const serverValidation = await validateImageServerSide({ buffer, imageType });
      if (!serverValidation.valid) {
        return NextResponse.json(
          { success: false, error: serverValidation.error, code: "INVALID_IMAGE" },
          { status: 400 }
        );
      }
    }

    // Process image using centralized config
    const processedBuffer = imageType ? await processImage(buffer, imageType) : buffer;

    // Upload to Supabase Storage (processed image)
    const contentType = imageType
      ? IMAGE_CONFIG[imageType].outputFormat === "png"
        ? "image/png"
        : "image/webp"
      : file.type;

    const { data, error } = await supabase!.storage
      .from(config.bucket)
      .upload(filePath, processedBuffer, {
        contentType,
        upsert: false,
      });

    if (error) {
    logger.error("Upload failed", { error });
      return NextResponse.json(
        { success: false, error: "Failed to upload file", code: "UPLOAD_ERROR" },
        { status: 500 }
      );
    }

    // Get URL — use signed URL for CV bucket (private), public URL for image buckets
    let fileUrl: string;
    if (config.bucket === STORAGE_BUCKETS.CV) {
      const signedUrl = await getSignedUrl(config.bucket, data.path, 3600);
      if (!signedUrl) {
        logger.error("Failed to generate signed URL for private file");
        return NextResponse.json(
          { success: false, error: "Failed to generate secure file URL", code: "URL_GENERATION_ERROR" },
          { status: 500 }
        );
      }
      fileUrl = signedUrl;
    } else {
      fileUrl = getPublicUrl(config.bucket, data.path);
    }

    return NextResponse.json({
      success: true,
      message: "File uploaded successfully",
      data: {
        url: fileUrl,
        path: data.path,
        bucket: config.bucket,
      },
    });
  } catch (error) {
    logger.error("Upload failed", { error });
    return NextResponse.json(
      { success: false, error: "Failed to upload file", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload - Delete a file from Supabase Storage
 *
 * Query parameters:
 * - bucket: The storage bucket name
 * - path: The file path to delete
 */
export async function DELETE(request: NextRequest) {
  try {

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const rl = await checkRateLimitAsync(`upload-delete:${session.user.id}`, DELETE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get("bucket");
    const filePath = searchParams.get("path");

    if (!bucket || !filePath) {
      return NextResponse.json(
        { success: false, error: "Bucket and path are required", code: "MISSING_PARAMS" },
        { status: 400 }
      );
    }

    // Verify the path belongs to the user (security check)
    // Use path.normalize to prevent traversal attacks (e.g., "../../other-user/file.pdf")
    const normalizedPath = path.normalize(filePath);
    const pathSegments = normalizedPath.split(path.sep);
    const isPathOwner = pathSegments.length > 0 && pathSegments[0] === session.user.id && !pathSegments.includes("..");

    if (!isPathOwner && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "You don't have permission to delete this file", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Delete from Supabase Storage
    const result = await deleteFile(bucket, filePath);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, code: "DELETE_ERROR" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    logger.error("Delete failed", { error });
    return NextResponse.json(
      { success: false, error: "Failed to delete file", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

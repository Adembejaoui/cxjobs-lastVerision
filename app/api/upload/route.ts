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

const UPLOAD_LIMIT = { windowMs: 60_000, max: 20 };
const DELETE_LIMIT = { windowMs: 60_000, max: 10 };

/**
 * Target dimensions and quality per bucket
 */
const IMAGE_CONFIG: Record<string, { width: number; height: number; quality: number }> = {
  [STORAGE_BUCKETS.LOGO]: { width: 500, height: 500, quality: 95 },
  [STORAGE_BUCKETS.COVER]: { width: 1600, height: 500, quality: 90 },
  [STORAGE_BUCKETS.CULTURE]: { width: 1280, height: 720, quality: 90 },
  [STORAGE_BUCKETS.AVATAR]: { width: 256, height: 256, quality: 90 },
};

/**
 * Process an image with sharp.
 * Logos/avatars keep original format and use contain to preserve full image.
 * Covers/culture use webp with cover fit.
 */
async function processImage(
  buffer: Buffer,
  bucket: string
): Promise<Buffer> {
  const config = IMAGE_CONFIG[bucket];
  if (!config) {
    return buffer;
  }

  const isLogo = bucket === STORAGE_BUCKETS.LOGO;
  const isAvatar = bucket === STORAGE_BUCKETS.AVATAR;

  if (isLogo) {
    return sharp(buffer)
      .resize(config.width, config.height, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer();
  }

  if (isAvatar) {
    return sharp(buffer)
      .resize(config.width, config.height, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: config.quality })
      .toBuffer();
  }

  return sharp(buffer)
    .resize(config.width, config.height, {
      fit: "cover",
      position: "entropy",
    })
    .sharpen({ sigma: 1.5 })
    .webp({ quality: config.quality })
    .toBuffer();
}

/**
 * Upload type configuration
 */
const UPLOAD_CONFIG: Record<
  string,
  { bucket: string; requiresAuth: boolean; allowedRoles?: string[] }
> = {
  cv: { bucket: STORAGE_BUCKETS.CV, requiresAuth: true, allowedRoles: ["CANDIDATE"] },
  avatar: { bucket: STORAGE_BUCKETS.AVATAR, requiresAuth: true, allowedRoles: ["CANDIDATE"] },
  logo: { bucket: STORAGE_BUCKETS.LOGO, requiresAuth: true, allowedRoles: ["COMPANY"] },
  "cover-image": { bucket: STORAGE_BUCKETS.COVER, requiresAuth: true, allowedRoles: ["COMPANY"] },
  "culture-image": { bucket: STORAGE_BUCKETS.CULTURE, requiresAuth: true, allowedRoles: ["COMPANY"] },
  "blog-image": { bucket: STORAGE_BUCKETS.BLOG, requiresAuth: true, allowedRoles: ["ADMIN"] },
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
          error: "Invalid upload type. Allowed: cv, avatar, logo, blog-image",
          code: "INVALID_TYPE",
        },
        { status: 400 }
      );
    }

    const config = UPLOAD_CONFIG[uploadType];

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

    // Process image (resize + crop + webp) for image buckets
    const processedBuffer = await processImage(buffer, config.bucket);

    // Upload to Supabase Storage (processed image)
    const isImageBucket =
      config.bucket === STORAGE_BUCKETS.LOGO ||
      config.bucket === STORAGE_BUCKETS.COVER ||
      config.bucket === STORAGE_BUCKETS.AVATAR ||
      config.bucket === STORAGE_BUCKETS.CULTURE;

    const { data, error } = await supabase!.storage
      .from(config.bucket)
      .upload(filePath, processedBuffer, {
        contentType: isImageBucket ? "image/webp" : file.type,
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

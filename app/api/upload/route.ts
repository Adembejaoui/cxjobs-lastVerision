import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  supabase,
  STORAGE_BUCKETS,
  validateFile,
  generateFilePath,
  getPublicUrl,
  deleteFile,
} from "@/lib/supabase";
import { rateLimitResponse, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";

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
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimitResult = rateLimitResponse(clientIp, RATE_LIMIT_PRESETS.API_WRITE);
    if (rateLimitResult) return rateLimitResult;

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
      const session = await auth();

      if (!session?.user?.id) {
        return NextResponse.json(
          { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
          { status: 401 }
        );
      }

      // Role check
      if (config.allowedRoles && !config.allowedRoles.includes(session.user.role)) {
        return NextResponse.json(
          { success: false, error: "You don't have permission to upload this file type", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
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
    const validation = validateFile(file, config.bucket);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error, code: "INVALID_FILE" },
        { status: 400 }
      );
    }

    // Get user ID for file path (use 'system' for non-authenticated uploads)
    const session = await auth();
    const userId = session?.user?.id || "system";

    // Generate unique file path
    const filePath = generateFilePath(config.bucket, userId, file.name);

    // Check if Supabase is configured
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Storage not configured", code: "STORAGE_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(config.bucket)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("Upload error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to upload file", code: "UPLOAD_ERROR" },
        { status: 500 }
      );
    }

    // Get public URL
    const publicUrl = getPublicUrl(config.bucket, data.path);

    return NextResponse.json({
      success: true,
      message: "File uploaded successfully",
      data: {
        url: publicUrl,
        path: data.path,
        bucket: config.bucket,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
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
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimitResult = rateLimitResponse(clientIp, RATE_LIMIT_PRESETS.API_WRITE);
    if (rateLimitResult) return rateLimitResult;

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get("bucket");
    const path = searchParams.get("path");

    if (!bucket || !path) {
      return NextResponse.json(
        { success: false, error: "Bucket and path are required", code: "MISSING_PARAMS" },
        { status: 400 }
      );
    }

    // Verify the path belongs to the user (security check)
    if (!path.startsWith(session.user.id) && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "You don't have permission to delete this file", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Delete from Supabase Storage
    const result = await deleteFile(bucket, path);

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
    console.error("Delete error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete file", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

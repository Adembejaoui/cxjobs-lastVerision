import { createClient } from "@supabase/supabase-js";
import { logger } from "./logger";
import { randomUUID } from "crypto";
import { checkCvFile, checkImageFile, type CvFormat, type ImageFormat } from "./security/file-type";

/**
 * Supabase client configuration for file storage
 * 
 * Required environment variables:
 * - NEXT_PUBLIC_SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for server-side operations
 *   (Use NEXT_PUBLIC_SUPABASE_ANON_KEY for client-side operations)
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseServiceKey);
}

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured() && process.env.NODE_ENV === "production") {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }
}

assertSupabaseConfigured();

/**
 * Server-side Supabase client with service role privileges
 * Use this for API routes that need elevated permissions
 * Only initialized if environment variables are present
 */
export const supabase = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

/**
 * Storage bucket names
 */
export const STORAGE_BUCKETS = {
  CV: "cv",
  AVATAR: "avatars",
  LOGO: "logos",
  BLOG: "blog-images",
  COVER: "covers",
  CULTURE: "culture-images",
} as const;

/**
 * Allowed MIME types for each bucket
 */
export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  [STORAGE_BUCKETS.CV]: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  [STORAGE_BUCKETS.AVATAR]: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ],
  [STORAGE_BUCKETS.LOGO]: [
    "image/jpeg",
    "image/png",
    "image/webp",
  ],
  [STORAGE_BUCKETS.BLOG]: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ],
  [STORAGE_BUCKETS.COVER]: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ],
  [STORAGE_BUCKETS.CULTURE]: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ],
};

/**
 * Maximum file sizes in bytes
 */
export const MAX_FILE_SIZES: Record<string, number> = {
  [STORAGE_BUCKETS.CV]: 5 * 1024 * 1024, // 5MB
  [STORAGE_BUCKETS.AVATAR]: 5 * 1024 * 1024, // 5MB
  [STORAGE_BUCKETS.LOGO]: 5 * 1024 * 1024, // 5MB
  [STORAGE_BUCKETS.BLOG]: 5 * 1024 * 1024, // 5MB
  [STORAGE_BUCKETS.COVER]: 5 * 1024 * 1024, // 5MB
  [STORAGE_BUCKETS.CULTURE]: 5 * 1024 * 1024, // 5MB
};

const BUCKET_FORMATS: Record<string, { kind: "cv"; formats: CvFormat[] } | { kind: "image"; formats: ImageFormat[] }> = {
  [STORAGE_BUCKETS.CV]: { kind: "cv", formats: ["pdf", "doc", "docx"] },
  [STORAGE_BUCKETS.AVATAR]: { kind: "image", formats: ["jpeg", "png", "webp", "gif"] },
  [STORAGE_BUCKETS.LOGO]: { kind: "image", formats: ["jpeg", "png", "webp"] },
  [STORAGE_BUCKETS.BLOG]: { kind: "image", formats: ["jpeg", "png", "webp", "gif"] },
  [STORAGE_BUCKETS.COVER]: { kind: "image", formats: ["jpeg", "png", "webp", "gif"] },
  [STORAGE_BUCKETS.CULTURE]: { kind: "image", formats: ["jpeg", "png", "webp", "gif"] },
};

/**
 * Generates a server-controlled object path. The client filename is never
 * used: the extension comes from content detection and the name is random,
 * so path traversal or misleading extensions (".html") are impossible.
 */
export function generateFilePath(
  _bucket: string,
  userId: string,
  extension: string
): string {
  const safeExt = /^[a-z0-9]{1,5}$/.test(extension) ? extension : "bin";
  return `${userId}/${Date.now()}-${randomUUID()}.${safeExt}`;
}

export type FileValidation =
  | { valid: true; mime: string; extension: string; buffer: Buffer }
  | { valid: false; error: string };

/**
 * Validates an upload by CONTENT. The declared MIME type and filename are
 * attacker-controlled: they are only required to be consistent with the
 * detected format. The returned mime/extension are what must be stored.
 */
export async function validateFile(
  file: File,
  bucket: string
): Promise<FileValidation> {
  const policy = BUCKET_FORMATS[bucket];
  const maxSize = MAX_FILE_SIZES[bucket];

  if (!policy || !maxSize) {
    return { valid: false, error: "Invalid bucket" };
  }

  if (file.size === 0) {
    return { valid: false, error: "File is empty" };
  }

  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxSizeMB}MB`,
    };
  }

  const allowedTypes = ALLOWED_MIME_TYPES[bucket] ?? [];
  if (file.type && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const check =
    policy.kind === "cv"
      ? checkCvFile(buffer, file.name, policy.formats)
      : checkImageFile(buffer, file.name, policy.formats);

  if (!check.ok) {
    return { valid: false, error: check.error };
  }
  // A declared type that disagrees with the real content is rejected rather
  // than silently corrected.
  if (file.type && file.type !== check.mime) {
    return { valid: false, error: "File content does not match its declared type" };
  }

  return { valid: true, mime: check.mime, extension: check.extension, buffer };
}

/**
 * Gets the public URL for a file
 */
/** Buckets that must never be exposed through a public URL. */
export const PRIVATE_BUCKETS: ReadonlySet<string> = new Set([STORAGE_BUCKETS.CV]);

export function getPublicUrl(bucket: string, path: string): string {
  // Structural guard: a CV must only ever be reached through an authorized,
  // short-lived signed URL, even if a caller is changed by mistake later.
  if (PRIVATE_BUCKETS.has(bucket)) {
    throw new Error("Public URLs are not allowed for private buckets");
  }
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Gets a signed URL for private file access (CVs, etc.)
 * Signed URLs expire after the given number of seconds.
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string | null> {
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    logger.error("Signed URL error", { error });
    return null;
  }
  return data.signedUrl;
}

/**
 * Deletes a file from storage
 */
export async function deleteFile(
  bucket: string,
  path: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: "Supabase is not configured" };
  }
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    // Provider error details stay server-side.
    logger.error("Storage delete failed", { bucket, error: error.name });
    return { success: false, error: "Failed to delete file" };
  }

  return { success: true };
}

/**
 * Lists files in a user's folder
 */
export async function listUserFiles(
  bucket: string,
  userId: string
): Promise<{ files: string[]; error?: string }> {
  if (!supabase) {
    return { files: [], error: "Supabase is not configured" };
  }
  const { data, error } = await supabase.storage.from(bucket).list(userId);

  if (error) {
    return { files: [], error: error.message };
  }

  return {
    files: data.map((file: { name: string }) => `${userId}/${file.name}`),
  };
}

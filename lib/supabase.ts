import { createClient } from "@supabase/supabase-js";
import { logger } from "./logger";

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
  [STORAGE_BUCKETS.AVATAR]: 2 * 1024 * 1024, // 2MB
  [STORAGE_BUCKETS.LOGO]: 2 * 1024 * 1024, // 2MB
  [STORAGE_BUCKETS.BLOG]: 5 * 1024 * 1024, // 5MB
  [STORAGE_BUCKETS.COVER]: 5 * 1024 * 1024, // 5MB
  [STORAGE_BUCKETS.CULTURE]: 5 * 1024 * 1024, // 5MB
};

/**
 * Expected file signatures (magic bytes) for each MIME type.
 * SVG is excluded — it is XML-based and has no reliable magic bytes.
 */
const FILE_SIGNATURES: Record<string, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
  "application/msword": [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], // OLE2
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [0x50, 0x4B, 0x03, 0x04], // PK\x03\x04 (ZIP/OOXML)
  "image/jpeg": [0xFF, 0xD8, 0xFF],
  "image/png": [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  "image/gif": [0x47, 0x49, 0x46, 0x38], // GIF8
  "image/webp": [0x52, 0x49, 0x46, 0x46, 0x57, 0x45, 0x42, 0x50], // RIFF + WEBP
};

function matchesSignature(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

function matchesWebP(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const riff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const webp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return riff && webp;
}

async function readFileSignature(file: File): Promise<Uint8Array> {
  const slice = file.slice(0, 16);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Generates a unique file path for storage
 */
export function generateFilePath(
  bucket: string,
  userId: string,
  originalName: string
): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split(".").pop()?.toLowerCase() || "bin";
  
  return `${userId}/${timestamp}-${randomString}.${extension}`;
}

/**
 * Validates file before upload
 */
export async function validateFile(
  file: File,
  bucket: string
): Promise<{ valid: boolean; error?: string }> {
  const allowedTypes = ALLOWED_MIME_TYPES[bucket];
  const maxSize = MAX_FILE_SIZES[bucket];

  if (!allowedTypes || !maxSize) {
    return { valid: false, error: "Invalid bucket" };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`,
    };
  }

  const signature = FILE_SIGNATURES[file.type];
  if (signature) {
    const bytes = await readFileSignature(file);
    const valid = file.type === "image/webp"
      ? matchesWebP(bytes)
      : matchesSignature(bytes, signature);
    if (!valid) {
      return {
        valid: false,
        error: "File content does not match its declared type",
      };
    }
  }

  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Gets the public URL for a file
 */
export function getPublicUrl(bucket: string, path: string): string {
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
    return { success: false, error: error.message };
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

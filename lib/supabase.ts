import { createClient } from "@supabase/supabase-js";

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
    "image/svg+xml",
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
export function validateFile(
  file: File,
  bucket: string
): { valid: boolean; error?: string } {
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

/**
 * CV PDF watermark loading.
 *
 * The watermark is a static, same-origin asset (public/brand/), never an
 * object in the private `cv` storage bucket. Loading it is best-effort: any
 * failure (404, network error, wrong content type, unreadable body) yields
 * `null`, and the PDF is rendered without the watermark instead of failing
 * the export.
 */

/** Served by Next.js from public/brand/cxjobs-watermark.png. */
export const CV_WATERMARK_SRC = "/brand/cxjobs-watermark.png";

/** Formats @react-pdf/renderer can embed. */
const SUPPORTED_TYPES = new Set(["image/png", "image/jpeg"]);

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Resolve the watermark to a data URL for react-pdf, or `null` if it cannot
 * be loaded. Never throws.
 */
export async function loadWatermarkDataUrl(
  src: string | null | undefined,
  fetchImpl: FetchLike = (input, init) => fetch(input, init)
): Promise<string | null> {
  const url = src?.trim();
  if (!url) return null;
  if (url.startsWith("data:image/png") || url.startsWith("data:image/jpeg")) return url;

  try {
    const response = await fetchImpl(url, { cache: "no-store" });
    if (!response.ok) return null;
    const blob = await response.blob();
    const type = (blob.type || response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!SUPPORTED_TYPES.has(type)) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length === 0) return null;
    return `data:${type};base64,${bytesToBase64(bytes)}`;
  } catch {
    return null;
  }
}

/**
 * Content-based file type detection. The browser-supplied `File.type` and the
 * filename extension are attacker-controlled and are never used as proof of
 * format; they are only checked for CONSISTENCY with the detected type.
 */

export type CvFormat = "pdf" | "doc" | "docx";
export type ImageFormat = "jpeg" | "png" | "gif" | "webp";

export const CV_MIME: Record<CvFormat, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const IMAGE_MIME: Record<ImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

const CV_EXTENSIONS: Record<CvFormat, string[]> = {
  pdf: ["pdf"],
  doc: ["doc"],
  docx: ["docx"],
};

const IMAGE_EXTENSIONS: Record<ImageFormat, string[]> = {
  jpeg: ["jpg", "jpeg"],
  png: ["png"],
  gif: ["gif"],
  webp: ["webp"],
};

function startsWith(buf: Uint8Array, sig: number[], offset = 0): boolean {
  if (buf.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (buf[offset + i] !== sig[i]) return false;
  return true;
}

function includesAscii(buf: Uint8Array, needle: string, from = 0, to = buf.length): boolean {
  return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)
    .subarray(from, Math.min(to, buf.length))
    .includes(Buffer.from(needle, "latin1"));
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

/** "WordDocument" as UTF-16LE: the main stream name of a .doc compound file. */
const WORD_DOCUMENT_UTF16 = Buffer.from("WordDocument", "utf16le");

/**
 * Detect a supported CV format from bytes alone, or null.
 *  - PDF: "%PDF-" header at offset 0 and an "%%EOF" marker near the end
 *    (rejects truncated/garbage files that merely start with the magic).
 *  - DOCX: ZIP with "[Content_Types].xml" and a "word/" part (a plain ZIP or
 *    other OOXML type such as .xlsx is rejected).
 *  - DOC: OLE2 compound file containing a "WordDocument" stream.
 */
export function detectCvFormat(buf: Uint8Array): CvFormat | null {
  if (startsWith(buf, PDF_MAGIC)) {
    const tailStart = Math.max(0, buf.length - 2048);
    return includesAscii(buf, "%%EOF", tailStart) ? "pdf" : null;
  }
  if (startsWith(buf, ZIP_MAGIC)) {
    return includesAscii(buf, "[Content_Types].xml") && includesAscii(buf, "word/") ? "docx" : null;
  }
  if (startsWith(buf, OLE2_MAGIC)) {
    return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).includes(WORD_DOCUMENT_UTF16) ? "doc" : null;
  }
  return null;
}

export function detectImageFormat(buf: Uint8Array): ImageFormat | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return "gif";
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}

function extensionOf(filename: string): string | null {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return null;
  return base.slice(dot + 1).toLowerCase();
}

export type FileCheck<F extends string> =
  | { ok: true; format: F; mime: string; extension: string }
  | { ok: false; error: string };

/**
 * Validate an uploaded CV: detected format must be allowed, and the declared
 * filename extension (if any) must agree with it. The returned `mime` and
 * `extension` are server-derived and must be used for storage.
 */
export function checkCvFile(
  buf: Uint8Array,
  filename: string,
  allowed: readonly CvFormat[] = ["pdf", "doc", "docx"]
): FileCheck<CvFormat> {
  const format = detectCvFormat(buf);
  if (!format || !allowed.includes(format)) {
    return { ok: false, error: "Unsupported or invalid document. Allowed formats: " + allowed.map((f) => f.toUpperCase()).join(", ") };
  }
  const ext = extensionOf(filename);
  if (ext !== null && !CV_EXTENSIONS[format].includes(ext)) {
    return { ok: false, error: "File extension does not match the file content" };
  }
  return { ok: true, format, mime: CV_MIME[format], extension: CV_EXTENSIONS[format][0] };
}

export function checkImageFile(
  buf: Uint8Array,
  filename: string,
  allowed: readonly ImageFormat[]
): FileCheck<ImageFormat> {
  const format = detectImageFormat(buf);
  if (!format || !allowed.includes(format)) {
    return { ok: false, error: "Unsupported or invalid image" };
  }
  const ext = extensionOf(filename);
  if (ext !== null && !IMAGE_EXTENSIONS[format].includes(ext)) {
    return { ok: false, error: "File extension does not match the file content" };
  }
  return { ok: true, format, mime: IMAGE_MIME[format], extension: IMAGE_EXTENSIONS[format][0] };
}

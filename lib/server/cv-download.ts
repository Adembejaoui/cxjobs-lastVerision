import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { CV_BUCKET, CV_SIGNED_URL_TTL_SECONDS } from "@/lib/security/cv-access";

/**
 * Redirects an ALREADY-AUTHORIZED requester to a short-lived signed URL for a
 * CV object. Callers must perform the authorization check first.
 */
export async function redirectToSignedCv(path: string, download: boolean): Promise<NextResponse> {
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "File storage is not available", code: "STORAGE_UNAVAILABLE" },
      { status: 503 }
    );
  }
  const { data, error } = await supabase.storage
    .from(CV_BUCKET)
    .createSignedUrl(path, CV_SIGNED_URL_TTL_SECONDS, download ? { download: true } : undefined);

  if (error || !data?.signedUrl) {
    logger.warn("CV signed URL generation failed", { error: error?.name ?? "unknown" });
    return NextResponse.json(
      { success: false, error: "CV not available", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

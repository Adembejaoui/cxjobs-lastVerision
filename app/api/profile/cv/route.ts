import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { cvPathOwner, extractCvObjectPath, supabaseHostFromEnv } from "@/lib/security/cv-access";
import { redirectToSignedCv } from "@/lib/server/cv-download";

const CV_ACCESS_LIMIT = { windowMs: 60_000, max: 60 };

// GET /api/profile/cv — the signed-in candidate's own CV.
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser({ requireActive: true });
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const rl = await checkRateLimitAsync(`cv-access:${user.id}`, CV_ACCESS_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const candidate = await prisma.candidate.findUnique({
      where: { userId: user.id },
      select: { resumeUrl: true },
    });
    const path = extractCvObjectPath(candidate?.resumeUrl, supabaseHostFromEnv());
    if (!path || cvPathOwner(path) !== user.id.toLowerCase()) {
      return NextResponse.json({ success: false, error: "CV not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const download = new URL(request.url).searchParams.get("download") === "1";
    return redirectToSignedCv(path, download);
  } catch (error) {
    logger.error("Profile CV access error", { error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json(
      { success: false, error: "Failed to access CV", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

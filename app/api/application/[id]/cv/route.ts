import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import {
  canAccessApplicationCv,
  cvPathOwner,
  extractCvObjectPath,
  supabaseHostFromEnv,
} from "@/lib/security/cv-access";
import { redirectToSignedCv } from "@/lib/server/cv-download";

const CV_ACCESS_LIMIT = { windowMs: 60_000, max: 60 };

const notFound = () =>
  NextResponse.json({ success: false, error: "CV not found", code: "NOT_FOUND" }, { status: 404 });

// GET /api/application/[id]/cv — authorized, short-lived access to the CV
// attached to an application (candidate, owning company, or admin).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const application = await prisma.application.findUnique({
      where: { id },
      select: {
        cvUrl: true,
        candidate: { select: { userId: true, resumeUrl: true } },
        jobOffer: { select: { companyId: true } },
      },
    });
    if (!application) return notFound();

    const companyId =
      user.role === "COMPANY"
        ? (await prisma.companies.findUnique({ where: { userId: user.id }, select: { id: true } }))?.id ?? null
        : null;

    const allowed = canAccessApplicationCv(
      { role: user.role, userId: user.id, companyId },
      { candidateUserId: application.candidate.userId, jobCompanyId: application.jobOffer.companyId }
    );
    // 404 rather than 403 so the endpoint does not confirm which IDs exist.
    if (!allowed) return notFound();

    const host = supabaseHostFromEnv();
    const path =
      extractCvObjectPath(application.cvUrl, host) ?? extractCvObjectPath(application.candidate.resumeUrl, host);
    // The object must live in the applicant's own folder.
    if (!path || cvPathOwner(path) !== application.candidate.userId.toLowerCase()) return notFound();

    const download = new URL(request.url).searchParams.get("download") === "1";
    return redirectToSignedCv(path, download);
  } catch (error) {
    logger.error("Application CV access error", { error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json(
      { success: false, error: "Failed to access CV", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const OVERVIEW_LIMIT = { windowMs: 60_000, max: 30 };

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const adminUser = authResult.user;

    const rl = await checkRateLimitAsync(
      `admin-overview:${adminUser.id}`,
      OVERVIEW_LIMIT,
    );
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) },
      );
    }

    const now = new Date();

    const rows = await prisma.$queryRaw<
      Array<{
        landingPageUniqueVisitors: bigint;
        candidateAccounts: bigint;
        cvExports: bigint;
        totalApplications: bigint;
        hiredApplications: bigint;
        invitationTokensGenerated: bigint;
        totalCompanies: bigint;
        activeCompanies: bigint;
        totalJobListings: bigint;
        activeJobListings: bigint;
      }>
    >`
      SELECT
        (SELECT COUNT(*) FROM "landing_page_visitors") AS "landingPageUniqueVisitors",
        (SELECT COUNT(*) FROM "users" WHERE "role" = 'CANDIDATE') AS "candidateAccounts",
        (SELECT COALESCE(SUM("cvExportCount"), 0) FROM "candidates") AS "cvExports",
        (SELECT COUNT(*) FROM "applications") AS "totalApplications",
        (SELECT COUNT(*) FROM "applications" WHERE "status" = 'EMBAUCHES') AS "hiredApplications",
        (SELECT COUNT(*) FROM "company_invitations") AS "invitationTokensGenerated",
        (SELECT COUNT(*) FROM "companies" WHERE "deletedAt" IS NULL) AS "totalCompanies",
        (SELECT COUNT(*) FROM "companies" c JOIN "users" u ON c."userId" = u."id" WHERE c."deletedAt" IS NULL AND u."isActive" = true) AS "activeCompanies",
        (SELECT COUNT(*) FROM "job_offers" WHERE "deletedAt" IS NULL) AS "totalJobListings",
        (SELECT COUNT(*) FROM "job_offers" WHERE "deletedAt" IS NULL AND "status" = 'PUBLISHED' AND ("expiresAt" IS NULL OR "expiresAt" > ${now})) AS "activeJobListings"
    `;

    const row = rows[0];

    const data = {
      landingPageUniqueVisitors: Number(row?.landingPageUniqueVisitors ?? 0),
      candidateAccounts: Number(row?.candidateAccounts ?? 0),
      cvExports: Number(row?.cvExports ?? 0),
      totalApplications: Number(row?.totalApplications ?? 0),
      hiredApplications: Number(row?.hiredApplications ?? 0),
      invitationTokensGenerated: Number(row?.invitationTokensGenerated ?? 0),
      totalCompanies: Number(row?.totalCompanies ?? 0),
      activeCompanies: Number(row?.activeCompanies ?? 0),
      totalJobListings: Number(row?.totalJobListings ?? 0),
      activeJobListings: Number(row?.activeJobListings ?? 0),
    };

    return NextResponse.json(
      { success: true, data },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    logger.error("Admin overview fetch failed", { error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch overview data", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
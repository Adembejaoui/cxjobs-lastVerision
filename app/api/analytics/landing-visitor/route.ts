import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils";
import crypto from "crypto";

const TRACKING_LIMIT = { windowMs: 60_000, max: 30 };

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await checkRateLimitAsync(`landing-visitor:${ip}`, TRACKING_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests", code: "RATE_LIMITED" },
        { status: 429, headers: getRateLimitHeaders(rl) },
      );
    }

    // Check for existing visitor cookie
    const existingCookie = request.cookies.get("cx_visitor_id")?.value;
    let visitorId: string;

    if (existingCookie) {
      visitorId = existingCookie;
    } else {
      visitorId = crypto.randomUUID();
    }

    // Hash the visitor ID (never store raw)
    const visitorHash = crypto
      .createHash("sha256")
      .update(visitorId)
      .digest("hex");

    // Conflict-safe insert: unique constraint on visitorHash prevents duplicates
    try {
      await prisma.landingPageVisitor.create({
        data: { visitorHash },
      });
    } catch {
      // Unique constraint violation = visitor already recorded; that's fine
    }

    const response = NextResponse.json({ success: true });

    // Set persistent first-party cookie if new visitor
    if (!existingCookie) {
      response.cookies.set("cx_visitor_id", visitorId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365 * 2, // 2 years
        path: "/",
      });
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
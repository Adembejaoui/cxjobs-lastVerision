import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { name, value, rating, delta, id, page, timestamp } = body;

    if (!name || typeof value !== "number") {
      return NextResponse.json(
        { success: false, error: "Invalid payload" },
        { status: 400 }
      );
    }

    logger.info("Web Vitals metric received", {
      metric: name,
      value,
      rating,
      delta,
      id,
      page,
      timestamp,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Web Vitals endpoint error", { error });
    return NextResponse.json(
      { success: false, error: "Failed to process metric" },
      { status: 500 }
    );
  }
}
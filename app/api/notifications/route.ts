import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";

/**
 * In-app notifications for the signed-in user (launch plan A7).
 *
 *   GET   /api/notifications            → latest 20 + unread count
 *   PATCH /api/notifications { ids }    → mark those as read
 *   PATCH /api/notifications { all: true } → mark everything as read
 *
 * Every query is scoped by the session user id; a notification id belonging
 * to someone else is silently ignored (never read, never updated).
 */

const LIST_LIMIT = 20;
const READ_LIMIT = { windowMs: 60_000, max: 60 };

const markReadSchema = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).strict(),
  z.object({ all: z.literal(true) }).strict(),
]);

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const userId = session.user.id;
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: LIST_LIMIT,
        select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return NextResponse.json(
      { success: true, data: notifications, unreadCount },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    logger.error("Failed to list notifications", { error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json(
      { success: false, error: "Failed to load notifications", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const rl = await checkRateLimitAsync(`notifications-read:${session.user.id}`, READ_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
  }
  const parsed = markReadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Validation failed", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  try {
    const where =
      "all" in parsed.data
        ? { userId: session.user.id, readAt: null }
        : { userId: session.user.id, readAt: null, id: { in: parsed.data.ids } };
    const result = await prisma.notification.updateMany({ where, data: { readAt: new Date() } });
    return NextResponse.json({ success: true, data: { updated: result.count } });
  } catch (error) {
    logger.error("Failed to mark notifications read", { error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json(
      { success: false, error: "Failed to update notifications", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

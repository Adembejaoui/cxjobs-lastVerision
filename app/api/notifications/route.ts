import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getNotifications, getUnreadCount } from "@/lib/notifications";
import { parsePaginationParams } from "@/lib/utils";

// GET /api/notifications - List user notifications
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const { page, limit } = parsePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    );

    const { notifications, total, unreadCount } = await getNotifications(
      session.user.id,
      { page, limit, unreadOnly }
    );

    return NextResponse.json({
      success: true,
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch notifications", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

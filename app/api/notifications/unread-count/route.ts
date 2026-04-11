import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUnreadCount } from "@/lib/notifications";

// GET /api/notifications/unread-count - Get unread notification count
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const count = await getUnreadCount(session.user.id);

    return NextResponse.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch unread count", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

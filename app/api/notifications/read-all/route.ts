import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markAllAsRead } from "@/lib/notifications";

// PATCH /api/notifications/read-all - Mark all notifications as read
export async function PATCH() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const count = await markAllAsRead(session.user.id);

    return NextResponse.json({
      success: true,
      message: `Marked ${count} notifications as read`,
      data: { count },
    });
  } catch (error) {
    console.error("Mark all read error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to mark notifications as read", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

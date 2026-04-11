import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markAsRead, deleteNotification } from "@/lib/notifications";

// PATCH /api/notifications/[id] - Mark notification as read
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const success = await markAsRead(id, session.user.id);

    if (!success) {
      return NextResponse.json(
        { success: false, error: "Notification not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Mark notification read error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to mark notification as read", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications/[id] - Delete a notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const success = await deleteNotification(id, session.user.id);

    if (!success) {
      return NextResponse.json(
        { success: false, error: "Notification not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete notification", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

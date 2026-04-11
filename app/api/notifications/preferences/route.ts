import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  notificationPreferencesSchema,
  defaultNotificationPreferences,
} from "@/lib/validations/notifications";

/**
 * GET /api/notifications/preferences
 * Get the current user's notification preferences
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    let preferences = await prisma.notificationPreference.findUnique({
      where: { userId: session.user.id },
    });

    // Create default preferences if none exist
    if (!preferences) {
      preferences = await prisma.notificationPreference.create({
        data: {
          userId: session.user.id,
          ...defaultNotificationPreferences,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error("Get notification preferences error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch preferences", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications/preferences
 * Update the current user's notification preferences
 */
export async function PATCH(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validationResult = notificationPreferencesSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Upsert preferences
    const preferences = await prisma.notificationPreference.upsert({
      where: { userId: session.user.id },
      update: validationResult.data,
      create: {
        userId: session.user.id,
        ...defaultNotificationPreferences,
        ...validationResult.data,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Notification preferences updated",
      data: preferences,
    });
  } catch (error) {
    console.error("Update notification preferences error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update preferences", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import  prisma  from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Admin access required", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const now = new Date();

    const expiredOffers = await prisma.jobOffer.findMany({
      where: {
        status: "PUBLISHED",
        expiresAt: {
          not: null,
          lt: now,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        companyId: true,
        expiresAt: true,
      },
    });

    if (expiredOffers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No expired offers found",
        data: { closedCount: 0 },
      });
    }

    const closedOffers = await prisma.jobOffer.updateMany({
      where: {
        id: { in: expiredOffers.map((o) => o.id) },
      },
      data: {
        status: "CLOSED",
        closedAt: now,
      },
    });

    logger.info("Expired job offers auto-closed", {
      closedCount: closedOffers.count,
      offerIds: expiredOffers.map((o) => o.id),
    });

    return NextResponse.json({
      success: true,
      message: `Closed ${closedOffers.count} expired job offer(s)`,
      data: { closedCount: closedOffers.count },
    });
  } catch (error) {
    logger.error("Auto-close expired offers error", { error });
    return NextResponse.json(
      { success: false, error: "Failed to close expired offers", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

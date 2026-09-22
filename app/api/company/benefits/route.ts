import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { Prisma } from "@/app/generated/prisma/client";

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.role || session.user.role !== "COMPANY") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const company = await prisma.companies.findUnique({
      where: { userId: session.user.id },
      include: {
        benefits: {
          orderBy: { name: "asc" },
        },
      },
    }) as Prisma.companiesGetPayload<{
      include: {
        benefits: { orderBy: { name: "asc" } };
      };
    }> | null;

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company not found" },
        { status: 404 }
      );
    }

    const coreBenefits = company.benefits.filter((b) => b.scope === "CORE");
    const additionalBenefits = company.benefits.filter((b) => b.scope === "ADDITIONAL");

    return NextResponse.json({
      success: true,
      data: {
        core: coreBenefits,
        additional: additionalBenefits,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch company benefits", { error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch company benefits" },
      { status: 500 }
    );
  }
}
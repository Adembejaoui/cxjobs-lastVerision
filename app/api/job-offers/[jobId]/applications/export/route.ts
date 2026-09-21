import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";
import { logger } from "@/lib/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    if (session.user.role !== "COMPANY") {
      return NextResponse.json(
        { success: false, error: "Access denied", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const { jobId } = await params;

    const company = await prisma.companies.findUnique({
      where: { userId: session.user.id },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company profile not found", code: "PROFILE_NOT_FOUND" },
        { status: 404 }
      );
    }

    const jobOffer = await prisma.jobOffer.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, companyId: true },
    });

    if (!jobOffer || jobOffer.companyId !== company.id) {
      return NextResponse.json(
        { success: false, error: "Job offer not found or access denied", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const applications = await prisma.application.findMany({
      where: { jobOfferId: jobId },
      include: {
        candidate: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
            languages: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const maxLanguages = Math.max(
      ...applications.map((app) => app.candidate?.languages?.length ?? 0),
      1
    );

    const colHeaders = ["Name", "Email", "Phone"];
    for (let i = 1; i <= maxLanguages; i++) {
      colHeaders.push(`Language ${i}`);
    }

    const dataRows: (string | number)[][] = applications.map((app) => {
      const candidate = app.candidate;
      const name = [candidate?.firstName, candidate?.lastName]
        .filter(Boolean)
        .join(" ") || candidate?.user?.name || "N/A";
      const email = candidate?.user?.email || "N/A";
      const phone = candidate?.phone || "N/A";
      const languages = candidate?.languages?.map((lang) => lang.name) ?? [];

      const row: (string | number)[] = [name, email, phone];
      languages.forEach((lang) => {
        row.push(lang);
      });
      while (row.length < colHeaders.length) {
        row.push("");
      }
      return row;
    });

    const wsData: (string | number)[][] = [colHeaders, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!ref"] = `A1:${XLSX.utils.encode_col(colHeaders.length - 1)}${wsData.length}`;

    ws["!cols"] = [
      { wch: 20 },
      { wch: 30 },
      { wch: 15 },
      ...Array.from({ length: maxLanguages }, () => ({ wch: 14 })),
    ];

    const headerFill = { type: "pattern", pattern: "solid", fgColor: { rgb: "162F67" } };
    const headerFont = { color: { rgb: "FFFFFF" }, name: "Calibri", sz: 10, bold: true };
    const textFont = { color: { rgb: "0E172F" }, name: "Calibri", sz: 10 };
    const center = { horizontal: "center" as const };
    const thinBorder = {
      left: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "E2E8F0" } },
      top: { style: "thin", color: { rgb: "E2E8F0" } },
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
    };

    colHeaders.forEach((_, c) => {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell) {
        cell.s = { fill: headerFill, font: headerFont, alignment: center };
      }
    });

    for (let r = 1; r < wsData.length; r++) {
      for (let c = 0; c < colHeaders.length; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell) {
          const isAlt = r % 2 === 0;
          cell.s = {
            font: textFont,
            border: thinBorder,
            fill: isAlt
              ? { type: "pattern", pattern: "solid", fgColor: { rgb: "F8FAFC" } }
              : { type: "pattern", pattern: "solid", fgColor: { rgb: "FFFFFF" } },
          };
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Candidates");

    const now = new Date();
    const fileName = `candidates-${jobOffer.title.replace(/\s+/g, "-").toLowerCase()}-${now.toISOString().slice(0, 10)}.xlsx`;
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    const errorInfo =
      error instanceof Error
        ? { message: error.message, name: error.name, stack: error.stack }
        : { error: String(error) };
    logger.error("Export candidates error", { error: errorInfo });
    return NextResponse.json(
      { success: false, error: "Failed to export candidates", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

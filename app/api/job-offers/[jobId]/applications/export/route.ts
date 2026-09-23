import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import ExcelJS from "exceljs";
import { logger } from "@/lib/logger";

// ─── Brand palette (matches the analytics export) ────────────────
const COLOR = {
  navy: "FF162F67",
  seafoam: "FF42B883",
  white: "FFFFFFFF",
  text: "FF0E172F",
  slate: "FFF8FAFC",
  border: "FFE2E8F0",
};

const FONT = "Calibri";

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
      const name =
        [candidate?.firstName, candidate?.lastName].filter(Boolean).join(" ") ||
        candidate?.user?.name ||
        "N/A";
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

    const languageCounts = computeLanguageCounts(applications);

    const buffer = await buildWorkbook(colHeaders, dataRows, maxLanguages, languageCounts);

    const now = new Date();
    const fileName = `candidates-${jobOffer.title.replace(/\s+/g, "-").toLowerCase()}-${now.toISOString().slice(0, 10)}.xlsx`;

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

// ─── Language breakdown helper ───────────────────────────────────

type ApplicationWithLanguages = {
  candidate?: {
    languages?: { name: string }[] | null;
  } | null;
};

function computeLanguageCounts(
  applications: ApplicationWithLanguages[]
): { language: string; count: number }[] {
  const counts = new Map<string, number>();
  applications.forEach((app) => {
    const languages = app.candidate?.languages ?? [];
    languages.forEach((lang) => {
      if (!lang?.name) return;
      counts.set(lang.name, (counts.get(lang.name) ?? 0) + 1);
    });
  });
  return Array.from(counts.entries())
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count || a.language.localeCompare(b.language));
}

function colLetter(index: number): string {
  let letter = "";
  let n = index;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

// ─── Workbook builder ───────────────────────────────────────────

async function buildWorkbook(
  colHeaders: string[],
  dataRows: (string | number)[][],
  maxLanguages: number,
  languageCounts: { language: string; count: number }[]
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CXJobs";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Candidates", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Name", key: "col0", width: 20 },
    { header: "Email", key: "col1", width: 30 },
    { header: "Phone", key: "col2", width: 15 },
    ...Array.from({ length: maxLanguages }, (_, i) => ({
      header: `Language ${i + 1}`,
      key: `col${3 + i}`,
      width: 14,
    })),
  ];

  // Header row styling
  const headerRow = sheet.getRow(1);
  headerRow.height = 20;
  colHeaders.forEach((_, c) => {
    const cell = headerRow.getCell(c + 1);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.navy } };
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.white } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // Data rows
  dataRows.forEach((row) => {
    sheet.addRow(row);
  });

  if (dataRows.length === 0) {
    const emptyRow = sheet.addRow(["No applications received for this job yet."]);
    sheet.mergeCells(`A${emptyRow.number}:${sheet.getColumn(colHeaders.length).letter}${emptyRow.number}`);
    emptyRow.getCell(1).font = { name: FONT, size: 10, italic: true, color: { argb: "FF64748B" } };
  } else {
    for (let r = 2; r <= sheet.rowCount; r++) {
      const isAlt = r % 2 === 0;
      const bg = isAlt ? COLOR.slate : COLOR.white;
      for (let c = 1; c <= colHeaders.length; c++) {
        const cell = sheet.getRow(r).getCell(c);
        cell.font = { name: FONT, size: 10, color: { argb: COLOR.text } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      }
    }
    sheet.autoFilter = {
      from: "A1",
      to: `${sheet.getColumn(colHeaders.length).letter}${sheet.rowCount}`,
    };
  }

  // Borders across the whole table (header + data)
  for (let r = 1; r <= sheet.rowCount; r++) {
    for (let c = 1; c <= colHeaders.length; c++) {
      const cell = sheet.getRow(r).getCell(c);
      cell.border = {
        top: { style: "thin", color: { argb: COLOR.border } },
        bottom: { style: "thin", color: { argb: COLOR.border } },
        left: { style: "thin", color: { argb: COLOR.border } },
        right: { style: "thin", color: { argb: COLOR.border } },
      };
    }
  }

  // ─── Language breakdown side table (same sheet) ─────────────────
  // Defaults to columns K/L/M, but shifts right automatically if the
  // candidates table (which grows with maxLanguages) would otherwise
  // run into it.
  const DEFAULT_START_COL = 11; // K
  const GAP_COLS = 2;
  const startCol = Math.max(DEFAULT_START_COL, colHeaders.length + GAP_COLS + 1);
  drawLanguageBreakdown(sheet, languageCounts, dataRows.length, startCol);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function drawLanguageBreakdown(
  sheet: ExcelJS.Worksheet,
  languageCounts: { language: string; count: number }[],
  totalCandidates: number,
  startCol: number
) {
  const c1 = startCol;
  const c2 = startCol + 1;
  const c3 = startCol + 2;
  const l1 = colLetter(c1);
  const l3 = colLetter(c3);

  sheet.getColumn(c1).width = 16;
  sheet.getColumn(c2).width = 12;
  sheet.getColumn(c3).width = 10;

  // Title band, row 1 — mirrors the main table's header row visually
  sheet.mergeCells(`${l1}1:${l3}1`);
  const title = sheet.getCell(1, c1);
  title.value = "LANGUAGE BREAKDOWN";
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.seafoam } };
  title.font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.white } };
  title.alignment = { vertical: "middle", horizontal: "center" };
  sheet.getRow(1).height = 20;

  // Column headers, row 2
  const headerRow = sheet.getRow(2);
  ["Language", "Candidates", "Share"].forEach((label, i) => {
    const cell = headerRow.getCell(c1 + i);
    cell.value = label;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.navy } };
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.white } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  if (languageCounts.length === 0) {
    const emptyRow = sheet.getRow(3);
    sheet.mergeCells(`${l1}3:${l3}3`);
    const cell = emptyRow.getCell(c1);
    cell.value = "No language data available.";
    cell.font = { name: FONT, size: 9, italic: true, color: { argb: "FF64748B" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    return;
  }

  languageCounts.forEach((entry, i) => {
    const r = 3 + i;
    const row = sheet.getRow(r);
    const isAlt = i % 2 === 1;
    const bg = isAlt ? COLOR.slate : COLOR.white;
    const share = totalCandidates > 0 ? entry.count / totalCandidates : 0;

    const langCell = row.getCell(c1);
    langCell.value = entry.language;
    langCell.font = { name: FONT, size: 10, color: { argb: COLOR.text } };
    langCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    const countCell = row.getCell(c2);
    countCell.value = entry.count;
    countCell.font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.navy } };
    countCell.alignment = { vertical: "middle", horizontal: "center" };

    const shareCell = row.getCell(c3);
    shareCell.value = share;
    shareCell.numFmt = "0.0%";
    shareCell.font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.seafoam } };
    shareCell.alignment = { vertical: "middle", horizontal: "center" };

    [langCell, countCell, shareCell].forEach((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.border = {
        top: { style: "thin", color: { argb: COLOR.border } },
        bottom: { style: "thin", color: { argb: COLOR.border } },
        left: { style: "thin", color: { argb: COLOR.border } },
        right: { style: "thin", color: { argb: COLOR.border } },
      };
    });
  });

  const lastRow = 2 + languageCounts.length;
  sheet.addConditionalFormatting({
    ref: `${l3}3:${l3}${lastRow}`,
    rules: [
      {
        type: "dataBar",
        priority: 1,
        gradient: true,
        border: false,
        minLength: 0,
        maxLength: 100,
        cfvo: [{ type: "min" }, { type: "max" }],
        color: { argb: COLOR.seafoam },
      } as unknown as ExcelJS.DataBarRuleType,
    ],
  });
}
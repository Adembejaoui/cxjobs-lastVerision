import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import ExcelJS from "exceljs";
import { z } from "zod";
import { buildJobWhere, buildAppWhere } from "@/lib/analytics-utils";

const querySchema = z.object({
  days: z.coerce.number().min(7).max(90).default(30),
  language: z.string().default("all"),
});

// ─── Brand palette ─────────────────────────────────────────────
const COLOR = {
  navy: "FF162F67",
  seafoam: "FF42B883",
  green: "FF24C491",
  lightBg: "FFF0FDF9",
  slate: "FFF1F5F9",
  white: "FFFFFFFF",
  text: "FF0E172F",
  subtext: "FF64748B",
  border: "FFE2E8F0",
  red: "FFDC2626",
};

const FONT = "Calibri";

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const parsed = querySchema.safeParse({
      days: searchParams.get("days") ?? undefined,
      language: searchParams.get("language") ?? undefined,
    });
    const days = parsed.success ? parsed.data.days : 30;
    const language = parsed.success ? parsed.data.language : "all";

    const company = await prisma.companies.findUnique({
      where: { userId: session.user.id },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company profile not found", code: "PROFILE_NOT_FOUND" },
        { status: 404 }
      );
    }

    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - days);

    const [totalJobListings, activeJobListings, receivedApplications] = await Promise.all([
      prisma.jobOffer.count({
        where: buildJobWhere(company.id, language, fromDate, { includeTimeWindow: true }),
      }),
      prisma.jobOffer.count({
        where: {
          ...buildJobWhere(company.id, language, fromDate, { includeTimeWindow: true }),
          status: "PUBLISHED",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      prisma.application.count({
        where: buildAppWhere(company.id, language, fromDate),
      }),
    ]);

    const viewsAggregate = await prisma.jobOffer.aggregate({
      where: buildJobWhere(company.id, language, fromDate, { includeTimeWindow: false }),
      _sum: { views: true },
    });
    const totalViews = Number(viewsAggregate._sum.views ?? 0);

    const jobPerformance = await prisma.jobOffer.findMany({
      where: {
        ...buildJobWhere(company.id, language, fromDate, { includeTimeWindow: true }),
        status: "PUBLISHED",
      },
      select: {
        id: true,
        title: true,
        status: true,
        customLocation: true,
        views: true,
        languages: {
          where: { level: "REQUIRED" },
          select: { language: true },
        },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const genderSql = language !== "all"
      ? `
        WITH applicants AS (
          SELECT DISTINCT a."candidateId" AS "candidateId"
          FROM applications a
          JOIN job_offers j ON a."jobOfferId" = j.id
          WHERE j."companyId" = $1
            AND j."deletedAt" IS NULL
            AND a."createdAt" >= $2
            AND a."candidateId" IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM job_languages jl
              WHERE jl."jobOfferId" = j.id
                AND jl.language = $3
                AND jl.level = 'REQUIRED'
            )
        )
        SELECT
          COUNT(*) AS "total",
          COUNT(CASE WHEN c."gender" = 'female' THEN 1 END) AS "female",
          COUNT(CASE WHEN c."gender" = 'male' THEN 1 END) AS "male"
        FROM applicants ap
        JOIN candidates c ON c.id = ap."candidateId"
        WHERE c."gender" IS NOT NULL
      `
      : `
        WITH applicants AS (
          SELECT DISTINCT a."candidateId" AS "candidateId"
          FROM applications a
          JOIN job_offers j ON a."jobOfferId" = j.id
          WHERE j."companyId" = $1
            AND j."deletedAt" IS NULL
            AND a."createdAt" >= $2
            AND a."candidateId" IS NOT NULL
        )
        SELECT
          COUNT(*) AS "total",
          COUNT(CASE WHEN c."gender" = 'female' THEN 1 END) AS "female",
          COUNT(CASE WHEN c."gender" = 'male' THEN 1 END) AS "male"
        FROM applicants ap
        JOIN candidates c ON c.id = ap."candidateId"
        WHERE c."gender" IS NOT NULL
      `;

    const genderParams = language !== "all" ? [company.id, fromDate, language] : [company.id, fromDate];
    const genderRowsRaw = await prisma.$queryRawUnsafe<Array<{ total: number; female: number; male: number }>>(genderSql, ...genderParams);
    const genderRow = genderRowsRaw[0] ?? { total: 0, female: 0, male: 0 };

    const ageSql = language !== "all"
      ? `
        WITH applicants AS (
          SELECT DISTINCT a."candidateId" AS "candidateId"
          FROM applications a
          JOIN job_offers j ON a."jobOfferId" = j.id
          WHERE j."companyId" = $1
            AND j."deletedAt" IS NULL
            AND a."createdAt" >= $2
            AND a."candidateId" IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM job_languages jl
              WHERE jl."jobOfferId" = j.id
                AND jl.language = $3
                AND jl.level = 'REQUIRED'
            )
        )
        SELECT
          SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) BETWEEN 18 AND 24 THEN 1 ELSE 0 END) AS "age_18_24",
          SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) BETWEEN 25 AND 34 THEN 1 ELSE 0 END) AS "age_25_34",
          SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) BETWEEN 35 AND 44 THEN 1 ELSE 0 END) AS "age_35_44",
          SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) BETWEEN 45 AND 55 THEN 1 ELSE 0 END) AS "age_45_55",
          SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) > 55 THEN 1 ELSE 0 END) AS "age_55_plus"
        FROM applicants ap
        JOIN candidates c ON c.id = ap."candidateId"
        WHERE c."dateOfBirth" IS NOT NULL
      `
      : `
        WITH applicants AS (
          SELECT DISTINCT a."candidateId" AS "candidateId"
          FROM applications a
          JOIN job_offers j ON a."jobOfferId" = j.id
          WHERE j."companyId" = $1
            AND j."deletedAt" IS NULL
            AND a."createdAt" >= $2
            AND a."candidateId" IS NOT NULL
        )
        SELECT
          SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) BETWEEN 18 AND 24 THEN 1 ELSE 0 END) AS "age_18_24",
          SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) BETWEEN 25 AND 34 THEN 1 ELSE 0 END) AS "age_25_34",
          SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) BETWEEN 35 AND 44 THEN 1 ELSE 0 END) AS "age_35_44",
          SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) BETWEEN 45 AND 55 THEN 1 ELSE 0 END) AS "age_45_55",
          SUM(CASE WHEN EXTRACT(YEAR FROM AGE(NOW(), c."dateOfBirth")) > 55 THEN 1 ELSE 0 END) AS "age_55_plus"
        FROM applicants ap
        JOIN candidates c ON c.id = ap."candidateId"
        WHERE c."dateOfBirth" IS NOT NULL
      `;

    const ageParams = language !== "all" ? [company.id, fromDate, language] : [company.id, fromDate];
    const ageRowsRaw = await prisma.$queryRawUnsafe<
      Array<{
        age_18_24: number;
        age_25_34: number;
        age_35_44: number;
        age_45_55: number;
        age_55_plus: number;
      }>
    >(ageSql, ...ageParams);
    const ageRow = ageRowsRaw[0] ?? { age_18_24: 0, age_25_34: 0, age_35_44: 0, age_45_55: 0, age_55_plus: 0 };

    // ─── Build workbook ───────────────────────────────────────
    const buffer = await buildWorkbook({
      days,
      language,
      now,
      totalViews,
      receivedApplications,
      totalJobListings,
      activeJobListings,
      jobPerformance,
      genderRow,
      ageRow,
    });

    const fileName = `cxjobs-analytics-${days}d-${now.toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    const errorInfo = error instanceof Error
      ? { message: error.message, name: error.name, stack: error.stack }
      : { error: String(error) };
    logger.error("Export analytics error", { error: errorInfo });
    return NextResponse.json(
      { success: false, error: "Failed to export analytics", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// ─── Workbook builder ───────────────────────────────────────────

type JobPerformanceRow = {
  title: string;
  status: string;
  customLocation: string | null;
  views: number | null;
  languages: { language: string }[];
  _count: { applications: number };
};

async function buildWorkbook(input: {
  days: number;
  language: string;
  now: Date;
  totalViews: number;
  receivedApplications: number;
  totalJobListings: number;
  activeJobListings: number;
  jobPerformance: JobPerformanceRow[];
  genderRow: { total: number; female: number; male: number };
  ageRow: {
    age_18_24: number;
    age_25_34: number;
    age_35_44: number;
    age_45_55: number;
    age_55_plus: number;
  };
}) {
  const { days, language, now, totalViews, receivedApplications, totalJobListings, activeJobListings, jobPerformance, genderRow, ageRow } = input;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CXJobs";
  workbook.created = now;
  workbook.properties.date1904 = false;

  buildSummarySheet(workbook, { days, language, now, totalViews, receivedApplications, totalJobListings, activeJobListings });
  buildJobPerformanceSheet(workbook, jobPerformance);
  buildDemographicsSheet(workbook, genderRow, ageRow);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── Sheet 1: Summary ───────────────────────────────────────────

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  data: {
    days: number;
    language: string;
    now: Date;
    totalViews: number;
    receivedApplications: number;
    totalJobListings: number;
    activeJobListings: number;
  }
) {
  const { days, language, now, totalViews, receivedApplications, totalJobListings, activeJobListings } = data;
  const sheet = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
  });

  sheet.columns = [
    { width: 4 }, { width: 22 }, { width: 22 }, { width: 4 },
    { width: 22 }, { width: 22 }, { width: 4 },
  ];

  // Title band
  sheet.mergeCells("A1:G2");
  const title = sheet.getCell("A1");
  title.value = "CXJobs Analytics Report";
  title.font = { name: FONT, size: 22, bold: true, color: { argb: COLOR.white } };
  title.alignment = { vertical: "middle", horizontal: "left", indent: 2 };
  sheet.getRow(1).height = 24;
  sheet.getRow(2).height = 24;
  fillRowRange(sheet, 1, 2, "A", "G", COLOR.navy);

  // Subtitle band
  sheet.mergeCells("A3:G3");
  const subtitle = sheet.getCell("A3");
  const periodLabel = `Last ${days} days`;
  const languageLabel = language === "all" ? "All languages" : language;
  subtitle.value = `${periodLabel}  •  ${languageLabel}  •  Generated ${now.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`;
  subtitle.font = { name: FONT, size: 11, color: { argb: COLOR.white } };
  subtitle.alignment = { vertical: "middle", horizontal: "left", indent: 2 };
  sheet.getRow(3).height = 22;
  fillRowRange(sheet, 3, 3, "A", "G", COLOR.seafoam);

  sheet.getRow(4).height = 10;

  // Section label
  sheet.mergeCells("A5:G5");
  const sectionLabel = sheet.getCell("A5");
  sectionLabel.value = "KEY METRICS";
  sectionLabel.font = { name: FONT, size: 11, bold: true, color: { argb: COLOR.subtext } };
  sheet.getRow(5).height = 18;

  // KPI cards — 2x2 grid, each spanning 2 columns
  const kpis: { label: string; value: number; accent: string; format?: string }[] = [
    { label: "Total Views", value: totalViews, accent: COLOR.navy },
    { label: "Received Applications", value: receivedApplications, accent: COLOR.seafoam },
    { label: "Total Job Listings", value: totalJobListings, accent: COLOR.navy },
    { label: "Active Job Listings", value: activeJobListings, accent: COLOR.seafoam },
  ];

  const positions = [
    { row: 6, cols: ["B", "C"] as [string, string] },
    { row: 6, cols: ["E", "F"] as [string, string] },
    { row: 10, cols: ["B", "C"] as [string, string] },
    { row: 10, cols: ["E", "F"] as [string, string] },
  ];

  kpis.forEach((kpi, i) => {
    drawKpiCard(sheet, positions[i].row, positions[i].cols, kpi.label, kpi.value, kpi.accent);
  });

  sheet.getRow(14).height = 10;

  // Footer note
  sheet.mergeCells("A15:G15");
  const note = sheet.getCell("A15");
  note.value = "See the \"Job Performance\" and \"Demographics\" tabs for the full breakdown.";
  note.font = { name: FONT, size: 9, italic: true, color: { argb: COLOR.subtext } };
}

function drawKpiCard(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  cols: [string, string],
  label: string,
  value: number,
  accent: string
) {
  const [c1, c2] = cols;
  const labelRange = `${c1}${startRow}:${c2}${startRow}`;
  const valueRange = `${c1}${startRow + 1}:${c2}${startRow + 2}`;

  sheet.mergeCells(labelRange);
  sheet.mergeCells(valueRange);

  const labelCell = sheet.getCell(`${c1}${startRow}`);
  labelCell.value = label.toUpperCase();
  labelCell.font = { name: FONT, size: 9, bold: true, color: { argb: COLOR.subtext } };
  labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  const valueCell = sheet.getCell(`${c1}${startRow + 1}`);
  valueCell.value = value;
  valueCell.numFmt = "#,##0";
  valueCell.font = { name: FONT, size: 26, bold: true, color: { argb: accent } };
  valueCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  sheet.getRow(startRow).height = 16;
  sheet.getRow(startRow + 1).height = 26;
  sheet.getRow(startRow + 2).height = 8;

  fillRowRange(sheet, startRow, startRow + 2, c1, c2, COLOR.lightBg);

  // left accent bar
  const accentCell = sheet.getCell(`${c1}${startRow}`);
  accentCell.border = { left: { style: "thick", color: { argb: accent } } };
  const accentCell2 = sheet.getCell(`${c1}${startRow + 1}`);
  accentCell2.border = { left: { style: "thick", color: { argb: accent } } };
}

function fillRowRange(sheet: ExcelJS.Worksheet, startRow: number, endRow: number, startCol: string, endCol: string, color: string) {
  const startIdx = colToIndex(startCol);
  const endIdx = colToIndex(endCol);
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startIdx; c <= endIdx; c++) {
      const cell = sheet.getCell(r, c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    }
  }
}

function colToIndex(col: string) {
  let idx = 0;
  for (let i = 0; i < col.length; i++) {
    idx = idx * 26 + (col.charCodeAt(i) - 64);
  }
  return idx;
}

// ─── Sheet 2: Job Performance ───────────────────────────────────

function buildJobPerformanceSheet(workbook: ExcelJS.Workbook, jobPerformance: JobPerformanceRow[]) {
  const sheet = workbook.addWorksheet("Job Performance", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Title", key: "title", width: 34 },
    { header: "Language", key: "language", width: 14 },
    { header: "Location", key: "location", width: 20 },
    { header: "Views", key: "views", width: 10 },
    { header: "Applications", key: "applications", width: 14 },
    { header: "Conversion", key: "conversion", width: 12 },
    { header: "Status", key: "status", width: 12 },
  ];

  styleHeaderRow(sheet.getRow(1), COLOR.navy);
  sheet.getRow(1).height = 20;

  jobPerformance.forEach((job) => {
    const views = job.views ?? 0;
    const applications = job._count.applications;
    const conversion = views > 0 ? applications / views : null;

    const row = sheet.addRow({
      title: job.title,
      language: job.languages[0]?.language ?? "N/A",
      location: job.customLocation ?? "—",
      views,
      applications,
      conversion,
      status: job.status,
    });

    row.getCell("views").font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.navy } };
    row.getCell("applications").font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.seafoam } };

    const conversionCell = row.getCell("conversion");
    if (conversion === null) {
      conversionCell.value = "N/A";
      conversionCell.font = { name: FONT, size: 10, italic: true, color: { argb: COLOR.subtext } };
    } else {
      conversionCell.numFmt = "0.0%";
      conversionCell.font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.green } };
    }
  });

  if (jobPerformance.length === 0) {
    const row = sheet.addRow({ title: "No published job listings in this period." });
    sheet.mergeCells(`A${row.number}:G${row.number}`);
    row.getCell(1).font = { name: FONT, size: 10, italic: true, color: { argb: COLOR.subtext } };
  } else {
    zebraStripe(sheet, 2, sheet.rowCount, 1, sheet.columns.length);
    sheet.autoFilter = { from: "A1", to: `G${sheet.rowCount}` };

    // Data-bar conditional formatting on the Conversion column for an at-a-glance read.
    // `cfvo` (the min/max waypoints) is required by ExcelJS's dataBar renderer even though
    // its own typings mark the field as optional — omitting it throws at write time.
    // `color` is a real, supported dataBar option at runtime even though the shipped
    // ExcelJS typings for DataBarRuleType omit it, hence the targeted cast below.
    sheet.addConditionalFormatting({
      ref: `F2:F${sheet.rowCount}`,
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

  addTableBorders(sheet, 1, sheet.rowCount, 1, sheet.columns.length);
}

// ─── Sheet 3: Demographics ──────────────────────────────────────

function buildDemographicsSheet(
  workbook: ExcelJS.Workbook,
  genderRow: { total: number; female: number; male: number },
  ageRow: { age_18_24: number; age_25_34: number; age_35_44: number; age_45_55: number; age_55_plus: number }
) {
  const sheet = workbook.addWorksheet("Demographics", {
    views: [{ showGridLines: false }],
  });

  sheet.columns = [
    { width: 16 }, { width: 10 }, { width: 12 }, { width: 4 },
    { width: 14 }, { width: 10 }, { width: 12 },
  ];

  // Gender section
  sheet.mergeCells("A1:C1");
  const genderTitle = sheet.getCell("A1");
  genderTitle.value = "GENDER DISTRIBUTION";
  styleSectionHeader(genderTitle, COLOR.navy);
  sheet.getRow(1).height = 20;
  fillRowRange(sheet, 1, 1, "A", "C", COLOR.navy);

  const genderHeaderRow = sheet.getRow(2);
  ["Category", "Count", "Share"].forEach((h, i) => {
    const cell = genderHeaderRow.getCell(1 + i);
    cell.value = h;
  });
  styleHeaderRow(genderHeaderRow, COLOR.green, 3);

  const totalGender = Number(genderRow.total ?? 0);
  const genderEntries: [string, number][] = [
    ["Female", Number(genderRow.female ?? 0)],
    ["Male", Number(genderRow.male ?? 0)],
  ];
  genderEntries.forEach(([label, count], i) => {
    const r = sheet.getRow(3 + i);
    r.getCell(1).value = label;
    r.getCell(2).value = count;
    r.getCell(3).value = totalGender > 0 ? count / totalGender : 0;
    r.getCell(3).numFmt = "0.0%";
    r.getCell(2).font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.navy } };
    r.getCell(3).font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.seafoam } };
    r.getCell(1).font = { name: FONT, size: 10, color: { argb: COLOR.text } };
  });
  zebraStripe(sheet, 3, 4, 1, 3);
  addTableBorders(sheet, 2, 4, 1, 3);

  // Age section
  sheet.mergeCells("E1:G1");
  const ageTitle = sheet.getCell("E1");
  ageTitle.value = "AGE DISTRIBUTION";
  styleSectionHeader(ageTitle, COLOR.seafoam);
  fillRowRange(sheet, 1, 1, "E", "G", COLOR.seafoam);

  const ageHeaderRow = sheet.getRow(2);
  ["Age Group", "Count", "Share"].forEach((h, i) => {
    const cell = ageHeaderRow.getCell(5 + i);
    cell.value = h;
  });
  styleHeaderRow(ageHeaderRow, COLOR.green, 3, 4);

  const ageEntries: [string, number][] = [
    ["18–24", Number(ageRow.age_18_24 ?? 0)],
    ["25–34", Number(ageRow.age_25_34 ?? 0)],
    ["35–44", Number(ageRow.age_35_44 ?? 0)],
    ["45–55", Number(ageRow.age_45_55 ?? 0)],
    ["55+", Number(ageRow.age_55_plus ?? 0)],
  ];
  const totalAge = ageEntries.reduce((sum, [, count]) => sum + count, 0);
  ageEntries.forEach(([label, count], i) => {
    const r = sheet.getRow(3 + i);
    r.getCell(5).value = label;
    r.getCell(6).value = count;
    r.getCell(7).value = totalAge > 0 ? count / totalAge : 0;
    r.getCell(7).numFmt = "0.0%";
    r.getCell(6).font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.navy } };
    r.getCell(7).font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.seafoam } };
    r.getCell(5).font = { name: FONT, size: 10, color: { argb: COLOR.text } };
  });
  zebraStripe(sheet, 3, 7, 5, 7);
  addTableBorders(sheet, 2, 7, 5, 7);

  sheet.addConditionalFormatting({
    ref: "G3:G7",
    rules: [
      {
        type: "dataBar",
        priority: 1,
        gradient: true,
        border: false,
        minLength: 0,
        maxLength: 100,
        cfvo: [{ type: "min" }, { type: "max" }],
        color: { argb: COLOR.navy },
      } as unknown as ExcelJS.DataBarRuleType,
    ],
  });
}

// ─── Shared styling helpers ──────────────────────────────────────

function styleSectionHeader(cell: ExcelJS.Cell, _accent: string) {
  cell.font = { name: FONT, size: 12, bold: true, color: { argb: COLOR.white } };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
}

function styleHeaderRow(row: ExcelJS.Row, bg: string, colCount?: number, startCol = 1) {
  const count = colCount ?? row.cellCount;
  for (let c = startCol; c < startCol + count; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.white } };
    cell.alignment = { vertical: "middle", horizontal: c === startCol ? "left" : "center" };
  }
}

function zebraStripe(sheet: ExcelJS.Worksheet, startRow: number, endRow: number, startCol: number, endCol: number) {
  for (let r = startRow; r <= endRow; r++) {
    const isEven = (r - startRow) % 2 === 1;
    const bg = isEven ? COLOR.slate : COLOR.white;
    for (let c = startCol; c <= endCol; c++) {
      const cell = sheet.getCell(r, c);
      if (!cell.fill || (cell.fill as ExcelJS.FillPattern).fgColor?.argb === undefined) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      }
      if (!cell.font) {
        cell.font = { name: FONT, size: 10, color: { argb: COLOR.text } };
      }
    }
  }
}

function addTableBorders(sheet: ExcelJS.Worksheet, startRow: number, endRow: number, startCol: number, endCol: number) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = sheet.getCell(r, c);
      cell.border = {
        top: { style: "thin", color: { argb: COLOR.border } },
        bottom: { style: "thin", color: { argb: COLOR.border } },
        left: { style: "thin", color: { argb: COLOR.border } },
        right: { style: "thin", color: { argb: COLOR.border } },
      };
    }
  }
}
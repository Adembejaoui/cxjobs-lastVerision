import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import * as XLSX from "xlsx";
import { z } from "zod";
import { pct, buildJobWhere, buildAppWhere } from "@/lib/analytics-utils";

const querySchema = z.object({
  days: z.coerce.number().min(7).max(90).default(30),
  language: z.string().default("all"),
});

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

    // ─── Build styled single-sheet Excel ─────────────
    const wb = XLSX.utils.book_new();
    const wsName = "Analytics Report";

    // Build data as array of arrays (all strings for simplicity, style later)
    const rawData: (string | number)[][] = [];

    // Row 1: Title (merged later)
    rawData.push(["CXJobs Analytics Report", "", "", "", "", "", "", ""]);
    // Row 2: Subtitle
    rawData.push([`Period: Last ${days} days  •  Language: ${language === "all" ? "All" : language}  •  Generated: ${now.toLocaleDateString()}`, "", "", "", "", "", "", ""]);
    // Row 3: Spacer
    rawData.push(["", "", "", "", "", "", "", ""]);
    // Row 4: Section: KEY METRICS
    rawData.push(["KEY METRICS", "", "", "", "", "", "", ""]);
    rawData.push(["Total Views", "", "", "Received Applications", "", "", "", ""]);
    rawData.push(["", String(totalViews), "", "", String(receivedApplications), "", "", ""]);
    rawData.push(["Total Job Listings", "", "", "Active Job Listings", "", "", "", ""]);
    rawData.push(["", String(totalJobListings), "", "", String(activeJobListings), "", "", ""]);

    // Spacer
    rawData.push(["", "", "", "", "", "", "", ""]);

    // Job Performance section
    rawData.push(["JOB PERFORMANCE", "", "", "", "", "", "", ""]);
    rawData.push(["Title", "Language", "Location", "Views", "Applications", "Conversion", "Status", ""]);

    jobPerformance.forEach((job) => {
      rawData.push([
        job.title,
        job.languages[0]?.language ?? "N/A",
        job.customLocation ?? "—",
        job.views ?? 0,
        job._count.applications,
        job.views > 0 ? Number(((job._count.applications / job.views) * 100).toFixed(1)) + "%" : "N/A",
        job.status,
        "",
      ]);
    });

    // Spacer
    rawData.push(["", "", "", "", "", "", "", ""]);

    // Gender Distribution
    rawData.push(["GENDER DISTRIBUTION", "", "", "", "", "", "", ""]);
    rawData.push(["Category", "Count", "Percentage", "", "", "", "", ""]);
    const totalGender = Number(genderRow.total ?? 0);
    rawData.push(["Female", Number(genderRow.female ?? 0), pct(Number(genderRow.female ?? 0), totalGender) + "%", "", "", "", "", ""]);
    rawData.push(["Male", Number(genderRow.male ?? 0), pct(Number(genderRow.male ?? 0), totalGender) + "%", "", "", "", "", ""]);

    // Spacer
    rawData.push(["", "", "", "", "", "", "", ""]);

    // Age Distribution
    rawData.push(["AGE DISTRIBUTION", "", "", "", "", "", "", ""]);
    rawData.push(["Age Group", "Count", "", "", "", "", "", ""]);
    rawData.push(["18-24", Number(ageRow.age_18_24 ?? 0), "", "", "", "", "", ""]);
    rawData.push(["25-34", Number(ageRow.age_25_34 ?? 0), "", "", "", "", "", ""]);
    rawData.push(["35-44", Number(ageRow.age_35_44 ?? 0), "", "", "", "", "", ""]);
    rawData.push(["45-55", Number(ageRow.age_45_55 ?? 0), "", "", "", "", "", ""]);
    rawData.push(["55+", Number(ageRow.age_55_plus ?? 0), "", "", "", "", "", ""]);

    // Create worksheet from data
    const ws = XLSX.utils.aoa_to_sheet(rawData as string[][]);
    ws["!ref"] = `A1:H${rawData.length}`;

    // Apply styles
    const navyFill = { type: "pattern", pattern: "solid", fgColor: { rgb: "162F67" } };
    const seafoamFill = { type: "pattern", pattern: "solid", fgColor: { rgb: "42B883" } };
    const greenFill = { type: "pattern", pattern: "solid", fgColor: { rgb: "24C491" } };
    const lightFill = { type: "pattern", pattern: "solid", fgColor: { rgb: "F0FDF9" } };
    const slateFill = { type: "pattern", pattern: "solid", fgColor: { rgb: "F1F5F9" } };
    const whiteFill = { type: "pattern", pattern: "solid", fgColor: { rgb: "FFFFFF" } };
    const whiteFont = { color: { rgb: "FFFFFF" }, name: "Calibri" };
    const textFont = { color: { rgb: "0E172F" }, name: "Calibri" };
    const lightTextFont = { color: { rgb: "64748B" }, name: "Calibri" };
    const center = { horizontal: "center" as const };

    // Row 1: Title - navy bg, white font, centered, large
    for (let c = 0; c < 8; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell) {
        cell.s = { fill: navyFill, font: { ...whiteFont, sz: 16, bold: true }, alignment: { horizontal: "center", vertical: "center" } };
      }
    }

    // Row 2: Subtitle - seafoam bg, white font
    for (let c = 0; c < 8; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 1, c })];
      if (cell) {
        cell.s = { fill: seafoamFill, font: { ...whiteFont, sz: 10 }, alignment: { horizontal: "center" } };
      }
    }

    // Row 4: KEY METRICS header - navy bg
    for (let c = 0; c < 8; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 3, c })];
      if (cell) {
        cell.s = { fill: navyFill, font: { ...whiteFont, sz: 12, bold: true } };
      }
    }

    // KPI labels (rows 4, 6) - light bg, light text
    [4, 6].forEach((row) => {
      for (let c = 0; c < 8; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r: row, c })];
        if (cell) {
          cell.s = { fill: lightFill, font: { ...lightTextFont, sz: 9 } };
        }
      }
    });

    // KPI values (rows 5, 7) - light bg, colored large font
    [5, 7].forEach((row) => {
      const isSeafoam = row === 5;
      const color = isSeafoam ? "42B883" : "162F67";
      for (let c = 0; c < 8; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r: row, c })];
        if (cell) {
          cell.s = { fill: lightFill, font: { color: { rgb: color }, sz: 16, bold: true, name: "Calibri" } };
        }
      }
    });

    // Section headers (rows after KEY METRICS)
    let currentRow = 8;
    while (currentRow < rawData.length) {
      const rowVal = rawData[currentRow]?.[0];
      if (rowVal && typeof rowVal === "string" && rowVal === rowVal.toUpperCase() && rowVal.length > 3 && /[A-Z]/.test(rowVal)) {
        const fill = rowVal.includes("JOB") ? navyFill : (rowVal.includes("GENDER") || rowVal.includes("AGE")) ? seafoamFill : navyFill;
        for (let c = 0; c < 8; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r: currentRow, c })];
          if (cell) {
            cell.s = { fill, font: { ...whiteFont, sz: 12, bold: true } };
          }
        }
      }
      // Table headers (rows with "Title", "Category", "Age Group", etc.)
      if (rowVal === "Title" || rowVal === "Category" || rowVal === "Age Group") {
        for (let c = 0; c < 8; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r: currentRow, c })];
          if (cell) {
            cell.s = { fill: greenFill, font: { ...whiteFont, sz: 10, bold: true }, alignment: center };
          }
        }
      }
      currentRow++;
    }

    // Table data cells - add borders and alternating bg
    let inTable = false;
    let tableRowCount = 0;
    for (let r = 0; r < rawData.length; r++) {
      const rowVal = rawData[r]?.[0];
      if (rowVal === "Title") {
        inTable = true;
        tableRowCount = 0;
        continue;
      }
      if (inTable) {
        if (typeof rowVal === "string" && ["JOB PERFORMANCE", "GENDER DISTRIBUTION", "AGE DISTRIBUTION", ""].includes(rowVal)) {
          inTable = false;
          continue;
        }
        tableRowCount++;
        const bg = tableRowCount % 2 === 0 ? whiteFill : slateFill;
        for (let c = 0; c < 8; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r: r, c })];
          if (cell) {
            const baseStyle = cell.s || {};
            cell.s = {
              ...baseStyle,
              fill: bg,
              font: { ...textFont, sz: 10 },
              border: {
                left: { style: "thin", color: { rgb: "E2E8F0" } },
                right: { style: "thin", color: { rgb: "E2E8F0" } },
                top: { style: "thin", color: { rgb: "E2E8F0" } },
                bottom: { style: "thin", color: { rgb: "E2E8F0" } },
              },
            };
          }
        }
      }
    }

    // Highlight Conversion column (col E=5) values in seafoam green
    for (let r = 0; r < rawData.length; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: 5 })];
      if (cell && typeof cell.v === "string" && cell.v.includes("%")) {
        cell.s = { ...cell.s, font: { color: { rgb: "42B883" }, sz: 10, bold: true } };
      }
      // Highlight Views column (col D=4) - dark navy font
      const viewCell = ws[XLSX.utils.encode_cell({ r, c: 3 })];
      if (viewCell && typeof viewCell.v === "string" && /^\d+$/.test(viewCell.v)) {
        viewCell.s = { ...viewCell.s, font: { color: { rgb: "162F67" }, sz: 10, bold: true } };
      }
      // Highlight Applications column (col E=4) - seafoam green
      const appCell = ws[XLSX.utils.encode_cell({ r, c: 4 })];
      if (appCell && typeof appCell.v === "string" && /^\d+$/.test(appCell.v)) {
        appCell.s = { ...appCell.s, font: { color: { rgb: "42B883" }, sz: 10, bold: true } };
      }
    }

    // Merge cells for title and subtitle rows
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } },
    ];

    // Set column widths
    ws["!cols"] = [
      { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
      { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, wsName);

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
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

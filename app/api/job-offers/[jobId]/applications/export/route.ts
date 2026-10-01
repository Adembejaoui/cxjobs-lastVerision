import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import ExcelJS from "exceljs";
import { logger } from "@/lib/logger";
import { checkRateLimitAsync, getRateLimitHeaders } from "@/lib/rate-limit";
import { Prisma, type ApplicationStatus } from "@/app/generated/prisma/client";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * Rows read per database round-trip during the export.
 *
 * The export is unbounded by design (H3: every matching application, across
 * every page), so the full result set is never materialized in memory. A
 * fixed chunk keeps peak memory flat regardless of total row count while
 * keeping each query small enough to use the application indexes and to
 * return its pooled connection promptly.
 */
const EXPORT_CHUNK = 2000;

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

/**
 * Makes a job title safe to embed in the quoted `Content-Disposition` filename.
 *
 * Defense-in-depth at the header boundary. Job titles are company-supplied and
 * the title validation (`z.string().min(5).max(100)`) rejects neither quotes nor
 * control characters, so a title containing `"` could terminate the quoted
 * string early, and CR/LF is the classic response-splitting vector. Characters
 * that are illegal in a Windows filename are replaced rather than dropped so the
 * readable part of the title survives, and Unicode letters are preserved — only
 * the unsafe characters change, and the existing lower-casing behaviour is kept.
 */
function sanitizeFileNameSegment(value: string): string {
  return (
    value
      // Strip CR/LF outright: these must never reach a header value.
      .replace(/[\r\n]/g, "")
      // Quote characters, path separators, wildcards, reserved punctuation and
      // control characters (including DEL) cannot appear in a filename.
      .replace(/['"`/\\:*?<>|\u0000-\u001F\u007F]/g, "-")
      // Collapse the remaining whitespace into single hyphens.
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "job"
  );
}

// ─── Export filter parsing ──────────────────────────────────────
//
// Mirrors `app/api/job-offers/[jobId]/applications/route.ts` exactly, so the
// exported workbook contains precisely the rows the applications list would show
// for the same filter state. These are deliberately duplicated rather than
// imported from that route, matching the precedent set by the SSR page: each
// call site builds its own `where` from an untrusted query string, so the
// accepted values and the LIKE escaping must stay identical in each.

const ALLOWED_STATUSES = [
  "NOUVEAU",
  "EN_COURS_EXAMEN",
  "ENTRETIEN",
  "EMBAUCHES",
  "REFUSE",
] as const satisfies readonly ApplicationStatus[];

const MAX_SEARCH_LENGTH = 100;

/**
 * Prisma `contains` compiles to LIKE/ILIKE, where `%` and `_` are wildcards,
 * while the list UI filters with `String.includes`, where they are ordinary
 * characters. They are escaped so user input cannot widen the match. The
 * backslash is escaped first so an escaped wildcard is not re-escaped.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** An unknown value is ignored rather than forwarded, so bad input cannot 500. */
function parseStatus(raw: string | null): ApplicationStatus | undefined {
  if (!raw) return undefined;
  const candidate = raw.toUpperCase();
  return (ALLOWED_STATUSES as readonly string[]).includes(candidate)
    ? (candidate as ApplicationStatus)
    : undefined;
}

function parseIsSaved(raw: string | null): boolean | undefined {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return undefined;
}

function parseSearch(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().slice(0, MAX_SEARCH_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  // Hoisted out of the `try` so the outer `catch` can reap a completed export
  // when something throws between the workbook finishing and the response being
  // handed off (a `createReadStream` / `Readable.toWeb` / `NextResponse`
  // construction failure). It is cleared the moment ownership passes to the
  // response stream, so `if (tmpPath)` in the `catch` means "not yet handed
  // off" exactly. Deletion is not moved into a `finally`: that would run as the
  // `return` completes and could remove the file before the response read it.
  let tmpPath: string | null = null;

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

    // The export is the most expensive read on this feature: it scans every
    // application for the job, loads candidate/user/language rows and builds a
    // full ExcelJS workbook in memory. It is rate limited per authenticated
    // COMPANY user so the bucket is shared across that user's jobs, before any
    // database or workbook work is performed.
    const EXPORT_LIMIT = { windowMs: 60_000, max: 5 };
    const rl = await checkRateLimitAsync(
      `applications-export:${session.user.id}`,
      EXPORT_LIMIT
    );
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        {
          status: 429,
          headers: {
            ...getRateLimitHeaders(rl),
            // getRateLimitHeaders exposes the reset point as X-RateLimit-Reset;
            // surface the same value as the standard Retry-After delta in seconds.
            "Retry-After": String(
              Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))
            ),
          },
        }
      );
    }

    const { jobId } = await params;

    // The company and job lookups are independent — the company is resolved from
    // the authenticated session, never from the request — so they run
    // concurrently. Both results are awaited before any check, so the ownership
    // comparison below is made only once both are in hand.
    const [company, jobOffer] = await Promise.all([
      prisma.companies.findUnique({
        where: { userId: session.user.id },
      }),
      prisma.jobOffer.findUnique({
        where: { id: jobId },
        select: { id: true, title: true, companyId: true, deletedAt: true },
      }),
    ]);

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company profile not found", code: "PROFILE_NOT_FOUND" },
        { status: 404 }
      );
    }

    // A soft-deleted job is treated exactly like a missing one. Folding it into
    // the existing guard keeps a single 404 response that is identical whether
    // the job never existed, belongs to another company, or has been deleted —
    // so the check cannot be used to probe for the existence of other jobs.
    if (!jobOffer || jobOffer.deletedAt || jobOffer.companyId !== company.id) {
      return NextResponse.json(
        { success: false, error: "Job offer not found or access denied", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Filter semantics are identical to the applications list API. `jobOfferId`
    // is pinned to the authorized job and is never replaced by a filter; every
    // other condition is ANDed onto it, so search / status / isSaved can only
    // narrow the export, never widen the job scope. Pagination parameters are
    // deliberately ignored — the export always covers every matching
    // application, not just the page the recruiter happens to be viewing.
    const { searchParams } = new URL(request.url);
    const status = parseStatus(searchParams.get("status"));
    const isSaved = parseIsSaved(searchParams.get("isSaved"));
    const search = parseSearch(searchParams.get("search"));

    const where: Prisma.ApplicationWhereInput = {
      jobOfferId: jobId,
      ...(status !== undefined && { status }),
      ...(isSaved !== undefined && { isSaved }),
      ...(search !== undefined && {
        candidate: {
          is: {
            user: {
              is: {
                OR: [
                  { name: { contains: escapeLikePattern(search), mode: "insensitive" } },
                  { email: { contains: escapeLikePattern(search), mode: "insensitive" } },
                ],
              },
            },
          },
        },
      }),
    };

    // Phase 1 — lean aggregate scan (H3/M6).
    //
    // Only the columns the aggregates need are projected, so each chunk is
    // small. Nothing except `maxLanguages` (a single integer) gates the
    // workbook's column layout, and `languageCounts` is a frequency Map, so
    // neither requires the full application set to be resident. Skip/take is
    // unusable here because `skip` is O(offset) and the export has no known
    // total; instead each page carries an explicit lexicographic boundary built
    // from the previous chunk's last row (see `buildPageWhere`), so the pass is
    // O(limit) per page, needs no cursor row to exist, and cannot mistake a
    // deleted cursor row for end-of-data. The ordering is `createdAt DESC, id
    // DESC`, deterministic across pages and across both phases.
    const { maxLanguages, languageCounts, totalCandidates } =
      await aggregateExport(where);

    const colHeaders = ["Name", "Email", "Phone"];
    for (let i = 1; i <= maxLanguages; i++) {
      colHeaders.push(`Language ${i}`);
    }

    // Phase 2 — streaming workbook generation to a temp file.
    //
    // ExcelJS WorkbookWriter writes the XLSX zip directly to disk as rows are
    // committed, so the workbook is never held in RAM. Rows are styled at
    // write time (the same style objects and same parity logic the previous
    // in-memory builder used), which eliminates the second full-grid styling
    // traversal entirely. The temp file is deleted in Phase 3 after the
    // response has finished (or failed).
    tmpPath = path.join(
      os.tmpdir(),
      `cxjobs-export-${crypto.randomUUID()}.xlsx`
    );
    // Captured by value: the read-stream `cleanup` closure below must keep
    // working on the real path regardless of the `let` the outer `catch` reads.
    const filePath: string = tmpPath;

    try {
      await buildWorkbookStream(
        filePath,
        colHeaders,
        maxLanguages,
        languageCounts,
        totalCandidates,
        where
      );
    } catch (error) {
      const errorInfo =
        error instanceof Error
          ? { message: error.message, name: error.name, stack: error.stack }
          : { error: String(error) };
      logger.error("Export candidates error", { error: errorInfo });
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Best-effort cleanup; the error below is the one the caller sees.
      }
      return NextResponse.json(
        { success: false, error: "Failed to export candidates", code: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }

    // Phase 3 — streaming HTTP response.
    //
    // The file is read at the network's pace (64 KiB high-water mark), so the
    // response body is bounded by the read buffer regardless of export size.
    // The Node stream is converted to a Web ReadableStream, which is a valid
    // BodyInit for Next.js Route Handlers on Node 18+ (Next 16 runs on Node 20+).
    const readStream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });
    const body = Readable.toWeb(readStream) as ReadableStream<Uint8Array>;

    const cleanup = () => {
      fs.unlink(filePath, () => {
        /* best-effort; file may already be gone */
      });
    };

    readStream.on("error", cleanup);
    readStream.on("close", cleanup);

    const now = new Date();
    const fileName = `candidates-${sanitizeFileNameSegment(jobOffer.title)}-${now.toISOString().slice(0, 10)}.xlsx`;

    // Ownership of the file passes to the response stream here: from this point
    // the read stream's `error`/`close` handlers are the only thing that may
    // delete it, and `tmpPath` being null keeps the outer `catch` from ever
    // touching a file the response is still reading.
    const response = new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        // The workbook carries candidate name, email and phone. Stated explicitly
        // so the no-store guarantee does not depend on a framework default, and so
        // no shared cache or browser store can retain a PII export.
        "Cache-Control": "private, no-store",
      },
    });

    tmpPath = null;
    return response;
  } catch (error) {
    const errorInfo =
      error instanceof Error
        ? { message: error.message, name: error.name, stack: error.stack }
        : { error: String(error) };
    logger.error("Export candidates error", { error: errorInfo });
    // Reachable only before the response was handed off — the `return` above is
    // the last statement in the `try` — so this can never delete a file the
    // client is still streaming. Wrapped in its own try so a missing file, or
    // one an earlier path already removed, is a no-op and the JSON envelope
    // below is still the error the caller sees.
    if (tmpPath) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // Best-effort cleanup; the response below is the error the caller sees.
      }
    }
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

/**
 * The application fields the workbook actually consumes.
 *
 * Mirrors the export query's explicit `select` exactly, so the workbook builder
 * depends on the exported contract rather than on the full Application row.
 */
type ExportApplication = {
  candidate: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    user: { name: string | null; email: string };
    languages: { name: string }[];
  };
};

/**
 * Projects one application into its worksheet row.
 *
 * Called per row while the worksheet is being written, so the projected rows
 * are never all held in memory at once.
 */
function projectApplicationRow(
  app: ExportApplication,
  colHeaders: string[]
): (string | number)[] {
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
}

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

// ─── Deterministic chunked read ──────────────────────────────────

/**
 * Ordering used by both export passes.
 *
 * `id` is the tie-breaker for `createdAt`, so rows sharing a timestamp keep the
 * same relative order between chunks and between Phase 1 and Phase 2. Because
 * `id` is the primary key the pair is a total order, which is what lets
 * `buildPageWhere` describe "everything after the last row of the previous
 * chunk" exactly: without the `id` tie-breaker, rows with an identical
 * `createdAt` could reorder between two `findMany` calls and be silently
 * dropped or repeated across a chunk boundary.
 */
const EXPORT_ORDER_BY: Prisma.ApplicationOrderByWithRelationInput[] = [
  { createdAt: "desc" },
  { id: "desc" },
];

/** The last row of the previously read chunk, or `undefined` on the first query. */
type ExportBoundary = { createdAt: Date; id: string } | undefined;

/**
 * Builds the `where` for one chunk of the export.
 *
 * The boundary is an explicit lexicographic predicate rather than Prisma's
 * `cursor` / `skip: 1`. `cursor` works by looking the cursor row up to recover
 * its `createdAt`; `Application` rows are removed by cascade (`onDelete:
 * Cascade` on both `candidate` and `jobOffer`), so a row deleted between two
 * chunks leaves Prisma returning an *empty* page instead of an error, which the
 * loop would read as "end of dataset" and the export would silently truncate —
 * a direct H3 violation. The predicate below is self-contained: it needs no
 * row to exist, so an empty chunk now provably means there are no matching rows
 * after the boundary, i.e. genuine exhaustion.
 *
 * The comparison is strict, so the previous chunk's last row is excluded by the
 * predicate itself and no `skip: 1` is needed. The base `where` is never
 * mutated — each page gets a fresh object, and the H3 filters are carried
 * through as the first `AND` branch, so filtering semantics are identical on
 * every page.
 */
function buildPageWhere(
  where: Prisma.ApplicationWhereInput,
  boundary: ExportBoundary
): Prisma.ApplicationWhereInput {
  if (!boundary) return where;
  const { createdAt, id } = boundary;
  return {
    AND: [
      where,
      {
        OR: [
          { createdAt: { lt: createdAt } },
          { createdAt: { equals: createdAt }, id: { lt: id } },
        ],
      },
    ],
  };
}

type ExportAggregate = {
  maxLanguages: number;
  languageCounts: { language: string; count: number }[];
  totalCandidates: number;
};

/**
 * Phase 1 — single streaming pass that computes everything the workbook's
 * layout needs before a single cell is written.
 *
 * Only `candidate.languages.name` is projected. Names, e-mail addresses, phone
 * numbers and user rows are never loaded here, so a chunk of 2000 rows costs a
 * fraction of a full application row. Each chunk is folded into the running
 * aggregates and then dropped: the only state that survives a chunk is three
 * values (`maxLanguages`, `totalCandidates`) plus the frequency Map, so peak
 * memory is a function of the chunk size, not of the export size.
 *
 * The pass is unbounded (H3): it continues until a chunk comes back short or
 * empty, which — the boundary being a self-contained predicate rather than a
 * cursor lookup — means every matching application across every page has been
 * counted.
 */
async function aggregateExport(
  where: Prisma.ApplicationWhereInput
): Promise<ExportAggregate> {
  const counts = new Map<string, number>();
  let maxLanguages = 0;
  let totalCandidates = 0;
  let boundary: ExportBoundary;

  for (;;) {
    const chunk = await prisma.application.findMany({
      where: buildPageWhere(where, boundary),
      select: {
        id: true,
        createdAt: true,
        candidate: {
          select: {
            languages: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: EXPORT_ORDER_BY,
      take: EXPORT_CHUNK,
    });

    if (chunk.length === 0) break;

    for (const app of chunk) {
      totalCandidates += 1;
      const languageCount = app.candidate?.languages.length ?? 0;
      if (languageCount > maxLanguages) {
        maxLanguages = languageCount;
      }
    }

    // Folded per chunk rather than accumulated: the Map grows with the number
    // of distinct languages, not with the number of applications.
    for (const { language, count } of computeLanguageCounts(chunk)) {
      counts.set(language, (counts.get(language) ?? 0) + count);
    }

    // A short chunk means the table is exhausted. The boundary is rebuilt from
    // this chunk's last row, which is the row the next chunk must resume after.
    if (chunk.length < EXPORT_CHUNK) break;

    const last = chunk[chunk.length - 1];
    boundary = { createdAt: last.createdAt, id: last.id };
  }

  // Guarantees at least the `Language 1` column exists even when no candidate
  // has any language, which keeps the column layout stable.
  if (maxLanguages < 1) {
    maxLanguages = 1;
  }

  // Uncapped (M6): every represented language survives, no matter how many
  // distinct ones a job has attracted.
  const languageCounts = Array.from(counts.entries())
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count || a.language.localeCompare(b.language));

  return { maxLanguages, languageCounts, totalCandidates };
}

// ─── Streaming workbook builder ──────────────────────────────────

/**
 * Phase 2 — writes the workbook to `tmpPath` and returns once the file is
 * complete on disk.
 *
 * ExcelJS `WorkbookWriter` is a streaming writer: each row is serialised into
 * the XLSX zip and released from memory as soon as `row.commit()` is called, so
 * peak memory is bounded by a single row rather than by the whole export. The
 * caller owns the file's lifetime (response streaming, then cleanup); nothing
 * here deletes it, so a failure propagates to the caller's cleanup path.
 *
 * Rows are styled at write time — same style objects, same zebra parity, same
 * columns as the previous in-memory builder — so the second full-grid styling
 * traversal is gone entirely.
 */
async function buildWorkbookStream(
  tmpPath: string,
  colHeaders: string[],
  maxLanguages: number,
  languageCounts: { language: string; count: number }[],
  totalCandidates: number,
  where: Prisma.ApplicationWhereInput
) {
  // The zip is written through an explicitly restricted stream instead of the
  // `filename` option, which internally calls `fs.createWriteStream(path)` with
  // no mode and therefore creates the file 0644 (subject to umask) on Linux.
  // The workbook holds candidate names, e-mail addresses and phone numbers, so
  // the file is created 0600 — readable only by the process owner. `flags: 'wx'`
  // makes the create exclusive, so a pre-existing path at this name is never
  // opened, truncated or followed; the UUID makes a collision practically
  // impossible, and a failure here surfaces as a rejected `workbook.commit()`
  // that the caller's existing cleanup path already handles.
  //
  // Ownership is unchanged from the `filename` path: `WorkbookWriter` pipes the
  // archive into the supplied stream and `_finalize()` resolves on that
  // stream's `finish` (and rejects on its `error`), so `await workbook.commit()`
  // still means the XLSX is complete on disk before Phase 3 reads it.
  const output = fs.createWriteStream(tmpPath, { mode: 0o600, flags: "wx" });

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: output,
    // Without this the streaming writer installs a mock style manager and every
    // fill, font, border and conditional format below would be silently dropped.
    useStyles: true,
  });
  // `WorkbookWriter` has no `Workbook.xlsx` writer, so these two are the only
  // document metadata — they are serialised into docProps/core.xml on commit.
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

  // ExcelJS stores styles by reference — `cell.font = x` assigns `x` straight
  // into `cell.style` (lib/doc/cell.js) and the writer only ever reads it — so
  // these are built once and shared by every cell instead of being re-allocated
  // per cell. Treat them as immutable: mutating one would restyle every cell
  // that references it.
  const dataFont: Partial<ExcelJS.Font> = {
    name: FONT,
    size: 10,
    color: { argb: COLOR.text },
  };
  const alternateFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLOR.slate },
  };
  const baseFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLOR.white },
  };
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: COLOR.border } },
    bottom: { style: "thin", color: { argb: COLOR.border } },
    left: { style: "thin", color: { argb: COLOR.border } },
    right: { style: "thin", color: { argb: COLOR.border } },
  };

  const lastCandidateCol = sheet.getColumn(colHeaders.length).letter;

  // ─── Language breakdown side table (same sheet) ─────────────────
  // Defaults to columns K/L/M, but shifts right automatically if the
  // candidates table (which grows with maxLanguages) would otherwise
  // run into it.
  //
  // Drawn from the Phase 1 aggregates only — the applications are not resident
  // here — and drawn *before* the candidate rows: the breakdown shares rows 1..n
  // with the candidates table, and a streamed row is written to the zip and
  // released the moment it is committed, so these cells have to exist on those
  // rows before the candidate pass commits them.
  const DEFAULT_START_COL = 11; // K
  const GAP_COLS = 2;
  const startCol = Math.max(DEFAULT_START_COL, colHeaders.length + GAP_COLS + 1);
  drawLanguageBreakdown(sheet, languageCounts, totalCandidates, startCol);

  // Header row (row 1). Cells are assigned individually rather than through
  // `row.values` / `addRow`, because both reset the row's cells and would
  // discard the breakdown title band that already occupies row 1.
  const headerRow = sheet.getRow(1);
  headerRow.height = 20;
  colHeaders.forEach((label, c) => {
    const cell = headerRow.getCell(c + 1);
    cell.value = label;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.navy } };
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.white } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = thinBorder;
  });
  headerRow.commit();

  // ─── Phase 2: chunked read, projected and streamed row by row ──
  //
  // Same `where`, same ordering, same boundary logic and same chunking as
  // Phase 1, so both passes traverse the same ordered result set. Each chunk
  // is released before the next query runs, and each row is committed (written
  // to the zip and dropped) before the next one is projected: nothing
  // accumulates, and no `applications` array is ever built.
  let boundary: ExportBoundary;
  let rowNumber = 1; // row 1 is the header, already committed above

  // Whether the candidate table is empty is decided by the rows Phase 2
  // actually wrote, never by Phase 1's `totalCandidates`. The two passes read
  // the database independently, so an application created or deleted between
  // them would otherwise run the empty-state branch against rows that were
  // already committed — and `WorksheetWriter.getRow` throws
  // "Out of bounds: this row has been committed" for any row behind the write
  // head, turning a valid export into a 500. The inverse case (Phase 1 saw
  // rows, Phase 2 saw none) is handled by the same flag, so the workbook never
  // ends up header-only with no notice.
  let wroteRows = false;

  for (;;) {
    const chunk = await prisma.application.findMany({
      where: buildPageWhere(where, boundary),
      select: {
        id: true,
        createdAt: true,
        candidate: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            user: { select: { name: true, email: true } },
            languages: { select: { name: true } },
          },
        },
      },
      orderBy: EXPORT_ORDER_BY,
      take: EXPORT_CHUNK,
    });

    if (chunk.length === 0) break;

    for (const app of chunk) {
      rowNumber += 1;

      // M4 — the row is projected directly from the application object; there
      // is no intermediate rows array. Assigned cell by cell for the same
      // reason as the header: rows shared with the breakdown table must keep
      // their existing cells.
      const values = projectApplicationRow(app, colHeaders);
      const row = sheet.getRow(rowNumber);
      values.forEach((value, i) => {
        row.getCell(i + 1).value = value;
      });

      // Styling applied here, at write time, instead of in a later full-grid
      // traversal. Same objects, same parity, same covered columns as before:
      // the zebra fill alternates on the absolute worksheet row number, and the
      // whole candidate width (including the padding cells that carry no value)
      // is styled so the grid stays uniform.
      const zebraFill = rowNumber % 2 === 0 ? alternateFill : baseFill;
      for (let c = 1; c <= colHeaders.length; c++) {
        const cell = row.getCell(c);
        cell.font = dataFont;
        cell.fill = zebraFill;
        cell.border = thinBorder;
      }

      row.commit();
      wroteRows = true;
    }

    if (chunk.length < EXPORT_CHUNK) break;

    const last = chunk[chunk.length - 1];
    boundary = { createdAt: last.createdAt, id: last.id };
  }

  if (!wroteRows) {
    // Zero-application state: a merged, italic notice directly under the
    // header, exactly as before — same text, same merge, same styling, and
    // only the border (the zebra pass never ran when there were no data rows).
    // Reached only when Phase 2 committed no candidate row, so the worksheet
    // write head is still at row 2 and `getRow(2)` is in bounds.
    const emptyRow = sheet.getRow(2);
    emptyRow.getCell(1).value = "No applications received for this job yet.";
    sheet.mergeCells(`A${emptyRow.number}:${lastCandidateCol}${emptyRow.number}`);
    emptyRow.getCell(1).font = { name: FONT, size: 10, italic: true, color: { argb: "FF64748B" } };
    for (let c = 1; c <= colHeaders.length; c++) {
      emptyRow.getCell(c).border = thinBorder;
    }
    emptyRow.commit();
  } else {
    // Anchored at A1 and ending on the last row actually written to the
    // candidates table — the row counter above, never a hardcoded count.
    sheet.autoFilter = {
      from: "A1",
      to: `${lastCandidateCol}${rowNumber}`,
    };
  }

  // Flushes the worksheet (remaining uncommitted rows, autoFilter, merges and
  // conditional formatting) and closes the zip. Resolving means the file on
  // disk is complete, so the caller can stream it straight to the response.
  await workbook.commit();
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
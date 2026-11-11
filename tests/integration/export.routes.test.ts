/**
 * Excel export after removing the unused `xlsx` package: the route writes the
 * workbook with exceljs only. Verified by reading the produced file back.
 */
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { installMocks, resetState, as, req, params, IDS } from "./harness";

let exportRoute: typeof import("@/app/api/job-offers/[jobId]/applications/export/route");
before(async () => {
  installMocks();
  exportRoute = await import("@/app/api/job-offers/[jobId]/applications/export/route");
});
beforeEach(resetState);
after(() => setTimeout(() => process.exit(0), 50).unref());

const run = (jobId: string) =>
  exportRoute.GET(req(`/api/job-offers/${jobId}/applications/export`), params({ jobId }));

test("xlsx removed: package is no longer resolvable", async () => {
  await assert.rejects(import("xlsx" as string));
});

test("export: owning company gets a valid .xlsx produced by exceljs", async () => {
  as("companyA");
  const res = await run(IDS.jobAPub);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.equal(bytes.subarray(0, 2).toString("latin1"), "PK"); // zip container
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  assert.ok(wb.worksheets.length >= 1);
  const text = wb.worksheets.map((ws) => ws.getSheetValues().flat().join(" ")).join(" ");
  assert.match(text, /cand@cx\.test|cand2@cx\.test|Cand/);
});

test("export: other company and candidates cannot export", async () => {
  as("companyB");
  assert.ok([403, 404].includes((await run(IDS.jobAPub)).status));
  as("candidate");
  assert.ok([401, 403, 404].includes((await run(IDS.jobAPub)).status));
  as("anon");
  assert.equal((await run(IDS.jobAPub)).status, 401);
});

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { extractTextFromPDF } from "../../lib/cv-parser";

/** Build a small but well-formed PDF (with xref) containing one text line per page. */
function buildPdf(pageTexts: string[]): Buffer {
  const objects: string[] = [];
  const pageIds: number[] = [];
  const fontId = 3 + pageTexts.length * 2;
  pageTexts.forEach((text, i) => {
    const pageId = 3 + i * 2;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    const stream = `BT /F1 12 Tf 20 100 Td (${text}) Tj ET`;
    objects[pageId] = `<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents ${contentId} 0 R/Resources<</Font<</F1 ${fontId} 0 R>>>>>>`;
    objects[contentId] = `<</Length ${stream.length}>>stream\n${stream}\nendstream`;
  });
  objects[1] = "<</Type/Catalog/Pages 2 0 R>>";
  objects[2] = `<</Type/Pages/Kids[${pageIds.map((id) => `${id} 0 R`).join(" ")}]/Count ${pageIds.length}>>`;
  objects[fontId] = "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>";

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefAt = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<</Size ${objects.length}/Root 1 0 R>>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

// pino-pretty (dev logger transport) keeps a worker thread alive.
after(() => setTimeout(() => process.exit(0), 50).unref());

test("pdfjs v6: extracts text from a valid PDF", async () => {
  const text = await extractTextFromPDF(buildPdf(["Jane Doe Customer Service Agent"]));
  assert.match(text, /Jane Doe Customer Service Agent/);
});

test("pdfjs v6: multi-page text is extracted in order", async () => {
  const text = await extractTextFromPDF(buildPdf(["Page one", "Page two"]));
  assert.ok(text.indexOf("Page one") < text.indexOf("Page two"));
});

test("pdfjs v6: page count is bounded (resource limit)", async () => {
  const pages = Array.from({ length: 40 }, (_, i) => `P${i + 1}`);
  const text = await extractTextFromPDF(buildPdf(pages));
  assert.match(text, /\bP30\b/);
  assert.doesNotMatch(text, /\bP31\b/);
});

test("pdfjs v6: malformed input fails with a generic error (no internal details)", async () => {
  await assert.rejects(extractTextFromPDF(Buffer.from("%PDF-1.4\ngarbage that is not a pdf")), {
    message: "Failed to parse PDF file",
  });
  await assert.rejects(extractTextFromPDF(Buffer.from("<html><script>alert(1)</script></html>")), {
    message: "Failed to parse PDF file",
  });
});

test("M6: a hanging parse is stopped at the deadline, the worker is terminated, and the main thread stays responsive", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const beat = path.join(os.tmpdir(), `cx-pdf-heartbeat-${process.pid}-${Date.now()}.txt`);
  fs.writeFileSync(beat, "");
  // Busy-loops forever, writing a heartbeat every ~20 ms.
  const hanging = `
    const fs = require("node:fs");
    let last = 0;
    for (;;) { const now = Date.now(); if (now - last > 20) { fs.appendFileSync(${JSON.stringify(beat)}, "."); last = now; } }
  `;
  let mainTicks = 0;
  const ticker = setInterval(() => mainTicks++, 10);
  const t0 = Date.now();
  try {
    await assert.rejects(extractTextFromPDF(buildPdf(["x"]), { timeoutMs: 300, workerSource: hanging }), {
      message: "Failed to parse PDF file",
    });
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 1500, `rejected after ${elapsed} ms`);
    assert.ok(mainTicks >= 10, `main thread ticked only ${mainTicks} times`);
    // Terminated: the heartbeat stops growing.
    await new Promise((r) => setTimeout(r, 150));
    const sizeA = fs.statSync(beat).size;
    await new Promise((r) => setTimeout(r, 300));
    const sizeB = fs.statSync(beat).size;
    assert.ok(sizeA > 0, "worker never ran");
    assert.equal(sizeB, sizeA, "worker kept running after timeout");
  } finally {
    clearInterval(ticker);
    fs.rmSync(beat, { force: true });
  }
});

test("M6: a real parse exceeding its budget fails with the generic error", async () => {
  await assert.rejects(extractTextFromPDF(buildPdf(["x"]), { timeoutMs: 1 }), { message: "Failed to parse PDF file" });
});

test("M6: a crashing worker fails safely", async () => {
  await assert.rejects(
    extractTextFromPDF(buildPdf(["x"]), { workerSource: "process.exit(3)" }),
    { message: "Failed to parse PDF file" }
  );
  await assert.rejects(
    extractTextFromPDF(buildPdf(["x"]), { workerSource: "throw new Error('boom')" }),
    { message: "Failed to parse PDF file" }
  );
});

test("M6: worker heap is capped (allocation bomb is contained)", async () => {
  const bomb = `const a = []; for (;;) a.push(new Array(1e6).fill(Math.random()));`;
  await assert.rejects(extractTextFromPDF(buildPdf(["x"]), { workerSource: bomb, timeoutMs: 20_000 }), {
    message: "Failed to parse PDF file",
  });
});

test("pdfjs v6: caller buffer is not detached by parsing", async () => {
  const buf = buildPdf(["Keep me"]);
  await extractTextFromPDF(buf);
  assert.equal(buf.subarray(0, 5).toString("latin1"), "%PDF-");
});

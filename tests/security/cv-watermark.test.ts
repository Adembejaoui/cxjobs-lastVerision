import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { CV_WATERMARK_SRC, loadWatermarkDataUrl } from "../../lib/cv/watermark";
import { CVPDFDocument, type Candidate } from "../../components/cv/cv-pdf-document";

const ROOT = path.resolve(__dirname, "../..");
const WATERMARK_FILE = path.join(ROOT, "public", "brand", "cxjobs-watermark.png");
const PNG = fs.readFileSync(WATERMARK_FILE);

const pngResponse = (status = 200, body: Uint8Array = PNG, type = "image/png") =>
  new Response(status === 200 ? new Blob([new Uint8Array(body)], { type }) : "Not found", {
    status,
    headers: { "content-type": status === 200 ? type : "text/html" },
  });

const candidate: Candidate = {
  id: "c1",
  firstName: "Jane",
  lastName: "Doe",
  summary: "Customer service professional.",
  location: "Tunis",
  phone: "+216 00 000 000",
  avatarUrl: null,
  linkedinUrl: null,
  targetJobRole: "CUSTOMER_SERVICE",
  user: { email: "jane@example.com", image: null },
  experiences: [],
  education: [],
  languages: [{ id: "l1", name: "French", proficiency: "FLUENT" }],
  skills: [{ id: "s1", name: "Zendesk", level: null }],
};

const renderPdf = (watermarkSrc: string | null) =>
  renderToBuffer(createElement(CVPDFDocument, { candidate, watermarkSrc, profileImageSrc: null }) as never);

// ─── Asset ──────────────────────────────────────────────────────────────

test("watermark asset: served from public/brand as a real PNG", () => {
  assert.equal(CV_WATERMARK_SRC, "/brand/cxjobs-watermark.png");
  assert.ok(fs.existsSync(path.join(ROOT, "public", CV_WATERMARK_SRC)));
  assert.equal(PNG.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
});

test("download button uses the local asset, not a storage URL", () => {
  const src = fs.readFileSync(path.join(ROOT, "components/cv/pdf-download-button.tsx"), "utf8");
  assert.match(src, /const watermarkSrc = CV_WATERMARK_SRC;/);
  assert.doesNotMatch(src, /supabase\.co|\/storage\/v1\//);
});

// ─── Loading ────────────────────────────────────────────────────────────

test("watermark: successful load returns a byte-exact PNG data URL (no re-encoding)", async () => {
  let requested = "";
  const dataUrl = await loadWatermarkDataUrl(CV_WATERMARK_SRC, async (url) => {
    requested = url;
    return pngResponse();
  });
  assert.equal(requested, "/brand/cxjobs-watermark.png");
  assert.ok(dataUrl?.startsWith("data:image/png;base64,"));
  assert.deepEqual(Buffer.from(dataUrl!.split(",")[1], "base64"), PNG);
});

test("watermark: missing file / 404 → null (no throw)", async () => {
  assert.equal(await loadWatermarkDataUrl(CV_WATERMARK_SRC, async () => pngResponse(404)), null);
  assert.equal(await loadWatermarkDataUrl(CV_WATERMARK_SRC, async () => pngResponse(500)), null);
});

test("watermark: network failure → null (no throw)", async () => {
  const out = await loadWatermarkDataUrl(CV_WATERMARK_SRC, async () => {
    throw new TypeError("Failed to fetch");
  });
  assert.equal(out, null);
});

test("watermark: wrong content type (e.g. HTML fallback page with 200) or empty body → null", async () => {
  const html = new Response("<html>login</html>", { status: 200, headers: { "content-type": "text/html" } });
  assert.equal(await loadWatermarkDataUrl(CV_WATERMARK_SRC, async () => html), null);
  assert.equal(await loadWatermarkDataUrl(CV_WATERMARK_SRC, async () => pngResponse(200, new Uint8Array())), null);
  assert.equal(await loadWatermarkDataUrl(CV_WATERMARK_SRC, async () => pngResponse(200, PNG, "image/webp")), null);
});

test("watermark: empty source → null without fetching; existing data URL passed through", async () => {
  let fetched = false;
  const spy = async () => ((fetched = true), pngResponse());
  assert.equal(await loadWatermarkDataUrl(undefined, spy), null);
  assert.equal(await loadWatermarkDataUrl("  ", spy), null);
  assert.equal(fetched, false);
  assert.equal(await loadWatermarkDataUrl("data:image/png;base64,AAAA", spy), "data:image/png;base64,AAAA");
});

// ─── PDF export end-to-end (react-pdf, offline) ─────────────────────────

test("PDF export succeeds WITH the watermark (image embedded)", async () => {
  const dataUrl = await loadWatermarkDataUrl(CV_WATERMARK_SRC, async () => pngResponse());
  const withMark = await renderPdf(dataUrl);
  const without = await renderPdf(null);
  assert.equal(withMark.subarray(0, 5).toString("latin1"), "%PDF-");
  assert.match(withMark.toString("latin1"), /\/Subtype\s*\/Image/);
  assert.ok(withMark.length > without.length);
});

test("PDF export still succeeds WITHOUT the watermark after 404 / network failure", async () => {
  for (const failing of [async () => pngResponse(404), async () => Promise.reject(new TypeError("offline"))]) {
    const dataUrl = await loadWatermarkDataUrl(CV_WATERMARK_SRC, failing);
    assert.equal(dataUrl, null);
    const pdf = await renderPdf(dataUrl);
    assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
    assert.doesNotMatch(pdf.toString("latin1"), /\/Subtype\s*\/Image/);
  }
});

test("watermark design is unchanged: top 330, left 100, 280×180, opacity 0.05, fixed, rendered last", () => {
  const src = fs.readFileSync(path.join(ROOT, "components/cv/cv-pdf-document.tsx"), "utf8");
  const block = /watermarkImage:\s*\{([^}]*)\}/.exec(src)?.[1] ?? "";
  assert.match(block, /position:\s*"absolute"/);
  assert.match(block, /top:\s*330\b/);
  assert.match(block, /left:\s*100\b/);
  assert.match(block, /width:\s*280\b/);
  assert.match(block, /height:\s*180\b/);
  assert.match(block, /opacity:\s*0\.05\b/);
  // Last element inside <Page>, with `fixed` and cache disabled.
  const tail = src.slice(src.lastIndexOf("{watermarkImage && ("));
  assert.match(tail, /<Image\s+fixed\s+style=\{styles\.watermarkImage\}\s+src=\{watermarkImage\}\s+cache=\{false\}/);
  assert.match(tail, /^\{watermarkImage && \([\s\S]*?\)\}\s*<\/Page>/);
});

// ─── Guard: no public CV storage URLs in application source ─────────────

const SOURCE_DIRS = ["app", "components", "lib", "hooks"];
const SKIP = new Set(["generated"]);

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(full);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) yield full;
  }
}

test("guard: no application source references /storage/v1/object/public/cv/", () => {
  const offenders: string[] = [];
  for (const d of SOURCE_DIRS) {
    for (const file of sourceFiles(path.join(ROOT, d))) {
      const text = fs.readFileSync(file, "utf8");
      // Also catch encoded / concatenated forms of the bucket path.
      if (/object\/public\/cv\//.test(text) || /object%2Fpublic%2Fcv/i.test(text)) {
        offenders.push(path.relative(ROOT, file));
      }
    }
  }
  assert.deepEqual(offenders, []);
});

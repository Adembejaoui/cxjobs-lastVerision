import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

/**
 * Untrusted-PDF text extraction in an isolated worker thread.
 *
 * Why a worker: pdf.js runs CPU-bound parsing on the event loop of whichever
 * thread hosts it. In-process, a crafted PDF could stall the whole function
 * instance, and a Promise-based timeout cannot fire while the loop is busy.
 * Inside a worker the main thread stays responsive and, on timeout, the worker
 * is TERMINATED — the parse is actually stopped and its memory released, not
 * merely abandoned. `resourceLimits` also caps its heap.
 */

export interface PdfExtractLimits {
  maxPages: number;
  maxChars: number;
}

export interface PdfExtractOptions extends Partial<PdfExtractLimits> {
  /** Wall-clock budget for the whole extraction. */
  timeoutMs?: number;
  /** Heap ceiling for the worker (MB). */
  maxHeapMb?: number;
  /** Test seam: replace the worker program. */
  workerSource?: string;
}

export const DEFAULT_PDF_TIMEOUT_MS = 10_000;
export const DEFAULT_PDF_LIMITS: PdfExtractLimits = { maxPages: 30, maxChars: 200_000 };
const DEFAULT_MAX_HEAP_MB = 256;

export class PdfTimeoutError extends Error {
  constructor() {
    super("PDF processing timed out");
    this.name = "PdfTimeoutError";
  }
}

// Plain CommonJS so it runs unchanged under Next.js and tsx. pdf.js modules
// are loaded by absolute file URL (resolved in the parent), so nothing here
// depends on the bundler's module graph.
const WORKER_SOURCE = String.raw`
const { parentPort, workerData } = require("node:worker_threads");
(async () => {
  const { data, pdfUrl, workerUrl, maxPages, maxChars } = workerData;
  const pdfjs = await import(pdfUrl);
  globalThis.pdfjsWorker = await import(workerUrl); // in-thread "fake worker"
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    disableFontFace: true,
    // A11: pdf.js 6.x has no eval code path at all (the isEvalSupported
    // option and new Function code generation were removed upstream), so
    // the CVE-2024-4367 class of issue does not apply to this version.
    verbosity: pdfjs.VerbosityLevel.ERRORS,
    disableAutoFetch: true,
    disableStream: true,
    useSystemFonts: false,
    stopAtErrors: false,
  });
  try {
    const pdf = await task.promise;
    let text = "";
    const pages = Math.min(pdf.numPages, maxPages);
    for (let n = 1; n <= pages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      text += content.items.map((i) => ("str" in i ? i.str : "")).join(" ") + "\n";
      page.cleanup();
      if (text.length >= maxChars) {
        text = text.slice(0, maxChars);
        break;
      }
    }
    parentPort.postMessage({ ok: true, text });
  } finally {
    await task.destroy();
  }
})().catch((e) => parentPort.postMessage({ ok: false, name: (e && e.name) || "Error" }));
`;

let resolved: { pdfUrl: string; workerUrl: string } | null = null;
function resolvePdfjs() {
  if (resolved) return resolved;
  // Resolve from the app root, not this (bundled) module's location: Next.js
  // rewrites __filename/require.resolve inside server bundles. On Vercel the
  // files are guaranteed present via outputFileTracingIncludes (next.config).
  const req = createRequire(path.join(process.cwd(), "package.json"));
  resolved = {
    pdfUrl: pathToFileURL(req.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href,
    workerUrl: pathToFileURL(req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).href,
  };
  return resolved;
}

export function extractPdfTextInWorker(buffer: Uint8Array, options: PdfExtractOptions = {}): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_PDF_TIMEOUT_MS;
  const { pdfUrl, workerUrl } = resolvePdfjs();

  // Copy into a standalone ArrayBuffer and TRANSFER it: no second copy, and
  // the caller's buffer is never detached.
  const data = new Uint8Array(buffer).buffer;

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const worker = new Worker(options.workerSource ?? WORKER_SOURCE, {
      eval: true,
      workerData: {
        data,
        pdfUrl,
        workerUrl,
        maxPages: options.maxPages ?? DEFAULT_PDF_LIMITS.maxPages,
        maxChars: options.maxChars ?? DEFAULT_PDF_LIMITS.maxChars,
      },
      transferList: [data],
      resourceLimits: { maxOldGenerationSizeMb: options.maxHeapMb ?? DEFAULT_MAX_HEAP_MB },
      stdout: true, // pdf.js console noise stays out of server logs
      stderr: true,
    });

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
      // Always stop the thread; harmless if it already exited.
      void worker.terminate();
    };

    const timer = setTimeout(() => finish(() => reject(new PdfTimeoutError())), timeoutMs);

    worker.once("message", (msg: { ok: boolean; text?: string; name?: string }) =>
      finish(() => (msg.ok ? resolve(msg.text ?? "") : reject(new Error(msg.name ?? "PdfParseError"))))
    );
    worker.once("error", (err) => finish(() => reject(err)));
    worker.once("exit", (code) =>
      finish(() => reject(new Error(code === 0 ? "PdfWorkerExited" : `PdfWorkerExit:${code}`)))
    );
  });
}


const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 100_000;

function stripHtmlToText(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  const entities: Record<string, string> = {
    "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">",
    "&quot;": '"', "&#039;": "'", "&apos;": "'",
  };
  for (const [entity, decoded] of Object.entries(entities)) {
    text = text.split(entity).join(decoded);
  }
  return text;
}

export interface FetchUrlOptions {
  timeoutMs?: number;
  maxBytes?: number;
}

export async function fetchUrlText(
  url: string,
  options: FetchUrlOptions = {}
): Promise<string | null> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = MAX_HTML_BYTES } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CXJobsBot/1.0; +https://cxjobs.app)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
      },
    });

    const ct = response.headers.get("content-type") || "";
    if (!response.ok || !ct.includes("text/html")) {
      console.warn(`[job-scraper] skipped ${url} — status=${response.status} ct="${ct}"`);
      return null;
    }

    const reader = response.body?.getReader();
    if (!reader) return null;

    const decoder = new TextDecoder("utf-8", { fatal: false });
    let totalBytes = 0;
    let html = "";

    while (true) {
      const result = await reader.read();
      const { done, value } = result as { done: boolean; value: Uint8Array | null };
      if (done || !value) break;

      if (totalBytes + value.byteLength > maxBytes) {
        html += decoder.decode(value.slice(0, maxBytes - totalBytes));
        break;
      }
      totalBytes += value.byteLength;
      html += decoder.decode(value);
    }

    reader.cancel();
    return stripHtmlToText(html);
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      console.warn(`[job-scraper] timeout ${timeoutMs}ms exceeded for ${url}`);
    } else {
      console.error(`[job-scraper] fetch error for ${url}:`, error);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

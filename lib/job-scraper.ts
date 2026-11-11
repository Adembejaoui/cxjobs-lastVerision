import net from "node:net";
import dns from "node:dns";
import https from "node:https";
import type { IncomingHttpHeaders } from "node:http";
import { logger } from "./logger";
import { parseSafeHttpUrl } from "./security/safe-url";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 100_000;
const MAX_REDIRECTS = 3;

export function stripHtmlToText(html: string): string {
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

// ─── Destination policy ──────────────────────────────────────────────────
//
// Address classification uses Node's built-in `net.BlockList` (maintained IP
// parser with CIDR matching, including IPv4-mapped IPv6) instead of
// hand-written string checks.

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],        // "this network"
  ["10.0.0.0", 8],       // private
  ["100.64.0.0", 10],    // CGNAT
  ["127.0.0.0", 8],      // loopback
  ["169.254.0.0", 16],   // link-local incl. 169.254.169.254 cloud metadata
  ["172.16.0.0", 12],    // private
  ["192.0.0.0", 24],     // IETF protocol assignments
  ["192.0.2.0", 24],     // TEST-NET-1
  ["192.88.99.0", 24],   // 6to4 relay anycast
  ["192.168.0.0", 16],   // private
  ["198.18.0.0", 15],    // benchmarking
  ["198.51.100.0", 24],  // TEST-NET-2
  ["203.0.113.0", 24],   // TEST-NET-3
  ["224.0.0.0", 4],      // multicast
  ["240.0.0.0", 4],      // reserved + broadcast
];

const BLOCKED_V6: Array<[string, number]> = [
  ["::", 128],           // unspecified
  ["::1", 128],          // loopback
  ["::", 96],            // IPv4-compatible (deprecated)
  ["::ffff:0:0", 96],    // IPv4-mapped — never legitimate in public DNS
  ["64:ff9b::", 96],     // NAT64 (can embed internal v4)
  ["64:ff9b:1::", 48],   // local-use NAT64
  ["100::", 64],         // discard-only
  ["2001::", 23],        // IETF protocol assignments (incl. Teredo)
  ["2001:db8::", 32],    // documentation
  ["2002::", 16],        // 6to4 (embeds arbitrary v4)
  ["fc00::", 7],         // unique local
  ["fe80::", 10],        // link-local
  ["fec0::", 10],        // site-local (deprecated)
  ["ff00::", 8],         // multicast
];

// Two lists on purpose: BlockList matches IPv4 addresses against IPv6 rules
// through their IPv4-mapped form, so a v6 rule such as ::ffff:0:0/96 in a
// shared list would block every IPv4 address.
const blockListV4 = new net.BlockList();
for (const [addr, prefix] of BLOCKED_V4) blockListV4.addSubnet(addr, prefix, "ipv4");
const blockListV6 = new net.BlockList();
for (const [addr, prefix] of BLOCKED_V6) blockListV6.addSubnet(addr, prefix, "ipv6");

/** True for any address that must never be contacted (or that does not parse). */
export function isBlockedIp(ip: string): boolean {
  const bare = ip.startsWith("[") && ip.endsWith("]") ? ip.slice(1, -1) : ip;
  const family = net.isIP(bare);
  if (family === 0) return true;
  if (family === 4) return blockListV4.check(bare, "ipv4");
  // IPv6: own rules, plus any IPv4-mapped form of a blocked IPv4 range.
  return blockListV6.check(bare, "ipv6") || blockListV4.check(bare, "ipv6");
}

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".intranet", ".lan", ".home.arpa", ".corp"];

/**
 * Pre-connection validation of a URL: https only, default port only, no
 * credentials, no internal/single-label hostnames, no blocked IP literals.
 * DNS-resolved addresses are validated separately at connect time.
 */
export function isSafeUrl(urlString: string): boolean {
  const parsed = parseSafeHttpUrl(urlString, { allowHttp: false });
  if (!parsed) return false;
  // Only the default HTTPS port: blocks probing of internal services that
  // happen to be reachable on public addresses (e.g. :6379, :9200).
  if (parsed.port !== "" && parsed.port !== "443") return false;

  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (host.startsWith("[")) {
    return !isBlockedIp(host);
  }
  if (net.isIP(host) !== 0) {
    return !isBlockedIp(host);
  }
  // The WHATWG parser already canonicalises decimal/octal/hex IPv4 forms
  // ("http://2130706433", "0x7f.1") into dotted quads, handled above.
  if (host === "localhost" || !host.includes(".")) return false;
  if (BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) return false;
  return true;
}

type LookupResolver = (
  hostname: string,
  options: dns.LookupAllOptions
) => Promise<dns.LookupAddress[]>;

const defaultResolver: LookupResolver = (hostname, options) => dns.promises.lookup(hostname, options);

export class BlockedDestinationError extends Error {
  constructor() {
    super("Destination address is not allowed");
    this.name = "BlockedDestinationError";
  }
}

/**
 * A `lookup` implementation for `https.request` that resolves the hostname
 * and rejects the connection if ANY resolved address is blocked. Because the
 * socket connects to exactly the address this function returns, there is no
 * gap between validation and use (DNS-rebinding safe).
 */
export function createGuardedLookup(resolver: LookupResolver = defaultResolver): net.LookupFunction {
  return ((hostname: string, options: dns.LookupOptions, callback: (...args: unknown[]) => void) => {
    resolver(hostname, { all: true, family: options?.family as number | undefined ?? 0 } as dns.LookupAllOptions)
      .then((addresses) => {
        if (addresses.length === 0 || addresses.some((a) => isBlockedIp(a.address))) {
          callback(new BlockedDestinationError());
          return;
        }
        if (options?.all) {
          callback(null, addresses);
        } else {
          callback(null, addresses[0].address, addresses[0].family);
        }
      })
      .catch((err) => callback(err));
  }) as unknown as net.LookupFunction;
}

// ─── Transport ────────────────────────────────────────────────────────────

export interface TransportResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: AsyncIterable<Buffer>;
  destroy(): void;
}

export type Transport = (
  url: URL,
  opts: { lookup: net.LookupFunction; signal: AbortSignal; headers: Record<string, string> }
) => Promise<TransportResponse>;

const httpsTransport: Transport = (url, { lookup, signal, headers }) =>
  new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        headers,
        lookup,
        signal,
        agent: false, // no socket reuse across validations
      },
      (res) => {
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: res,
          destroy: () => res.destroy(),
        });
      }
    );
    req.on("error", reject);
    req.end();
  });

export interface FetchUrlOptions {
  /** Total budget for the whole fetch, all redirects included. */
  timeoutMs?: number;
  maxBytes?: number;
  /** Abort from the caller (e.g. route-level deadline). */
  signal?: AbortSignal;
  /** Test seams; production uses DNS + node:https. */
  transport?: Transport;
  resolver?: LookupResolver;
}

const ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];

/**
 * Fetch a public web page and return its visible text, or null.
 * Never follows redirects automatically; every hop is re-validated.
 */
export async function fetchUrlText(
  url: string,
  options: FetchUrlOptions = {}
): Promise<string | null> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = MAX_HTML_BYTES,
    transport = httpsTransport,
    resolver,
  } = options;

  const lookup = createGuardedLookup(resolver);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onOuterAbort, { once: true });

  try {
    let currentUrl = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isSafeUrl(currentUrl)) {
        logger.warn("Rejected unsafe scrape URL", { hop });
        return null;
      }

      const res = await transport(new URL(currentUrl), {
        lookup,
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CXJobsBot/1.0; +https://cxjobs.app)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
          "Accept-Encoding": "identity",
        },
      });

      if (res.status >= 300 && res.status < 400) {
        res.destroy();
        const location = res.headers.location;
        if (!location) return null;
        try {
          currentUrl = new URL(location, currentUrl).href;
        } catch {
          return null;
        }
        continue;
      }

      const ct = String(res.headers["content-type"] ?? "").toLowerCase();
      if (res.status < 200 || res.status >= 300 || !ALLOWED_CONTENT_TYPES.some((t) => ct.includes(t))) {
        res.destroy();
        logger.warn("Skipped scrape URL - not HTML or error status", { status: res.status });
        return null;
      }

      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of res.body) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const room = maxBytes - total;
        if (buf.length >= room) {
          chunks.push(buf.subarray(0, room));
          total = maxBytes;
          break; // hard cap: stop reading, drop the connection
        }
        chunks.push(buf);
        total += buf.length;
      }
      res.destroy();
      return stripHtmlToText(new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks)));
    }

    logger.warn("Too many redirects for scrape URL");
    return null;
  } catch (error) {
    if (controller.signal.aborted) {
      logger.warn("Scrape fetch timed out", { timeoutMs });
    } else if (error instanceof BlockedDestinationError) {
      logger.warn("Scrape blocked: hostname resolved to a forbidden address");
    } else {
      logger.warn("Scrape fetch failed", { error: error instanceof Error ? error.name : "unknown" });
    }
    return null;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onOuterAbort);
  }
}

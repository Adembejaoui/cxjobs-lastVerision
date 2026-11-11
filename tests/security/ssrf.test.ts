import { test } from "node:test";
import assert from "node:assert/strict";
import type dns from "node:dns";
import {
  isBlockedIp,
  isSafeUrl,
  createGuardedLookup,
  fetchUrlText,
  BlockedDestinationError,
  type Transport,
  type TransportResponse,
} from "../../lib/job-scraper";

test("S4: blocked addresses (loopback, private, link-local, metadata, v6 local, mapped)", () => {
  const blocked = [
    "127.0.0.1", "127.255.255.254", "0.0.0.0", "10.1.2.3", "172.16.0.1", "172.31.255.255",
    "192.168.1.1", "169.254.169.254", "100.64.0.1", "198.18.0.1", "224.0.0.1", "255.255.255.255",
    "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:169.254.169.254", "::ffff:10.0.0.1",
    "64:ff9b::a9fe:a9fe", "2002:7f00:1::", "2001:db8::1",
    "not-an-ip", "",
  ];
  for (const ip of blocked) assert.equal(isBlockedIp(ip), true, ip);
});

test("S4: public addresses are allowed", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111", "172.32.0.1", "192.169.0.1"]) {
    assert.equal(isBlockedIp(ip), false, ip);
  }
});

test("S4: URL policy rejects schemes, ports, internal hosts and IP literals in any notation", () => {
  const bad = [
    "http://example.com/",                 // https only
    "ftp://example.com/",
    "file:///etc/passwd",
    "gopher://127.0.0.1:6379/_",
    "https://localhost/",
    "https://foo.localhost/",
    "https://metadata.google.internal/computeMetadata/v1/",
    "https://intranet/",                   // single-label
    "https://127.0.0.1/",
    "https://2130706433/",                 // decimal 127.0.0.1
    "https://0x7f.0.0.1/",                 // hex
    "https://0177.0.0.1/",                 // octal
    "https://127.1/",                      // short form
    "https://[::1]/",
    "https://[::ffff:127.0.0.1]/",
    "https://[::ffff:a9fe:a9fe]/",         // mapped metadata
    "https://169.254.169.254/latest/meta-data/",
    "https://example.com:8443/",           // non-default port
    "https://example.com:22/",
    "https://user:pw@example.com/",
    "https://exa mple.com/",
  ];
  for (const u of bad) assert.equal(isSafeUrl(u), false, u);
  for (const u of ["https://example.com/job/1", "https://jobs.example.co.uk:443/a?b=c", "https://8.8.8.8/"]) {
    assert.equal(isSafeUrl(u), true, u);
  }
});

function resolverFor(map: Record<string, string[]>) {
  return async (hostname: string): Promise<dns.LookupAddress[]> => {
    const addrs = map[hostname];
    if (!addrs) throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    return addrs.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
  };
}

function lookupOnce(
  lookup: ReturnType<typeof createGuardedLookup>,
  host: string,
  all = false
): Promise<{ err: unknown; addr?: unknown }> {
  return new Promise((resolve) => {
    (lookup as unknown as (h: string, o: object, cb: (e: unknown, a?: unknown) => void) => void)(
      host,
      { all },
      (err, addr) => resolve({ err, addr })
    );
  });
}

test("S4: guarded lookup rejects hostnames resolving to forbidden addresses (DNS rebinding)", async () => {
  const lookup = createGuardedLookup(
    resolverFor({
      "evil.example": ["127.0.0.1"],
      "metadata.example": ["169.254.169.254"],
      "mixed.example": ["93.184.216.34", "10.0.0.5"], // any bad record poisons the answer
      "v6.example": ["::ffff:127.0.0.1"],
      "ok.example": ["93.184.216.34"],
    })
  );
  for (const h of ["evil.example", "metadata.example", "mixed.example", "v6.example"]) {
    const r = await lookupOnce(lookup, h);
    assert.ok(r.err instanceof BlockedDestinationError, h);
  }
  const ok = await lookupOnce(lookup, "ok.example");
  assert.equal(ok.err, null);
  assert.equal(ok.addr, "93.184.216.34");
  const okAll = await lookupOnce(lookup, "ok.example", true);
  assert.deepEqual(okAll.addr, [{ address: "93.184.216.34", family: 4 }]);
});

test("S4: unresolvable hostname is an error, not a pass", async () => {
  const lookup = createGuardedLookup(resolverFor({}));
  const r = await lookupOnce(lookup, "nope.example");
  assert.ok(r.err);
});

// ─── fetchUrlText behaviour with a scripted transport ────────────────────

type Step = { status: number; headers?: Record<string, string>; body?: Buffer[]; delayMs?: number };

function scripted(steps: Record<string, Step>, seen: string[]): Transport {
  return async (url, { signal }) => {
    seen.push(url.href);
    const step = steps[url.href];
    if (!step) throw new Error("unexpected request " + url.href);
    if (step.delayMs) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, step.delayMs);
        signal.addEventListener("abort", () => {
          clearTimeout(t);
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    }
    let destroyed = false;
    const res: TransportResponse = {
      status: step.status,
      headers: step.headers ?? {},
      body: (async function* () {
        for (const c of step.body ?? []) {
          if (destroyed) return;
          yield c;
        }
      })(),
      destroy: () => {
        destroyed = true;
      },
    };
    return res;
  };
}

const HTML = { "content-type": "text/html; charset=utf-8" };

test("S4: public page is fetched and stripped to text", async () => {
  const seen: string[] = [];
  const text = await fetchUrlText("https://jobs.example.com/1", {
    transport: scripted({ "https://jobs.example.com/1": { status: 200, headers: HTML, body: [Buffer.from("<h1>Agent</h1><script>x</script>")] } }, seen),
  });
  assert.equal(text, "Agent");
});

test("S4: redirect to a private IP is not followed", async () => {
  const seen: string[] = [];
  const text = await fetchUrlText("https://jobs.example.com/r", {
    transport: scripted(
      {
        "https://jobs.example.com/r": { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data/" } },
      },
      seen
    ),
  });
  assert.equal(text, null);
  assert.deepEqual(seen, ["https://jobs.example.com/r"]);
});

test("S4: redirect to http:// or localhost is not followed", async () => {
  for (const location of ["http://jobs.example.com/x", "https://localhost/admin", "file:///etc/passwd"]) {
    const seen: string[] = [];
    const text = await fetchUrlText("https://jobs.example.com/r", {
      transport: scripted({ "https://jobs.example.com/r": { status: 301, headers: { location } } }, seen),
    });
    assert.equal(text, null, location);
    assert.equal(seen.length, 1, location);
  }
});

test("S4: safe relative redirect is followed and re-validated", async () => {
  const seen: string[] = [];
  const text = await fetchUrlText("https://jobs.example.com/a", {
    transport: scripted(
      {
        "https://jobs.example.com/a": { status: 302, headers: { location: "/b" } },
        "https://jobs.example.com/b": { status: 200, headers: HTML, body: [Buffer.from("<p>ok</p>")] },
      },
      seen
    ),
  });
  assert.equal(text, "ok");
});

test("S4: excessive redirects are refused", async () => {
  const steps: Record<string, Step> = {};
  for (let i = 0; i < 10; i++) steps[`https://jobs.example.com/${i}`] = { status: 302, headers: { location: `/${i + 1}` } };
  const seen: string[] = [];
  assert.equal(await fetchUrlText("https://jobs.example.com/0", { transport: scripted(steps, seen) }), null);
  assert.equal(seen.length, 4); // initial + 3 redirects, then stop
});

test("S4: oversized response is truncated at the byte cap and the stream abandoned", async () => {
  const seen: string[] = [];
  const chunk = Buffer.alloc(1000, "a".charCodeAt(0));
  const text = await fetchUrlText("https://jobs.example.com/big", {
    maxBytes: 2500,
    transport: scripted({ "https://jobs.example.com/big": { status: 200, headers: HTML, body: Array(1000).fill(chunk) } }, seen),
  });
  assert.equal(text?.length, 2500);
});

test("S4: non-HTML content types are rejected", async () => {
  const seen: string[] = [];
  const text = await fetchUrlText("https://jobs.example.com/j", {
    transport: scripted({ "https://jobs.example.com/j": { status: 200, headers: { "content-type": "application/json" }, body: [Buffer.from("{}")] } }, seen),
  });
  assert.equal(text, null);
});

test("S4: slow upstream hits the total timeout", async () => {
  const seen: string[] = [];
  const started = Date.now();
  const text = await fetchUrlText("https://jobs.example.com/slow", {
    timeoutMs: 50,
    transport: scripted({ "https://jobs.example.com/slow": { status: 200, headers: HTML, delayMs: 5000 } }, seen),
  });
  assert.equal(text, null);
  assert.ok(Date.now() - started < 2000);
});

test("S4: caller abort signal cancels the fetch", async () => {
  const seen: string[] = [];
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 20);
  const text = await fetchUrlText("https://jobs.example.com/slow", {
    signal: ac.signal,
    transport: scripted({ "https://jobs.example.com/slow": { status: 200, headers: HTML, delayMs: 5000 } }, seen),
  });
  assert.equal(text, null);
});

test("S4: real transport refuses a hostname that resolves to loopback (no connection made)", async () => {
  const text = await fetchUrlText("https://rebind.example.com/", {
    timeoutMs: 2000,
    resolver: async () => [{ address: "127.0.0.1", family: 4 }],
  });
  assert.equal(text, null);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

/** Load next.config.ts in a fresh process with a given Supabase URL. */
function remotePatterns(supabaseUrl: string | undefined): { hostname: string; pathname?: string }[] {
  const res = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "-e",
      "import('./next.config.ts').then(async (m) => { const c = await (m.default.default ?? m.default); console.log('JSON:' + JSON.stringify(c.images.remotePatterns)); })",
    ],
    { env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ?? "" }, encoding: "utf8", timeout: 60_000 }
  );
  const line = res.stdout.split("\n").find((l) => l.startsWith("JSON:"));
  assert.ok(line, `config did not load: ${res.stderr}`);
  return JSON.parse(line!.slice(5));
}

test("M8: no wildcard or unused third-party image hosts", () => {
  const hosts = remotePatterns("https://gteakdjmzsptteccrgsc.supabase.co").map((p) => p.hostname);
  assert.equal(hosts.some((h) => h.includes("*")), false, hosts.join(","));
  assert.equal(hosts.includes("picsum.photos"), false);
  assert.ok(hosts.includes("hvbbactmgfhecqbetlhg.supabase.co"));
  assert.ok(hosts.includes("gteakdjmzsptteccrgsc.supabase.co"));
  assert.ok(hosts.includes("images.unsplash.com"));
  assert.ok(hosts.includes("lh3.googleusercontent.com"));
});

test("M8: Supabase patterns are limited to public storage objects", () => {
  for (const p of remotePatterns(undefined).filter((x) => x.hostname.endsWith(".supabase.co"))) {
    assert.equal(p.pathname, "/storage/v1/object/public/**");
  }
});

test("M8: a non-Supabase or malformed env URL never widens the allow-list", () => {
  for (const bad of ["https://evil.example", "http://abc.supabase.co", "not a url"]) {
    const hosts = remotePatterns(bad).map((p) => p.hostname);
    assert.deepEqual(hosts.filter((h) => h.endsWith(".supabase.co")), ["hvbbactmgfhecqbetlhg.supabase.co"], bad);
    assert.equal(hosts.includes("evil.example"), false);
  }
});

// ─── NF-08: security headers ─────────────────────────────────────────

type HeaderRule = { source: string; headers: { key: string; value: string }[] };
function headerRules(): HeaderRule[] {
  const res = spawnSync(
    process.execPath,
    ["--import", "tsx", "-e", "import('./next.config.ts').then(async (m) => { const c = await (m.default.default ?? m.default); console.log('JSON:' + JSON.stringify(await c.headers())); })"],
    { env: process.env, encoding: "utf8", timeout: 60_000 }
  );
  const line = res.stdout.split("\n").find((l) => l.startsWith("JSON:"));
  assert.ok(line, `config did not load: ${res.stderr}`);
  return JSON.parse(line!.slice(5));
}

/** Effective headers for a path: rules applied in order, later keys override. */
function effective(rules: HeaderRule[], path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rules) {
    const re = new RegExp("^" + r.source.replace("/:path*", "(?:/.*)?") + "$");
    if (re.test(path)) for (const h of r.headers) out[h.key.toLowerCase()] = h.value;
  }
  return out;
}

test("NF-08: pages are not frameable and the referrer policy is a valid token", () => {
  const rules = headerRules();
  for (const page of ["/", "/dashboard/admin", "/jobs/some-job"]) {
    const h = effective(rules, page);
    assert.equal(h["x-frame-options"], "DENY", page);
    assert.match(h["content-security-policy"], /frame-ancestors 'none'/, page);
    assert.doesNotMatch(h["content-security-policy"], /form-action/, page); // would break Google OAuth redirect
    assert.equal(h["referrer-policy"], "strict-origin-when-cross-origin", page);
  }
});

test("NF-08: API routes keep their stricter CSP (not overridden by the page rule)", () => {
  const h = effective(headerRules(), "/api/job-offers");
  assert.match(h["content-security-policy"], /default-src 'self'/);
  assert.equal(h["x-frame-options"], "DENY");
  assert.equal(h["strict-transport-security"], "max-age=31536000; includeSubDomains; preload");
});

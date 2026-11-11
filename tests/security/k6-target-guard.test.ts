import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- plain JS module shared with k6 (no type declarations)
import { PRODUCTION_HOSTS, resolveStagingTarget } from "../k6/lib/target-guard.mjs";

const guard = resolveStagingTarget as (raw: string | undefined, extra?: { productionHosts?: string; allowedHosts?: string }) => string;

test("H2: a target is mandatory (no default)", () => {
  assert.throws(() => guard(undefined), /K6_BASE_URL is required/);
  assert.throws(() => guard("  "), /K6_BASE_URL is required/);
});

test("H2: production hosts are always refused, even if explicitly allow-listed", () => {
  for (const host of PRODUCTION_HOSTS as string[]) {
    assert.throws(() => guard(`https://${host}`), /production/, host);
    assert.throws(() => guard(`https://${host}/`, { allowedHosts: host }), /production/, host);
    assert.throws(() => guard(`https://${host.toUpperCase()}.`), /production/, host);
  }
  assert.throws(() => guard("https://jobs.example.com", { productionHosts: "jobs.example.com", allowedHosts: "jobs.example.com" }), /production/);
});

test("H2: staging, preview, Vercel branch previews and local targets are accepted", () => {
  assert.equal(guard("https://cxjobs-staging.vercel.app/some/path"), "https://cxjobs-staging.vercel.app");
  assert.equal(guard("https://staging.cxjobs.app"), "https://staging.cxjobs.app");
  assert.equal(guard("https://cxjobs-git-feature-x-team.vercel.app"), "https://cxjobs-git-feature-x-team.vercel.app");
  assert.equal(guard("https://preview-123.example.dev"), "https://preview-123.example.dev");
  assert.equal(guard("http://localhost:3000"), "http://localhost:3000");
  assert.equal(guard("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
});

test("H2: unknown hosts are refused unless listed exactly in K6_ALLOWED_HOSTS", () => {
  assert.throws(() => guard("https://cxjobs-abc123-team.vercel.app"), /not recognised/);
  assert.throws(() => guard("https://notstagingreally.example.com"), /not recognised/); // substring is not a label
  assert.equal(guard("https://perf.example.com", { allowedHosts: "perf.example.com" }), "https://perf.example.com");
});

test("H2: malformed targets are refused", () => {
  assert.throws(() => guard("cxjobs-staging.vercel.app"), /not a valid URL/);
  assert.throws(() => guard("ftp://staging.example.com"), /http or https/);
  assert.throws(() => guard("https://u:p@staging.example.com"), /credentials/);
});

test("H2: no k6 script or README defaults to or recommends a production URL", () => {
  const dir = path.resolve(__dirname, "../k6");
  const files = fs.readdirSync(dir).filter((f) => /\.(js|mjs|md)$/.test(f));
  for (const f of files) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    assert.doesNotMatch(src, /\|\|\s*['"]https:\/\/cxjobs-last-verision\.vercel\.app/, `${f} defaults to production`);
    assert.doesNotMatch(src, /K6_ALLOW_PRODUCTION/, `${f} still has a production override`);
    if (f.endsWith(".js")) assert.match(src, /target-guard\.mjs/, `${f} does not use the target guard`);
  }
});

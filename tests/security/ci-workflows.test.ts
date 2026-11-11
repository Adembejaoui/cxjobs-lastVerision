import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Phase 3 / H6: CI must never hold production secrets, deploy, or load-test
 * an external target automatically. Text-level checks (no YAML dependency).
 */

const ROOT = path.resolve(__dirname, "../..");
const WF_DIR = path.join(ROOT, ".github", "workflows");
const workflows = fs
  .readdirSync(WF_DIR)
  .filter((f) => /\.ya?ml$/.test(f))
  .map((f) => ({ name: f, src: fs.readFileSync(path.join(WF_DIR, f), "utf8") }));

// Secrets that would give CI access to real infrastructure.
const SERVICE_SECRET = /secrets\.(DATABASE_URL|DIRECT_DATABASE_URL|DIRECT_URL|SUPABASE\w*|UPSTASH\w*|OPENAI\w*|RESEND\w*|GOOGLE\w*|AUTH_SECRET|NEXTAUTH_SECRET|INVITATION\w*|VERCEL\w*)\b/;

test("H6: no workflow references database, storage, Redis, AI, email, OAuth, auth or Vercel secrets", () => {
  assert.ok(workflows.length >= 3);
  for (const wf of workflows) assert.doesNotMatch(wf.src, SERVICE_SECRET, wf.name);
});

// The ONLY database CI may migrate is a throwaway Postgres service container
// defined in the same workflow, reached on loopback with literal (non-secret)
// credentials (launch plan Q1/F-02: replay migrations on a real Postgres).
const CI_SERVICE_DB = /postgresql:\/\/ci:[^@\s]+@127\.0\.0\.1:5432\/cxjobs_ci/;

test("H6: no workflow deploys or promotes anything", () => {
  for (const wf of workflows) {
    assert.doesNotMatch(wf.src, /vercel\s+(deploy|--prod|promote)|amondnet\/vercel-action|db:migrate|migrate\s+(dev|reset)|db\s+push/i, wf.name);
    if (/prisma\s+migrate\s+deploy/i.test(wf.src)) {
      assert.match(wf.src, /services:\s+postgres:\s+image:\s*postgres:/, `${wf.name}: migrate only a service container`);
      for (const m of wf.src.matchAll(/^\s*(DATABASE_URL|DIRECT_DATABASE_URL):\s*(\S+)/gm)) {
        assert.ok(/127\.0\.0\.1:9\//.test(m[2]) || CI_SERVICE_DB.test(m[2]), `${wf.name}: ${m[1]} must be loopback`);
      }
    }
  }
});

test("H6: service variables in build/test workflows are unroutable placeholders", () => {
  for (const wf of workflows.filter((w) => /ci|perf/.test(w.name))) {
    for (const m of wf.src.matchAll(/^\s*(DATABASE_URL|DIRECT_DATABASE_URL|UPSTASH_REDIS_REST_URL|NEXT_PUBLIC_SUPABASE_URL):\s*(\S+)/gm)) {
      const ok = /127\.0\.0\.1:9/.test(m[2]) || (m[1].includes("DATABASE_URL") && CI_SERVICE_DB.test(m[2]));
      assert.ok(ok, `${wf.name}: ${m[1]} must point at the 127.0.0.1:9 placeholder or the CI service container`);
    }
  }
});

test("H6: perf-ci starts exactly one server (via Lighthouse CI), never a bare background start", () => {
  const perf = workflows.find((w) => w.name === "perf-ci.yml")!;
  assert.doesNotMatch(perf.src, /npm run start\s*&/);
  assert.match(perf.src, /lhci autorun/);
});

test("H6: Lighthouse audits only localhost and never uploads reports to public storage", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "lighthouserc.json"), "utf8"));
  for (const url of cfg.ci.collect.url as string[]) assert.match(url, /^http:\/\/localhost:3000\//, url);
  assert.notEqual(cfg.ci.upload.target, "temporary-public-storage");
  assert.equal(cfg.ci.collect.settings.staticDistDir, undefined, "staticDistDir conflicts with startServerCommand");
});

test("H6/H2: the k6 workflow is manual-only and validates the target before k6 runs", () => {
  const k6 = workflows.find((w) => w.name === "k6-load-test.yml")!;
  const on = k6.src.slice(k6.src.indexOf("\non:"), k6.src.indexOf("\npermissions:"));
  assert.match(on, /workflow_dispatch/);
  assert.doesNotMatch(on, /\n\s+(push|pull_request|schedule):/);
  const guardAt = k6.src.indexOf("target-guard.mjs");
  const k6At = k6.src.indexOf("grafana/k6-action");
  assert.ok(guardAt > 0 && k6At > guardAt, "target guard must run before the k6 step");
});

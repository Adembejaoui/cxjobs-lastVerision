import { test } from "node:test";
import assert from "node:assert/strict";
import { isSafeHttpUrl, toSafeHref } from "../../lib/security/safe-url";
import { createJobOfferSchema, updateJobOfferSchema, scrapeJobUrlSchema } from "../../lib/validations/job";
import { companyProfileSchema, candidateProfileSchema } from "../../lib/validations/profile";
import { adminUpdateCompanySchema } from "../../lib/validations/auth";

const MALICIOUS = [
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  " javascript:alert(1)",
  "java\tscript:alert(1)",
  "java\nscript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "file:///etc/passwd",
  "vbscript:msgbox(1)",
  "blob:https://cxjobs.app/uuid",
  "//evil.example/path",
  "evil.example",
  "https://user:pass@bank.example",
  "https:\\\\evil.example",
  "http://",
  "",
  "not a url",
];

const LEGIT = [
  "https://careers.example.com/jobs/123?ref=cx",
  "http://legacy.example.org/apply",
  "https://jobs.lever.co/company/abc-def",
  "https://www.linkedin.com/jobs/view/123",
];

test("S5: malicious and malformed URLs are rejected", () => {
  for (const u of MALICIOUS) assert.equal(isSafeHttpUrl(u), false, u);
});

test("S5: legitimate http(s) URLs are accepted", () => {
  for (const u of LEGIT) assert.equal(isSafeHttpUrl(u), true, u);
});

test("S5: toSafeHref yields undefined for unsafe values (inert link)", () => {
  assert.equal(toSafeHref("javascript:alert(1)"), undefined);
  assert.equal(toSafeHref(null), undefined);
  assert.equal(toSafeHref("https://ok.example/a b".replace(" ", "%20")), "https://ok.example/a%20b");
});

const baseJob = { title: "Customer Agent", applicationType: "EXTERNAL" as const };

test("S5: job create/update schemas reject javascript:/data: externalApplyUrl", () => {
  for (const u of ["javascript:alert(document.cookie)", "data:text/html,x", "file:///c:/x"]) {
    assert.equal(createJobOfferSchema.safeParse({ ...baseJob, externalApplyUrl: u }).success, false, u);
    assert.equal(updateJobOfferSchema.safeParse({ applicationType: "EXTERNAL", externalApplyUrl: u }).success, false, u);
  }
});

test("S5: job schemas accept a real external apply URL", () => {
  const r = createJobOfferSchema.safeParse({ ...baseJob, externalApplyUrl: "https://careers.example.com/apply" });
  assert.equal(r.success, true);
});

test("S5: EXTERNAL without a URL is still rejected", () => {
  assert.equal(createJobOfferSchema.safeParse({ ...baseJob, externalApplyUrl: "" }).success, false);
});

test("S5: company website / logo reject unsafe schemes; empty clears", () => {
  const base = { name: "Acme", slug: "acme" };
  assert.equal(companyProfileSchema.safeParse({ ...base, website: "javascript:alert(1)" }).success, false);
  assert.equal(companyProfileSchema.safeParse({ ...base, logoUrl: "data:image/svg+xml,<svg onload=alert(1)>" }).success, false);
  const ok = companyProfileSchema.safeParse({ ...base, website: "https://acme.example" });
  assert.equal(ok.success, true);
  const cleared = companyProfileSchema.safeParse({ ...base, website: "" });
  assert.equal(cleared.success && cleared.data.website, null);
  assert.equal(adminUpdateCompanySchema.safeParse({ website: "data:text/html,x" }).success, false);
});

test("S5: candidate avatar URL rejects unsafe schemes", () => {
  assert.equal(candidateProfileSchema.safeParse({ avatarUrl: "javascript:alert(1)" }).success, false);
  // Launch plan S5: avatars must come from this app's own storage (upload API).
  assert.equal(candidateProfileSchema.safeParse({ avatarUrl: "https://cdn.example/a.webp" }).success, false);
  assert.equal(
    candidateProfileSchema.safeParse({
      avatarUrl: "https://hvbbactmgfhecqbetlhg.supabase.co/storage/v1/object/public/avatars/u1/1700000000000-a.webp",
    }).success,
    true
  );
});

test("S4: scrape schema accepts only https", () => {
  assert.equal(scrapeJobUrlSchema.safeParse({ url: "http://example.com/job" }).success, false);
  assert.equal(scrapeJobUrlSchema.safeParse({ url: "file:///etc/passwd" }).success, false);
  assert.equal(scrapeJobUrlSchema.safeParse({ url: "https://example.com/job" }).success, true);
});

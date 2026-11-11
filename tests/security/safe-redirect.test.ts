import { test } from "node:test";
import assert from "node:assert/strict";
import { safeCallbackPath } from "../../lib/security/safe-redirect";

test("F4: same-origin paths are honoured (query and hash kept)", () => {
  assert.equal(safeCallbackPath("/jobs/agent-123/apply"), "/jobs/agent-123/apply");
  assert.equal(safeCallbackPath("/jobs?activityType=OTHER#top"), "/jobs?activityType=OTHER#top");
  assert.equal(safeCallbackPath("/dashboard/../jobs"), "/jobs"); // normalised, still same origin
});

test("F4: open-redirect payloads fall back to the default", () => {
  for (const evil of [
    "https://evil.example/",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "data:text/html,x",
    "/%0d%0aSet-Cookie:x", // encoded is fine as a path…
    " //evil.example",
    "/\tevil",
    "evil.example",
    "",
    "x".repeat(2000),
  ]) {
    const out = safeCallbackPath(evil);
    // …but nothing may ever leave the origin.
    assert.ok(out.startsWith("/") && !out.startsWith("//"), `${JSON.stringify(evil)} → ${out}`);
    if (!evil.startsWith("/%0d")) assert.equal(out, "/dashboard", JSON.stringify(evil));
  }
});

test("F4: non-strings and auth pages fall back", () => {
  assert.equal(safeCallbackPath(undefined), "/dashboard");
  assert.equal(safeCallbackPath(["/jobs"]), "/dashboard");
  assert.equal(safeCallbackPath("/login?callbackUrl=/x"), "/dashboard");
  assert.equal(safeCallbackPath("/reset-password#token=abc"), "/dashboard");
  assert.equal(safeCallbackPath("/jobs", "/home"), "/jobs");
  assert.equal(safeCallbackPath("//x", "/home"), "/home");
});

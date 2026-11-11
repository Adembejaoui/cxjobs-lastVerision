import { test, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  AI_MAX_RETRIES,
  AI_REQUEST_TIMEOUT_MS,
  AIServiceError,
  __setOpenAIClientForTests,
  createOpenAIClient,
  extractJobFromUrlText,
  generateJobDescription,
  parseCVWithAI,
} from "../../lib/ai-service";
import { logger } from "../../lib/logger";

/**
 * Phase 3 / H4. These tests drive the REAL OpenAI SDK through an injected
 * fetch, so they exercise its actual timeout, abort and retry machinery
 * without any network access.
 */

afterEach(() => __setOpenAIClientForTests(null));

/** A fetch that never answers, but honours abort like a real one. */
function hangingFetch(calls: { n: number }): typeof fetch {
  return ((_url: unknown, init?: RequestInit) => {
    calls.n++;
    return new Promise((_resolve, reject) => {
      const signal = init?.signal;
      const abort = () => reject(Object.assign(new Error("The operation was aborted"), { name: "AbortError" }));
      if (signal?.aborted) abort();
      signal?.addEventListener("abort", abort, { once: true });
    });
  }) as typeof fetch;
}

function jsonFetch(status: number, payload: unknown, calls: { n: number }): typeof fetch {
  return (async () => {
    calls.n++;
    return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

const completion = (content: string) => ({
  id: "x", object: "chat.completion", created: 0, model: "gpt-4o-mini",
  choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
});

test("H4: production client defaults are explicit and bounded", () => {
  const client = createOpenAIClient({ apiKey: "sk-test-not-real" });
  assert.equal(client.timeout, AI_REQUEST_TIMEOUT_MS);
  assert.equal(client.maxRetries, AI_MAX_RETRIES);
  assert.ok(AI_REQUEST_TIMEOUT_MS <= 30_000, "per-attempt timeout must stay well below SDK default (10 min)");
  assert.ok(AI_MAX_RETRIES <= 1);
});

test("H4: a provider that never answers yields a generic AIServiceError(timeout), quickly", async () => {
  const calls = { n: 0 };
  __setOpenAIClientForTests(createOpenAIClient({ apiKey: "sk-test", timeoutMs: 50, maxRetries: 0, fetch: hangingFetch(calls) }));
  const started = Date.now();
  await assert.rejects(generateJobDescription({ title: "Agent" }), (e: unknown) => {
    assert.ok(e instanceof AIServiceError);
    assert.equal(e.kind, "timeout");
    assert.equal(e.message, "Failed to generate job description");
    return true;
  });
  assert.ok(Date.now() - started < 5_000);
  assert.equal(calls.n, 1);
});

test("H4: a caller deadline (AbortSignal) cancels the request and any retry", async () => {
  const calls = { n: 0 };
  __setOpenAIClientForTests(createOpenAIClient({ apiKey: "sk-test", timeoutMs: 60_000, maxRetries: 1, fetch: hangingFetch(calls) }));
  const started = Date.now();
  await assert.rejects(
    extractJobFromUrlText({ content: "job page" }, { signal: AbortSignal.timeout(50) }),
    (e: unknown) => e instanceof AIServiceError && e.kind === "timeout"
  );
  assert.ok(Date.now() - started < 5_000, "abort must not wait for the 60 s per-attempt timeout");
  assert.equal(calls.n, 1, "an aborted request must not be retried");
});

test("H4: retries are bounded (one retry on 5xx) and provider error bodies never reach the caller or logs", async () => {
  const calls = { n: 0 };
  const SECRETISH = "upstream-said-sk-proj-SHOULD-NOT-LEAK";
  __setOpenAIClientForTests(
    createOpenAIClient({ apiKey: "sk-test", timeoutMs: 5_000, maxRetries: 1, fetch: jsonFetch(500, { error: { message: SECRETISH } }, calls) })
  );
  const logged: string[] = [];
  const spy = mock.method(logger, "error", (m: string, d?: unknown) => {
    logged.push(`${m} ${JSON.stringify(d ?? {})}`);
  });
  try {
    await assert.rejects(parseCVWithAI({ text: "cv" }), (e: unknown) => {
      assert.ok(e instanceof AIServiceError);
      assert.equal(e.kind, "unavailable");
      assert.doesNotMatch(e.message + String((e as { stack?: string }).stack), /SHOULD-NOT-LEAK/);
      return true;
    });
  } finally {
    spy.mock.restore();
  }
  assert.equal(calls.n, 2, "exactly one retry");
  assert.ok(logged.length > 0);
  for (const line of logged) assert.doesNotMatch(line, /SHOULD-NOT-LEAK/);
  assert.match(logged.join("\n"), /"status":500/);
});

test("H4: a malformed (non-JSON) model answer is classified, not thrown raw", async () => {
  const calls = { n: 0 };
  __setOpenAIClientForTests(
    createOpenAIClient({ apiKey: "sk-test", maxRetries: 0, fetch: jsonFetch(200, completion("not json {"), calls) })
  );
  await assert.rejects(generateJobDescription({ title: "Agent" }), (e: unknown) => e instanceof AIServiceError && e.kind === "invalid_response");
});

test("H4: missing API key is reported as a generic AIServiceError, not a crash with env details", async () => {
  const saved = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(generateJobDescription({ title: "Agent" }), (e: unknown) => {
      assert.ok(e instanceof AIServiceError);
      assert.doesNotMatch(e.message, /OPENAI_API_KEY/);
      return true;
    });
  } finally {
    if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { extractOneTimeToken, stripOneTimeToken } from "../../lib/security/token-url";
import {
  buildTokenLink,
  createResendTransport,
  createTransportFromEnv,
  getTrustedAppUrl,
  passwordResetEmail,
  verificationEmail,
} from "../../lib/email";

const TOKEN = "a".repeat(64);

test("email: links are built only from configured APP_URL (https in production)", () => {
  assert.equal(getTrustedAppUrl({ NODE_ENV: "production", APP_URL: "https://cxjobs.app" })?.origin, "https://cxjobs.app");
  assert.equal(getTrustedAppUrl({ NODE_ENV: "production", APP_URL: "http://cxjobs.app" }), null);
  assert.equal(getTrustedAppUrl({ NODE_ENV: "production" }), null);
  assert.equal(getTrustedAppUrl({ NODE_ENV: "production", APP_URL: "https://user:pw@cxjobs.app" }), null);
  assert.equal(getTrustedAppUrl({ NODE_ENV: "development", NEXT_PUBLIC_APP_URL: "http://localhost:3000" })?.host, "localhost:3000");
  const link = buildTokenLink("/reset-password", TOKEN, new URL("https://cxjobs.app/some/path"));
  assert.equal(link, `https://cxjobs.app/reset-password#token=${TOKEN}`);
});

test("email: templates escape HTML and carry the link in text + html", () => {
  const evil = `https://cxjobs.app/reset-password?token=${TOKEN}&x="><script>alert(1)</script>`;
  const m = passwordResetEmail("a@b.c", evil, 60);
  assert.equal(m.html.includes("<script>alert(1)</script>"), false);
  assert.ok(m.html.includes("&lt;script&gt;"));
  assert.ok(m.text.includes(evil));
  assert.match(m.text, /expires in 60 minutes/);
  assert.match(verificationEmail("a@b.c", "https://cxjobs.app/verify-email?token=x", 24).text, /expires in 24 hours/);
});

test("email: default provider is disabled — nothing is sent", async () => {
  const t = createTransportFromEnv({});
  assert.equal(t.name, "disabled");
  assert.deepEqual(await t.send(passwordResetEmail("a@b.c", "https://x/y", 60)), { ok: false, reason: "disabled" });
});

test("email: resend without credentials is reported as misconfigured, not sent", async () => {
  const t = createTransportFromEnv({ EMAIL_PROVIDER: "resend" });
  assert.equal(t.name, "misconfigured");
  assert.equal((await t.send(passwordResetEmail("a@b.c", "https://x/y", 60))).ok, false);
  assert.equal(createTransportFromEnv({ EMAIL_PROVIDER: "smtp-typo" }).name, "misconfigured");
});

test("email: successful Resend delivery sends the expected request", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const t = createResendTransport({
    apiKey: "re_test_key",
    from: "CXJobs <no-reply@cxjobs.app>",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
    },
  });
  const r = await t.send(verificationEmail("user@example.com", `https://cxjobs.app/verify-email?token=${TOKEN}`, 24));
  assert.deepEqual(r, { ok: true, id: "email_123" });
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer re_test_key");
  const body = JSON.parse(String(calls[0].init.body));
  assert.deepEqual(body.to, ["user@example.com"]);
  assert.ok(body.text.includes(TOKEN));
});

test("email: provider HTTP error and network failure are reported, never thrown", async () => {
  const bad = createResendTransport({ apiKey: "k", from: "f@x", fetchImpl: async () => new Response("{}", { status: 422 }) });
  assert.deepEqual(await bad.send(passwordResetEmail("a@b.c", "https://x/y", 60)), { ok: false, reason: "provider_error" });
  const down = createResendTransport({
    apiKey: "k",
    from: "f@x",
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
  });
  assert.deepEqual(await down.send(passwordResetEmail("a@b.c", "https://x/y", 60)), { ok: false, reason: "provider_error" });
});

test("M1: emailed links carry the token only in the fragment (never sent to the server)", () => {
  const link = new URL(buildTokenLink("/verify-email", TOKEN, new URL("https://cxjobs.app/?utm=x")));
  assert.equal(link.search, "");
  assert.equal(link.hash, `#token=${TOKEN}`);
  // What the browser actually requests from the server:
  assert.equal(`${link.origin}${link.pathname}${link.search}`, "https://cxjobs.app/verify-email");
});

test("M1: client extraction reads the fragment, accepts legacy query, rejects junk", () => {
  assert.equal(extractOneTimeToken(`https://cxjobs.app/reset-password#token=${TOKEN}`), TOKEN);
  assert.equal(extractOneTimeToken(`https://cxjobs.app/reset-password?token=${TOKEN}`), TOKEN);
  assert.equal(extractOneTimeToken(`https://cxjobs.app/reset-password#token=${TOKEN}x`), "");
  assert.equal(extractOneTimeToken(`https://cxjobs.app/reset-password#token=<script>`), "");
  assert.equal(extractOneTimeToken("not a url"), "");
});

test("M1: token is scrubbed from both fragment and query", () => {
  assert.equal(stripOneTimeToken(`https://cxjobs.app/reset-password#token=${TOKEN}`), "/reset-password");
  assert.equal(stripOneTimeToken(`https://cxjobs.app/verify-email?token=${TOKEN}&a=1`), "/verify-email?a=1");
  assert.equal(stripOneTimeToken("https://cxjobs.app/verify-email"), null);
});

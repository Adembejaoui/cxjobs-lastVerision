import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInvitationLink } from "../../lib/security/invitation-link";
import { extractOneTimeToken, stripOneTimeToken } from "../../lib/security/token-url";

const TOKEN = "ab".repeat(32);

test("H3: invitation links put the token in the fragment only", () => {
  const link = new URL(buildInvitationLink("https://cxjobs.app/some/path?utm=x", TOKEN));
  assert.equal(link.origin + link.pathname, "https://cxjobs.app/onboarding/company");
  assert.equal(link.search, "");
  assert.equal(link.hash, `#token=${TOKEN}`);
});

test("H3: the client reads the token the server built, and scrubs it from the URL", () => {
  const link = buildInvitationLink("https://cxjobs.app", TOKEN);
  assert.equal(extractOneTimeToken(link), TOKEN);
  assert.equal(stripOneTimeToken(link), "/onboarding/company");
});

test("H3: legacy query-string invitation links still work and are scrubbed", () => {
  const legacy = `https://cxjobs.app/onboarding/company?token=${TOKEN}`;
  assert.equal(extractOneTimeToken(legacy), TOKEN);
  assert.equal(stripOneTimeToken(legacy), "/onboarding/company");
});

test("H3: non-token fragments are ignored", () => {
  assert.equal(extractOneTimeToken("https://cxjobs.app/onboarding/company#token=<script>"), "");
  assert.equal(extractOneTimeToken("https://cxjobs.app/onboarding/company"), "");
});

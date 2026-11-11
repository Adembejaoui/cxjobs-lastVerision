/**
 * Load-test target guard (Phase 3 / H2). Shared by the k6 scripts (ES module
 * import) and the Node session generators (dynamic import). No k6 or Node
 * APIs, so it runs in both runtimes and in unit tests.
 *
 * Policy (deny wins, no override):
 *  1. A target MUST be given explicitly (K6_BASE_URL). There is no default.
 *  2. Known production hosts are ALWAYS refused — there is deliberately no
 *     "allow production" switch. Extend the list with K6_PRODUCTION_HOSTS.
 *  3. Otherwise only these targets are accepted:
 *       - local: localhost, 127.0.0.1, ::1, *.local
 *       - hosts whose name contains a "staging" or "preview" label/segment
 *       - Vercel branch previews (`<project>-git-<branch>-<team>.vercel.app`)
 *       - exact hosts listed in K6_ALLOWED_HOSTS (comma-separated)
 */

/** Production hostnames (README and earlier scripts used the first one). */
export const PRODUCTION_HOSTS = ["cxjobs-last-verision.vercel.app", "cxjobs.app", "www.cxjobs.app"];

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Validate a load-test target. Returns the normalized origin (no trailing
 * slash) or throws an Error explaining why the target is refused.
 *
 * @param {string | undefined} raw  usually __ENV.K6_BASE_URL / process.env.K6_BASE_URL
 * @param {{ productionHosts?: string, allowedHosts?: string }} [extra]  env-provided lists
 */
export function resolveStagingTarget(raw, extra = {}) {
  if (!raw || !String(raw).trim()) {
    throw new Error(
      "K6_BASE_URL is required. Point it at a STAGING, PREVIEW or LOCAL deployment " +
        "(e.g. -e K6_BASE_URL=https://cxjobs-staging.vercel.app). Production is never allowed."
    );
  }

  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    throw new Error("K6_BASE_URL is not a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("K6_BASE_URL must use http or https.");
  }
  if (url.username || url.password) {
    throw new Error("K6_BASE_URL must not contain credentials.");
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const production = [...PRODUCTION_HOSTS, ...splitList(extra.productionHosts)];
  if (production.includes(host)) {
    throw new Error(`Refusing to load-test production host "${host}". Use a staging or preview deployment.`);
  }

  const isLocal = LOCAL_HOSTS.includes(host) || host.endsWith(".local");
  const isStagingLike = /(^|[.-])(staging|preview)([.-]|$)/.test(host);
  const isVercelBranchPreview = host.endsWith(".vercel.app") && host.includes("-git-");
  const isExplicitlyAllowed = splitList(extra.allowedHosts).includes(host);

  if (!(isLocal || isStagingLike || isVercelBranchPreview || isExplicitlyAllowed)) {
    throw new Error(
      `Refusing to load-test "${host}": it is not recognised as a staging/preview/local target. ` +
        "Use a host containing 'staging' or 'preview', a Vercel '-git-' preview URL, or list the exact host in K6_ALLOWED_HOSTS."
    );
  }

  return url.origin;
}

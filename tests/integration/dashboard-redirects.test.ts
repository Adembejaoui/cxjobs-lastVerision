/**
 * Phase 4A / Task C: company onboarding redirect loop.
 *
 * Drives the REAL server components that decide where a signed-in user goes:
 *   app/(dashboard)/layout.tsx                          (dashboard shell)
 *   app/(dashboard)/dashboard/page.tsx                  (/dashboard role router)
 *   app/(dashboard)/dashboard/company/(onboarded)/layout.tsx
 *   app/(dashboard)/dashboard/admin/layout.tsx
 *   app/onboarding/company/page.tsx                     (invitation page)
 * and follows the resulting redirect chain until a page renders, failing on
 * any revisited URL (a loop) or a chain longer than 8 hops.
 *
 * Only presentational components are stubbed (sidebar, header, the
 * invitation form). `redirect()` is replaced by a throw that carries the
 * target, as Next.js itself does. Auth/role/onboarding state is read from the
 * fake DB through the real getAuthenticatedUser → getAuthUserRecord.
 *
 * Not covered here: a real browser/Next.js router (no browser test
 * infrastructure exists in this repo; see docs/PHASE-4A-CHANGES.md §5).
 */
import { test, before, beforeEach, after, mock } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { installMocks, resetState, as, req, db, IDS, type Persona } from "./harness";

class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}

type Layout = { default: (p: { children: import("react").ReactNode }) => Promise<unknown> };
type Page = { default: () => Promise<unknown> };
let shell: Layout;
let companyArea: Layout;
let adminLayout: Layout;
let dashboardRouter: Page;
let invitationPage: Page;
let profile: typeof import("@/app/api/profile/route");
let policy: typeof import("@/lib/security/dashboard-access");

before(async () => {
  installMocks();
  const navigation = {
    namedExports: {
      redirect: (url: string) => {
        throw new RedirectSignal(url);
      },
      notFound: () => {
        throw new Error("NEXT_NOT_FOUND");
      },
    },
  };
  const requireFromHere = createRequire(import.meta.url ?? __filename);
  const specifiers = new Set<string>(["next/navigation"]);
  try {
    specifiers.add(pathToFileURL(requireFromHere.resolve("next/navigation")).href);
  } catch {
    /* bare specifier only */
  }
  for (const s of specifiers) {
    try {
      mock.module(s, navigation);
    } catch (e) {
      // Bare and resolved specifiers can name the same file: mocked once.
      if ((e as { code?: string }).code !== "ERR_INVALID_STATE") throw e;
    }
  }
  const stub = () => null;
  mock.module("@/components/dashboard/sidebar", { namedExports: { DashboardSidebar: stub, MobileSidebar: stub } });
  mock.module("@/components/dashboard/header", { namedExports: { DashboardHeader: stub } });
  mock.module("@/components/auth/company-invitation", { defaultExport: stub });

  shell = await import("@/app/(dashboard)/layout");
  companyArea = await import("@/app/(dashboard)/dashboard/company/(onboarded)/layout");
  adminLayout = await import("@/app/(dashboard)/dashboard/admin/layout");
  dashboardRouter = await import("@/app/(dashboard)/dashboard/page");
  invitationPage = await import("@/app/onboarding/company/page");
  profile = await import("@/app/api/profile/route");
  policy = await import("@/lib/security/dashboard-access");
});
beforeEach(async () => {
  await resetState();
});
after(() => setTimeout(() => process.exit(0), 50).unref());

/** null = the component rendered; otherwise the redirect target. */
async function outcome(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    if (e instanceof RedirectSignal) return e.url;
    throw e;
  }
}

/** The server-side guards Next.js runs for one URL, outermost first. */
async function visit(url: string): Promise<string | null> {
  const p = url.split(/[?#]/)[0];
  if (p === "/login" || p === "/" || p.startsWith("/onboarding/candidate")) return null;
  if (p === "/onboarding/company") return outcome(() => invitationPage.default());
  if (p === "/dashboard" || p.startsWith("/dashboard/")) {
    const fromShell = await outcome(() => shell.default({ children: null }));
    if (fromShell) return fromShell;
    if (p === "/dashboard") return outcome(() => dashboardRouter.default());
    if (p.startsWith("/dashboard/admin")) return outcome(() => adminLayout.default({ children: null }));
    if (p.startsWith("/dashboard/company/profile")) return null; // outside the (onboarded) group
    if (p.startsWith("/dashboard/company")) return outcome(() => companyArea.default({ children: null }));
    return null; // candidate pages: shell only
  }
  throw new Error(`unmodelled route ${p}`);
}

async function land(start: string): Promise<{ final: string; chain: string[] }> {
  const chain = [start];
  let current = start;
  for (let hop = 0; hop < 8; hop++) {
    const next = await visit(current);
    if (next === null) return { final: current, chain };
    assert.ok(!chain.includes(next), `redirect loop: ${[...chain, next].join(" → ")}`);
    chain.push(next);
    current = next;
  }
  assert.fail(`no page rendered after 8 redirects: ${chain.join(" → ")}`);
}

const userRow = (id: string) => db.table("user").find((u) => u.id === id)!;
const START_URLS = [
  "/dashboard",
  "/dashboard/company",
  "/dashboard/company/jobs",
  "/dashboard/company/analytics",
  "/dashboard/company/profile",
  "/onboarding/company",
];

async function expectAll(persona: Persona, expected: string, urls = START_URLS) {
  as(persona);
  for (const url of urls) {
    const { final, chain } = await land(url);
    assert.equal(final, expected, `${persona} from ${url}: ${chain.join(" → ")}`);
  }
}

// ═══ Scenario 1: new company, onboarding incomplete ═══════════════════════

test("S1: a new COMPANY (isOnboarded=false, no company row) lands on the profile page from every entry point, without a loop", async () => {
  userRow(IDS.coOrphanUser).isOnboarded = false;
  await expectAll("companyOrphan", policy.COMPANY_ONBOARDING_PATH);
});

test("S1: the JWT claim cannot skip onboarding: claim says onboarded, DB says not → still the profile page", async () => {
  // `as()` always mints isOnboarded: true claims; the DB row is the truth.
  userRow(IDS.coAUser).isOnboarded = false;
  await expectAll("companyA", policy.COMPANY_ONBOARDING_PATH, ["/dashboard/company", "/dashboard/company/jobs"]);
});

test("S1 → S2: completing the company profile ends onboarding; the dashboard then renders", async () => {
  userRow(IDS.coOrphanUser).isOnboarded = false;
  as("companyOrphan");
  assert.equal((await land("/dashboard")).final, policy.COMPANY_ONBOARDING_PATH);

  const res = await profile.POST(req("/api/profile", { method: "POST", json: { name: "Orphan Co", slug: "orphan-co" } }));
  assert.equal(res.status, 200);
  assert.equal(userRow(IDS.coOrphanUser).isOnboarded, true, "set server-side by the profile save");

  const { final, chain } = await land("/dashboard");
  assert.equal(final, "/dashboard/company", chain.join(" → "));
});

// ═══ Scenario 2 / 3: completed and existing companies ═════════════════════

test("S2/S3: an onboarded COMPANY reaches every company page and is never sent to onboarding", async () => {
  as("companyA");
  for (const url of ["/dashboard/company", "/dashboard/company/jobs", "/dashboard/company/analytics", "/dashboard/company/profile"]) {
    assert.deepEqual((await land(url)).chain, [url], `rendered directly: ${url}`);
  }
  assert.equal((await land("/dashboard")).final, "/dashboard/company");
  // The invitation page sends signed-in users to their dashboard.
  assert.equal((await land("/onboarding/company")).final, "/dashboard/company");
});

test("S3: routing never writes: onboarding status and roles are unchanged after every visit", async () => {
  userRow(IDS.coOrphanUser).isOnboarded = false;
  const snapshot = () => db.table("user").map((u) => `${u.id}:${u.role}:${u.isOnboarded}:${u.isActive}`).join("|");
  const before = snapshot();
  for (const persona of ["companyA", "companyB", "companyOrphan", "candidate", "admin"] as const) {
    as(persona);
    for (const url of START_URLS) await land(url);
  }
  assert.equal(snapshot(), before);
  const writes = db.calls.filter((c) => c.model === "user" && /create|update|delete|upsert/.test(c.op));
  assert.deepEqual(writes, []);
});

// ═══ Scenario 4: suspended company ════════════════════════════════════════

test("S4: a suspended COMPANY (onboarded or not) is sent to /login from every dashboard URL, no loop", async () => {
  userRow(IDS.coAUser).isActive = false;
  await expectAll("companyA", "/login", START_URLS.filter((u) => u.startsWith("/dashboard")));
  userRow(IDS.coOrphanUser).isActive = false;
  userRow(IDS.coOrphanUser).isOnboarded = false;
  await expectAll("companyOrphan", "/login", START_URLS.filter((u) => u.startsWith("/dashboard")));
});

test("S4: a session whose user row is gone is sent to /login", async () => {
  as("companyA");
  db.table("user").splice(db.table("user").findIndex((u) => u.id === IDS.coAUser), 1);
  for (const url of ["/dashboard", "/dashboard/company", "/dashboard/company/profile"]) {
    assert.equal((await land(url)).final, "/login");
  }
});

// ═══ Scenario 5: candidate ═════════════════════════════════════════════════

test("S5: a CANDIDATE cannot use company onboarding or company pages; lands on the candidate dashboard", async () => {
  await expectAll("candidate", "/dashboard/candidate", [
    "/dashboard",
    "/dashboard/company",
    "/dashboard/company/jobs",
    "/dashboard/company/analytics",
    "/onboarding/company",
  ]);
});

test("S5: a not-onboarded CANDIDATE goes to candidate onboarding (unchanged behaviour)", async () => {
  userRow(IDS.candUser).isOnboarded = false;
  await expectAll("candidate", "/onboarding/candidate", ["/dashboard", "/dashboard/candidate", "/dashboard/company", "/onboarding/company"]);
});

test("S5: a candidate is routed out of the company area in ONE hop, straight to its own home", async () => {
  // Not via /dashboard: the target is computed from the DB role directly.
  as("candidate");
  assert.equal(await visit("/dashboard/company/jobs"), "/dashboard/candidate");
  assert.equal(await visit("/dashboard/company"), "/dashboard/candidate");
});

// ═══ Scenario 6: admin ═════════════════════════════════════════════════════

test("S6: ADMIN routing is unchanged: /dashboard and company URLs lead to the admin dashboard, never to onboarding", async () => {
  await expectAll("admin", "/dashboard/admin", ["/dashboard", "/dashboard/company", "/dashboard/company/jobs", "/onboarding/company"]);
  assert.deepEqual((await land("/dashboard/admin")).chain, ["/dashboard/admin"]);
  userRow(IDS.adminUser).isOnboarded = false; // admins never need onboarding
  assert.deepEqual((await land("/dashboard/admin")).chain, ["/dashboard/admin"]);
});

test("S6: non-admins are still kept out of /dashboard/admin", async () => {
  for (const persona of ["candidate", "companyA"] as const) {
    as(persona);
    assert.equal((await land("/dashboard/admin")).final, "/");
  }
  as("anon");
  assert.equal((await land("/dashboard/admin")).final, "/login");
});

test("anonymous: dashboard URLs go to /login; the invitation page renders", async () => {
  as("anon");
  for (const url of ["/dashboard", "/dashboard/company", "/dashboard/company/profile"]) {
    assert.equal((await land(url)).final, "/login");
  }
  assert.deepEqual((await land("/onboarding/company")).chain, ["/onboarding/company"]);
});

// ═══ Policy truth table and structure ═════════════════════════════════════

test("policy: exhaustive role × active × onboarded table, and no self-redirects", () => {
  const { resolveDashboardShellRedirect: shellR, resolveCompanyAreaRedirect: areaR } = policy;
  assert.equal(shellR(null), "/login");
  assert.equal(areaR(null), "/login");
  for (const role of ["CANDIDATE", "COMPANY", "ADMIN", "WEIRD"]) {
    for (const isActive of [true, false]) {
      for (const isOnboarded of [true, false]) {
        const u = { role, isActive, isOnboarded };
        const s = shellR(u);
        const a = areaR(u);
        if (!isActive) {
          assert.equal(s, "/login");
          assert.equal(a, "/login");
          continue;
        }
        assert.equal(s, role === "CANDIDATE" && !isOnboarded ? "/onboarding/candidate" : null, JSON.stringify(u));
        if (role === "COMPANY") assert.equal(a, isOnboarded ? null : "/dashboard/company/profile");
        else assert.equal(a, policy.dashboardHomeFor(role));
        // The company area never redirects into itself (other than profile,
        // which is outside the guarded group).
        assert.ok(!a || !a.startsWith("/dashboard/company") || a === "/dashboard/company/profile");
      }
    }
  }
});

test("structure: every company page except the profile page is inside the guarded (onboarded) group", () => {
  const root = path.join(process.cwd(), "app/(dashboard)/dashboard/company");
  const pages: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === "page.tsx") pages.push(path.relative(root, full).split(path.sep).join("/"));
    }
  };
  walk(root);
  assert.ok(pages.length >= 5, pages.join(","));
  for (const p of pages) {
    if (p === "profile/page.tsx") continue;
    assert.ok(p.startsWith("(onboarded)/"), `unguarded company page: ${p}`);
  }
});

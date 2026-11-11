/**
 * Route-level test harness.
 *
 * Each integration test file runs in its own process (node --test default),
 * calls `installMocks()` BEFORE importing any route module, then drives the
 * real Next.js route handlers with real `Request` objects.
 *
 * Replaced (never real in tests):
 *   @/lib/prisma            → in-memory fake (tests/integration/fake-prisma.ts)
 *   @/lib/auth (`auth()`)   → returns the session chosen by the test
 *   next/cache              → unstable_cache pass-through, revalidate no-ops
 *   @supabase/supabase-js   → in-memory storage
 *   @/lib/ai-service        → deterministic stubs (no OpenAI calls)
 * Real: validation, authorization, serializers, rate limiter (in-memory
 * store), SSRF guard, file-type detection, CV access policy, logger.
 *
 * No network, no database, no email is ever touched.
 */
import { mock } from "node:test";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { NextRequest } from "next/server";
import { createFakePrisma, type Tables } from "./fake-prisma";

export const IDS = {
  adminUser: "00000000-0000-4000-8000-0000000000a1",
  coAUser: "00000000-0000-4000-8000-00000000c0a1",
  coBUser: "00000000-0000-4000-8000-00000000c0b1",
  coOrphanUser: "00000000-0000-4000-8000-00000000c0f1",
  candUser: "00000000-0000-4000-8000-0000000000d1",
  cand2User: "00000000-0000-4000-8000-0000000000d2",
  coA: "11111111-0000-4000-8000-00000000000a",
  coB: "11111111-0000-4000-8000-00000000000b",
  cand: "22222222-0000-4000-8000-000000000001",
  cand2: "22222222-0000-4000-8000-000000000002",
  jobAPub: "33333333-0000-4000-8000-0000000000a1",
  jobADraft: "33333333-0000-4000-8000-0000000000a2",
  jobBPub: "33333333-0000-4000-8000-0000000000b1",
  jobBDraft: "33333333-0000-4000-8000-0000000000b2",
  benA1: "44444444-0000-4000-8000-0000000000a1",
  benA2: "44444444-0000-4000-8000-0000000000a2",
  benB1: "44444444-0000-4000-8000-0000000000b1",
  appA: "55555555-0000-4000-8000-0000000000a1",
  appB: "55555555-0000-4000-8000-0000000000b1",
  appCand2: "55555555-0000-4000-8000-0000000000a2",
} as const;

export const CV_PATH = `${IDS.candUser}/1700000000000-0d9a3c58-6f8e-4d25-9f1b-2b8a7d1f6a10.pdf`;
export const SECRET_NOTE = "INTERNAL: weak communicator, do not hire";

export function seed(): Partial<Tables> {
  const now = new Date();
  const future = new Date(Date.now() + 30 * 864e5);
  const user = (id: string, role: string, email: string) => ({
    id, email, role, name: email, isActive: true, isOnboarded: true, emailVerified: now,
    sessionVersion: 0, passwordHash: null, image: null, createdAt: now, updatedAt: now, deletedAt: null,
  });
  const job = (id: string, companyId: string, status: string, title: string) => ({
    id, companyId, title, slug: `${title.toLowerCase().replace(/\W+/g, "-")}-${id.slice(-4)}`, status,
    description: "desc", requirements: [], customLocation: "Tunis", contractType: "CDI", isRemote: false, isHybrid: false,
    employmentType: "FULL_TIME", activityType: "CUSTOMER_SERVICE", activityCustom: null, applicationType: "INTERNAL",
    externalApplyUrl: null, salary: null, salaryMin: null, salaryMax: null, salaryCurrency: "USD",
    featured: false, highlight: false, views: 0, publishedAt: status === "PUBLISHED" ? now : null, closedAt: null,
    expiresAt: future, deletedAt: null, technicalTools: [], softSkills: [], aiGenerated: false, aiModel: null,
    metaTitle: null, metaDescription: null, createdAt: now, updatedAt: now,
  });
  const company = (id: string, userId: string, name: string) => ({
    id, userId, name, slug: name.toLowerCase(), logoUrl: null, location: "Tunis", website: null, description: null,
    isRemoteFriendly: false, isHybridFriendly: false, createdAt: now, updatedAt: now, deletedAt: null,
  });
  const app = (id: string, candidateId: string, jobOfferId: string) => ({
    id, candidateId, jobOfferId, coverLetter: "hello", cvUrl: CV_PATH, status: "EN_COURS_EXAMEN",
    notes: SECRET_NOTE, isSaved: true, createdAt: now, updatedAt: now,
  });
  return {
    user: [
      user(IDS.adminUser, "ADMIN", "admin@cx.test"),
      user(IDS.coAUser, "COMPANY", "a@cx.test"),
      user(IDS.coBUser, "COMPANY", "b@cx.test"),
      user(IDS.coOrphanUser, "COMPANY", "orphan@cx.test"),
      user(IDS.candUser, "CANDIDATE", "cand@cx.test"),
      user(IDS.cand2User, "CANDIDATE", "cand2@cx.test"),
    ],
    companies: [company(IDS.coA, IDS.coAUser, "Alpha"), company(IDS.coB, IDS.coBUser, "Beta")],
    candidate: [
      // Complete enough to apply (A1: phone + location + >= 50% of sections).
      { id: IDS.cand, userId: IDS.candUser, firstName: "Cand", lastName: "One", phone: "+21600000001", location: "Tunis", headline: "Agent", resumeUrl: CV_PATH, createdAt: now, updatedAt: now },
      { id: IDS.cand2, userId: IDS.cand2User, firstName: "Cand", lastName: "Two", phone: "+21600000002", location: "Sousse", headline: "Agent", resumeUrl: null, createdAt: now, updatedAt: now },
    ],
    jobOffer: [
      job(IDS.jobAPub, IDS.coA, "PUBLISHED", "Alpha Agent"),
      job(IDS.jobADraft, IDS.coA, "DRAFT", "Alpha Secret Draft"),
      job(IDS.jobBPub, IDS.coB, "PUBLISHED", "Beta Agent"),
      job(IDS.jobBDraft, IDS.coB, "DRAFT", "Beta Secret Draft"),
    ],
    companyBenefit: [
      { id: IDS.benA1, companyId: IDS.coA, name: "A1", scope: "ADDITIONAL", category: "OTHER", createdAt: now, updatedAt: now },
      { id: IDS.benA2, companyId: IDS.coA, name: "A2", scope: "ADDITIONAL", category: "OTHER", createdAt: now, updatedAt: now },
      { id: IDS.benB1, companyId: IDS.coB, name: "B1", scope: "ADDITIONAL", category: "OTHER", createdAt: now, updatedAt: now },
    ],
    application: [
      app(IDS.appA, IDS.cand, IDS.jobAPub),
      app(IDS.appB, IDS.cand, IDS.jobBPub),
      app(IDS.appCand2, IDS.cand2, IDS.jobAPub),
    ],
  };
}

export type Persona = "anon" | "candidate" | "candidate2" | "companyA" | "companyB" | "companyOrphan" | "admin";

const PERSONAS: Record<Exclude<Persona, "anon">, { id: string; role: string; email: string }> = {
  candidate: { id: IDS.candUser, role: "CANDIDATE", email: "cand@cx.test" },
  candidate2: { id: IDS.cand2User, role: "CANDIDATE", email: "cand2@cx.test" },
  companyA: { id: IDS.coAUser, role: "COMPANY", email: "a@cx.test" },
  companyB: { id: IDS.coBUser, role: "COMPANY", email: "b@cx.test" },
  companyOrphan: { id: IDS.coOrphanUser, role: "COMPANY", email: "orphan@cx.test" },
  admin: { id: IDS.adminUser, role: "ADMIN", email: "admin@cx.test" },
};

export const storage = {
  objects: new Map<string, { bucket: string; contentType: string; size: number; body: Buffer }>(),
  signed: [] as { bucket: string; path: string; expiresIn: number; download: boolean }[],
  publicUrlCalls: [] as { bucket: string; path: string }[],
};

/** Cache revalidations requested by route code (next/cache is mocked). */
export const cache = {
  revalidated: [] as string[],
  /** Second argument of each revalidateTag call, by tag (P5/A6: must expire at once). */
  tagProfiles: [] as { tag: string; profile: unknown }[],
};

export const ai = {
  calls: [] as { fn: string; input: unknown; signal?: AbortSignal }[],
  /** When set, every mocked AI call rejects with this error (timeout/failure tests). */
  failWith: null as Error | null,
};

let currentSession: unknown = null;
export const db = createFakePrisma(seed());

export function as(persona: Persona) {
  currentSession =
    persona === "anon"
      ? null
      : { user: { ...PERSONAS[persona], name: null, image: null, isOnboarded: true }, expires: "2999-01-01T00:00:00.000Z" };
}

/**
 * Act as an arbitrary account (e.g. one created by the real register route).
 * The session mirrors the DATABASE row: role and onboarding state are read
 * from the user table, never chosen by the test.
 */
export function asUser(userId: string) {
  const u = db.table("user").find((r) => r.id === userId);
  if (!u) throw new Error(`asUser: no user ${userId}`);
  currentSession = {
    user: { id: u.id, email: u.email, role: u.role, name: u.name ?? null, image: null, isOnboarded: !!u.isOnboarded },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

let installed = false;
/**
 * @param opts.realAuth  use the REAL lib/auth (Auth.js handlers, jwt
 *                       callback, credentials authorize) instead of a mocked
 *                       `auth()`; sessions then come from real cookies.
 */
export function installMocks(opts: { realAuth?: boolean } = {}) {
  if (installed) return;
  installed = true;
  process.env.AUTH_SECRET = "integration-test-secret-integration-test-secret";
  process.env.APP_URL = "https://cxjobs.test";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://testproj.supabase.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  process.env.OPENAI_API_KEY = "test-openai-key";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.VERCEL;
  delete process.env.EMAIL_PROVIDER;
  delete process.env.RESEND_API_KEY;

  // Hard network guard: a route test must never reach a real service. Any
  // non-loopback fetch fails the test loudly instead of leaving the machine.
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return realFetch(input, init);
    throw new Error(`Network access blocked in tests: ${url.origin}`);
  }) as typeof fetch;

  mock.module("@/lib/prisma", { defaultExport: db.client, namedExports: { connectPrisma: async () => {} } });

  if (!opts.realAuth) mock.module("@/lib/auth", {
    namedExports: {
      auth: async () => currentSession,
      signIn: async () => undefined,
      signOut: async () => undefined,
      unstable_update: async () => undefined,
      handlers: { GET: async () => new Response(null), POST: async () => new Response(null) },
    },
  });

  mock.module("next/cache", {
    namedExports: {
      unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
      revalidateTag: (tag: string, profile?: unknown) => {
        cache.revalidated.push(`tag:${tag}`);
        cache.tagProfiles.push({ tag, profile });
      },
      revalidatePath: (path: string) => {
        cache.revalidated.push(`path:${path}`);
      },
      unstable_noStore: () => {},
    },
  });

  // The package resolves to different files for `import` and `require`
  // (tsx compiles app code to CJS), so mock every resolution.
  const supabaseMock = {
    namedExports: {
      createClient: () => ({
        storage: {
          from: (bucket: string) => ({
            async upload(path: string, body: Buffer, opts: { contentType: string }) {
              storage.objects.set(`${bucket}/${path}`, { bucket, contentType: opts.contentType, size: body.length, body: Buffer.from(body) });
              return { data: { path }, error: null };
            },
            async createSignedUrl(path: string, expiresIn: number, opts?: { download?: boolean }) {
              storage.signed.push({ bucket, path, expiresIn, download: !!opts?.download });
              return { data: { signedUrl: `https://testproj.supabase.invalid/storage/v1/object/sign/${bucket}/${path}?token=SIGNED` }, error: null };
            },
            getPublicUrl(path: string) {
              storage.publicUrlCalls.push({ bucket, path });
              return { data: { publicUrl: `https://testproj.supabase.invalid/storage/v1/object/public/${bucket}/${path}` } };
            },
            async remove() {
              return { error: null };
            },
          }),
        },
      }),
    },
  };
  const requireFromHere = createRequire(import.meta.url ?? __filename);
  const specifiers = new Set<string>(["@supabase/supabase-js"]);
  try {
    specifiers.add(pathToFileURL(requireFromHere.resolve("@supabase/supabase-js")).href);
  } catch {
    /* resolution failure → bare specifier only */
  }
  for (const s of specifiers) mock.module(s, supabaseMock);

  mock.module("@/lib/ai-service", {
    namedExports: {
      isAIConfigured: () => true,
      generateJobDescription: async (input: unknown, opts?: { signal?: AbortSignal }) => {
        ai.calls.push({ fn: "generateJobDescription", input, signal: opts?.signal });
        if (ai.failWith) throw ai.failWith;
        return { description: "Generated", requirements: [], benefits: [] };
      },
      extractJobFromUrlText: async (input: unknown, opts?: { signal?: AbortSignal }) => {
        ai.calls.push({ fn: "extractJobFromUrlText", input, signal: opts?.signal });
        if (ai.failWith) throw ai.failWith;
        return { title: "Scraped" };
      },
      parseCVWithAI: async (input: unknown, opts?: { signal?: AbortSignal }) => {
        ai.calls.push({ fn: "parseCVWithAI", input, signal: opts?.signal });
        if (ai.failWith) throw ai.failWith;
        return { name: "", email: "", phone: "", location: "", title: "", summary: "", skills: [], experiences: [], education: [], languages: [] };
      },
    },
  });
}

/** Fresh DB, fresh rate-limit buckets, cleared spies. */
export async function resetState() {
  db.reset(seed());
  storage.objects.clear();
  storage.signed.length = 0;
  storage.publicUrlCalls.length = 0;
  ai.calls.length = 0;
  ai.failWith = null;
  cache.revalidated.length = 0;
  cache.tagProfiles.length = 0;
  const rl = await import("@/lib/rate-limit");
  rl.__setRateLimitStoreForTests(rl.createMemoryStore());
  as("anon");
}

let ipCounter = 0;
/** Each call gets a distinct client IP unless one is given (avoids cross-test limits). */
export function req(url: string, init: RequestInit & { ip?: string; json?: unknown } = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-forwarded-for", init.ip ?? `198.51.100.${(ipCounter++ % 250) + 1}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  return new NextRequest(new URL(url, "https://cxjobs.test"), { ...init, headers, body } as ConstructorParameters<typeof NextRequest>[1]);
}

export const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

export async function body(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Fail if `needle` appears anywhere in the serialized response. */
export function assertNotLeaked(payload: unknown, needle: string) {
  const s = typeof payload === "string" ? payload : JSON.stringify(payload);
  if (s.includes(needle)) throw new Error(`Sensitive value leaked in response: ${needle}`);
}

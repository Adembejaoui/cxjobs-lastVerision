/**
 * In-memory Prisma stand-in for route-level tests. Implements the subset of
 * the Prisma Client API the routes under test use, with REAL semantics for
 * the parts that matter for security:
 *   - `where` filtering (equality, in/notIn, gt/gte/lt/lte, not, contains +
 *     mode, startsWith, has/hasSome, relation filters, some/every/none,
 *     AND/OR/NOT, compound unique keys),
 *   - `select` / `include` projection (an `include` returns EVERY scalar, so
 *     a leaked column such as `notes` is visible exactly as with Prisma),
 *   - relations, `_count`, orderBy/skip/take,
 *   - create (nested `create`), update (`increment`), delete(Many),
 *     createMany, count, `$transaction` (callback form rolls back on throw).
 * Unknown operators throw, so a test can never pass by silently ignoring a
 * filter.
 */
import { randomUUID } from "node:crypto";

type Row = Record<string, unknown>;
type Rel = { model: string; kind: "one" | "many"; local: string; foreign: string };

const RELATIONS: Record<string, Record<string, Rel>> = {
  user: {
    candidate: { model: "candidate", kind: "one", local: "id", foreign: "userId" },
    companies: { model: "companies", kind: "one", local: "id", foreign: "userId" },
  },
  candidate: {
    user: { model: "user", kind: "one", local: "userId", foreign: "id" },
    applications: { model: "application", kind: "many", local: "id", foreign: "candidateId" },
    skills: { model: "candidateSkill", kind: "many", local: "id", foreign: "candidateId" },
    experiences: { model: "experience", kind: "many", local: "id", foreign: "candidateId" },
    languages: { model: "language", kind: "many", local: "id", foreign: "candidateId" },
    education: { model: "education", kind: "many", local: "id", foreign: "candidateId" },
  },
  companies: {
    user: { model: "user", kind: "one", local: "userId", foreign: "id" },
    // The schema's name for the same relation (companies.users).
    users: { model: "user", kind: "one", local: "userId", foreign: "id" },
    benefits: { model: "companyBenefit", kind: "many", local: "id", foreign: "companyId" },
    jobOffers: { model: "jobOffer", kind: "many", local: "id", foreign: "companyId" },
    // The schema's name for the same relation (companies.jobs).
    jobs: { model: "jobOffer", kind: "many", local: "id", foreign: "companyId" },
    slugRedirects: { model: "companySlugRedirect", kind: "many", local: "id", foreign: "companyId" },
  },
  companyBenefit: {
    company: { model: "companies", kind: "one", local: "companyId", foreign: "id" },
  },
  jobOffer: {
    company: { model: "companies", kind: "one", local: "companyId", foreign: "id" },
    applications: { model: "application", kind: "many", local: "id", foreign: "jobOfferId" },
    benefits: { model: "jobOfferBenefit", kind: "many", local: "id", foreign: "jobOfferId" },
    languages: { model: "jobLanguage", kind: "many", local: "id", foreign: "jobOfferId" },
  },
  jobOfferBenefit: {
    benefit: { model: "companyBenefit", kind: "one", local: "benefitId", foreign: "id" },
    jobOffer: { model: "jobOffer", kind: "one", local: "jobOfferId", foreign: "id" },
  },
  jobLanguage: {},
  application: {
    candidate: { model: "candidate", kind: "one", local: "candidateId", foreign: "id" },
    jobOffer: { model: "jobOffer", kind: "one", local: "jobOfferId", foreign: "id" },
    statusHistory: { model: "applicationStatusHistory", kind: "many", local: "id", foreign: "applicationId" },
  },
  // Launch plan A6 / A7 models.
  companySlugRedirect: { company: { model: "companies", kind: "one", local: "companyId", foreign: "id" } },
  applicationStatusHistory: {
    application: { model: "application", kind: "one", local: "applicationId", foreign: "id" },
    changedBy: { model: "user", kind: "one", local: "changedById", foreign: "id" },
  },
  notification: { user: { model: "user", kind: "one", local: "userId", foreign: "id" } },
  passwordResetToken: { user: { model: "user", kind: "one", local: "userId", foreign: "id" } },
  emailVerificationToken: { user: { model: "user", kind: "one", local: "userId", foreign: "id" } },
  candidateSkill: {},
  experience: {},
  language: {},
  education: {},
  // Auth.js PrismaAdapter: getUserByAccount uses `include: { user: true }`.
  account: { user: { model: "user", kind: "one", local: "userId", foreign: "id" } },
  companyInvitation: {},
  landingPageVisitor: {},
};

const DEFAULTS: Record<string, () => Row> = {
  user: () => ({ role: "CANDIDATE", isActive: true, isOnboarded: false, emailVerified: null, sessionVersion: 0, deletedAt: null, image: null, name: null, passwordHash: null }),
  jobOffer: () => ({ deletedAt: null, status: "DRAFT", featured: false, highlight: false, views: 0, publishedAt: null, closedAt: null, expiresAt: null, requirements: [], technicalTools: [], softSkills: [] }),
  application: () => ({ status: "NOUVEAU", notes: null, isSaved: false, coverLetter: "", cvUrl: null }),
  notification: () => ({ readAt: null, body: null, link: null }),
  companyInvitation: () => ({ status: "PENDING", usedAt: null, revokedAt: null, managerName: null, managerEmail: null, tokenEncrypted: null }),
};

export type Tables = Record<string, Row[]>;

function clone<T>(v: T): T {
  return structuredClone(v);
}

export function createFakePrisma(initial: Partial<Tables> = {}) {
  let tables: Tables = {};
  for (const m of Object.keys(RELATIONS)) tables[m] = [];
  for (const [m, rows] of Object.entries(initial)) tables[m] = clone(rows ?? []);
  const calls: { model: string; op: string; args: unknown }[] = [];

  const rel = (model: string, field: string) => RELATIONS[model]?.[field];
  const related = (model: string, row: Row, r: Rel): Row[] =>
    tables[r.model].filter((x) => x[r.foreign] === row[r.local] && row[r.local] !== null && row[r.local] !== undefined);

  function matchScalar(value: unknown, cond: unknown): boolean {
    if (cond === null || typeof cond !== "object" || cond instanceof Date || Array.isArray(cond)) {
      if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
      return value === cond;
    }
    const c = cond as Record<string, unknown>;
    const insensitive = c.mode === "insensitive";
    const norm = (v: unknown) => (insensitive && typeof v === "string" ? v.toLowerCase() : v);
    for (const [op, arg] of Object.entries(c)) {
      const cmp = (fn: (a: number, b: number) => boolean) => {
        if (value === null || value === undefined) return false;
        const a = value instanceof Date ? value.getTime() : (value as number);
        const b = arg instanceof Date ? arg.getTime() : (arg as number);
        return fn(a, b);
      };
      switch (op) {
        case "mode":
          break;
        case "equals":
          // Honour `mode: "insensitive"` like Postgres does for string equality.
          if (insensitive && typeof value === "string" && typeof arg === "string") {
            if (norm(value) !== norm(arg)) return false;
          } else if (!matchScalar(value, arg)) return false;
          break;
        case "in":
          if (!(arg as unknown[]).includes(value)) return false;
          break;
        case "notIn":
          if ((arg as unknown[]).includes(value)) return false;
          break;
        case "not":
          if (matchScalar(value, arg)) return false;
          break;
        case "gt":
          if (!cmp((a, b) => a > b)) return false;
          break;
        case "gte":
          if (!cmp((a, b) => a >= b)) return false;
          break;
        case "lt":
          if (!cmp((a, b) => a < b)) return false;
          break;
        case "lte":
          if (!cmp((a, b) => a <= b)) return false;
          break;
        case "contains":
          if (typeof value !== "string" || !(norm(value) as string).includes(norm(arg) as string)) return false;
          break;
        case "startsWith":
          if (typeof value !== "string" || !(norm(value) as string).startsWith(norm(arg) as string)) return false;
          break;
        case "has":
          if (!Array.isArray(value) || !value.includes(arg)) return false;
          break;
        case "hasSome":
          if (!Array.isArray(value) || !(arg as unknown[]).some((x) => value.includes(x))) return false;
          break;
        default:
          throw new Error(`fake-prisma: unsupported operator "${op}"`);
      }
    }
    return true;
  }

  function matches(model: string, row: Row, where: Record<string, unknown> | undefined): boolean {
    if (!where) return true;
    for (const [key, cond] of Object.entries(where)) {
      if (cond === undefined) continue;
      if (key === "AND") {
        const list = Array.isArray(cond) ? cond : [cond];
        if (!list.every((w) => matches(model, row, w as Record<string, unknown>))) return false;
        continue;
      }
      if (key === "OR") {
        if (!(cond as Record<string, unknown>[]).some((w) => matches(model, row, w))) return false;
        continue;
      }
      if (key === "NOT") {
        const list = Array.isArray(cond) ? cond : [cond];
        if (list.some((w) => matches(model, row, w as Record<string, unknown>))) return false;
        continue;
      }
      const r = rel(model, key);
      if (r) {
        const rows = related(model, row, r);
        const c = cond as Record<string, unknown>;
        if (r.kind === "one") {
          if (cond === null) {
            if (rows.length) return false;
            continue;
          }
          const target = "is" in c ? (c.is as Record<string, unknown>) : c;
          if (!rows[0] || !matches(r.model, rows[0], target)) return false;
        } else {
          if (c.some && !rows.some((x) => matches(r.model, x, c.some as Record<string, unknown>))) return false;
          if (c.every && !rows.every((x) => matches(r.model, x, c.every as Record<string, unknown>))) return false;
          if (c.none && rows.some((x) => matches(r.model, x, c.none as Record<string, unknown>))) return false;
        }
        continue;
      }
      // Compound unique (e.g. candidateId_jobOfferId)
      if (key.includes("_") && cond && typeof cond === "object" && !(cond instanceof Date) && !(key in row)) {
        if (!matches(model, row, cond as Record<string, unknown>)) return false;
        continue;
      }
      if (!matchScalar(row[key], cond)) return false;
    }
    return true;
  }

  function sortRows(rows: Row[], orderBy: unknown): Row[] {
    if (!orderBy) return rows;
    const list = (Array.isArray(orderBy) ? orderBy : [orderBy]) as Record<string, unknown>[];
    return [...rows].sort((a, b) => {
      for (const o of list) {
        const [field, dirRaw] = Object.entries(o)[0];
        if (typeof dirRaw !== "string") continue; // relation ordering not modelled
        const dir = dirRaw === "desc" ? -1 : 1;
        const av = a[field] instanceof Date ? (a[field] as Date).getTime() : (a[field] as number);
        const bv = b[field] instanceof Date ? (b[field] as Date).getTime() : (b[field] as number);
        if (av === bv) continue;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        return av > bv ? dir : -dir;
      }
      return 0;
    });
  }

  function project(model: string, row: Row, rawArgs: object = {}): Row {
    const args = rawArgs as { select?: Record<string, unknown>; include?: Record<string, unknown> };
    const out: Row = {};
    const scalars = Object.keys(row);
    const relField = (field: string, spec: unknown) => {
      if (field === "_count") {
        const sel = ((spec as { select?: Record<string, unknown> }).select ?? {}) as Record<string, unknown>;
        const counts: Row = {};
        // Prisma honours `_count: { select: { rel: { where } } }`; so does the fake.
        for (const f of Object.keys(sel)) {
          const r = rel(model, f)!;
          const spec = sel[f];
          const where = spec && typeof spec === "object" ? (spec as { where?: Record<string, unknown> }).where : undefined;
          counts[f] = related(model, row, r).filter((x) => matches(r.model, x, where)).length;
        }
        out._count = counts;
        return;
      }
      const r = rel(model, field);
      if (!r) throw new Error(`fake-prisma: unknown relation ${model}.${field}`);
      const sub = (spec === true ? {} : spec) as { select?: Record<string, unknown>; include?: Record<string, unknown>; where?: Record<string, unknown>; orderBy?: unknown; take?: number };
      let rows = related(model, row, r).filter((x) => matches(r.model, x, sub.where));
      if (r.kind === "one") {
        out[field] = rows[0] ? project(r.model, rows[0], sub) : null;
      } else {
        rows = sortRows(rows, sub.orderBy);
        if (typeof sub.take === "number") rows = rows.slice(0, sub.take);
        out[field] = rows.map((x) => project(r.model, x, sub));
      }
    };
    if (args.select) {
      for (const [field, spec] of Object.entries(args.select)) {
        if (!spec) continue;
        if (field === "_count" || rel(model, field)) relField(field, spec);
        else out[field] = clone(row[field]);
      }
      return out;
    }
    for (const f of scalars) out[f] = clone(row[f]);
    if (args.include) for (const [field, spec] of Object.entries(args.include)) if (spec) relField(field, spec);
    return out;
  }

  function applyData(model: string, row: Row, data: Record<string, unknown>) {
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      const r = rel(model, k);
      if (r) {
        const nested = v as { create?: Row | Row[] };
        if (nested.create) {
          for (const child of Array.isArray(nested.create) ? nested.create : [nested.create]) {
            insert(r.model, { ...child, [r.foreign]: row[r.local] });
          }
          continue;
        }
        throw new Error(`fake-prisma: unsupported nested write on ${model}.${k}`);
      }
      if (v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) {
        const op = v as Record<string, number>;
        if ("increment" in op) row[k] = ((row[k] as number) ?? 0) + op.increment;
        else if ("decrement" in op) row[k] = ((row[k] as number) ?? 0) - op.decrement;
        else if ("set" in op) row[k] = op.set;
        else throw new Error(`fake-prisma: unsupported update op on ${model}.${k}`);
      } else {
        row[k] = clone(v);
      }
    }
  }

  function insert(model: string, data: Row): Row {
    const now = new Date();
    const row: Row = { id: randomUUID(), createdAt: now, updatedAt: now, ...(DEFAULTS[model]?.() ?? {}) };
    const nested: Row = {};
    for (const [k, v] of Object.entries(data)) (rel(model, k) ? nested : row)[k] = rel(model, k) ? v : clone(v);
    tables[model].push(row);
    applyData(model, row, nested);
    return row;
  }

  function delegate(model: string) {
    const rec = (op: string, args: unknown) => calls.push({ model, op, args: clone(args) });
    const find = (args: { where?: Record<string, unknown>; orderBy?: unknown; skip?: number; take?: number } = {}) => {
      let rows = tables[model].filter((r) => matches(model, r, args.where));
      rows = sortRows(rows, args.orderBy);
      if (args.skip) rows = rows.slice(args.skip);
      if (typeof args.take === "number") rows = rows.slice(0, args.take);
      return rows;
    };
    return {
      async findUnique(args: { where: Record<string, unknown> } & Record<string, unknown>) {
        rec("findUnique", args);
        const row = find(args)[0];
        return row ? project(model, row, args) : null;
      },
      async findFirst(args: Record<string, unknown> = {}) {
        rec("findFirst", args);
        const row = find(args as never)[0];
        return row ? project(model, row, args) : null;
      },
      async findMany(args: Record<string, unknown> = {}) {
        rec("findMany", args);
        return find(args as never).map((r) => project(model, r, args));
      },
      async count(args: { where?: Record<string, unknown> } = {}) {
        rec("count", args);
        return find({ where: args.where }).length;
      },
      // Minimal groupBy: `by` + `where` + `_count` (true, or { field: true }).
      async groupBy(args: { by: string[]; where?: Record<string, unknown>; _count?: true | Record<string, boolean> }) {
        rec("groupBy", args);
        const groups = new Map<string, Row[]>();
        for (const r of find({ where: args.where })) {
          const key = JSON.stringify(args.by.map((k) => r[k]));
          groups.set(key, [...(groups.get(key) ?? []), r]);
        }
        return [...groups.values()].map((rows) => {
          const out: Row = Object.fromEntries(args.by.map((k) => [k, rows[0][k]]));
          if (args._count === true) out._count = rows.length;
          else if (args._count) out._count = Object.fromEntries(Object.keys(args._count).map((k) => [k, rows.length]));
          return out;
        });
      },
      async create(args: { data: Row } & Record<string, unknown>) {
        rec("create", args);
        return project(model, insert(model, args.data), args);
      },
      async createMany(args: { data: Row[] }) {
        rec("createMany", args);
        for (const d of args.data) insert(model, d);
        return { count: args.data.length };
      },
      async update(args: { where: Record<string, unknown>; data: Record<string, unknown> } & Record<string, unknown>) {
        rec("update", args);
        const row = find({ where: args.where })[0];
        if (!row) throw Object.assign(new Error("Record to update not found."), { code: "P2025" });
        applyData(model, row, args.data);
        row.updatedAt = new Date();
        return project(model, row, args);
      },
      async updateMany(args: { where?: Record<string, unknown>; data: Record<string, unknown> }) {
        rec("updateMany", args);
        const rows = find({ where: args.where });
        for (const r of rows) applyData(model, r, args.data);
        return { count: rows.length };
      },
      async upsert(args: { where: Record<string, unknown>; create: Row; update: Record<string, unknown> } & Record<string, unknown>) {
        rec("upsert", args);
        const row = find({ where: args.where })[0];
        if (row) {
          applyData(model, row, args.update);
          row.updatedAt = new Date();
          return project(model, row, args);
        }
        return project(model, insert(model, args.create), args);
      },
      async delete(args: { where: Record<string, unknown> }) {
        rec("delete", args);
        const row = find({ where: args.where })[0];
        if (!row) throw Object.assign(new Error("Record to delete does not exist."), { code: "P2025" });
        tables[model] = tables[model].filter((r) => r !== row);
        return clone(row);
      },
      async deleteMany(args: { where?: Record<string, unknown> } = {}) {
        rec("deleteMany", args);
        const rows = find({ where: args.where });
        tables[model] = tables[model].filter((r) => !rows.includes(r));
        return { count: rows.length };
      },
    };
  }

  const client: Record<string, unknown> = {};
  for (const m of Object.keys(RELATIONS)) client[m] = delegate(m);
  client.$transaction = async (arg: unknown) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    const snapshot = clone(tables);
    try {
      return await (arg as (tx: unknown) => Promise<unknown>)(client);
    } catch (e) {
      tables = snapshot;
      throw e;
    }
  };
  client.$queryRaw = async () => [];
  client.$executeRaw = async () => 0;

  return {
    client,
    calls,
    table: (m: string) => tables[m],
    reset(next: Partial<Tables>) {
      tables = {};
      for (const m of Object.keys(RELATIONS)) tables[m] = [];
      for (const [m, rows] of Object.entries(next)) tables[m] = clone(rows ?? []);
      calls.length = 0;
    },
  };
}

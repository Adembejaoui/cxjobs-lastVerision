import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveJobOfferListScope, privateScopeBaseWhere } from "../../lib/security/job-offer-scope";
import {
  CANDIDATE_APPLICATION_SCALARS,
  stripRecruiterOnlyFields,
} from "../../lib/security/application-fields";
import {
  validateBenefitOwnership,
  stripCompanyProtectedJobFields,
  type BenefitLookup,
} from "../../lib/security/benefits";

// ─── S2: job-offer list scoping ──────────────────────────────────────────

const companies: Record<string, string> = { "user-a": "company-a", "user-b": "company-b" };
const findOwn = async (userId: string) => companies[userId] ?? null;

test("S2: unauthenticated users get the public catalogue only", async () => {
  const s = await resolveJobOfferListScope({ requestedStatus: "DRAFT" }, findOwn);
  assert.deepEqual(s, { kind: "public", companyId: undefined });
});

test("S2: candidate cannot reach private scope even with status/companyId", async () => {
  const s = await resolveJobOfferListScope(
    { role: "CANDIDATE", userId: "c1", requestedCompanyId: "company-a", requestedStatus: "DRAFT" },
    findOwn
  );
  assert.equal(s.kind, "public");
});

test("S2: company owner sees own jobs in any status when it asks for its own companyId", async () => {
  const s = await resolveJobOfferListScope(
    { role: "COMPANY", userId: "user-a", requestedCompanyId: "company-a", requestedStatus: "DRAFT" },
    findOwn
  );
  assert.deepEqual(s, { kind: "owner", companyId: "company-a", status: "DRAFT" });
  assert.deepEqual(privateScopeBaseWhere(s as never), { deletedAt: null, companyId: "company-a", status: "DRAFT" });
});

test("NF-03: company browsing without companyId gets the public catalogue, not only its own jobs", async () => {
  const s = await resolveJobOfferListScope({ role: "COMPANY", userId: "user-a", requestedStatus: "DRAFT" }, findOwn);
  assert.deepEqual(s, { kind: "public", companyId: undefined });
});

test("S2: forged companyId of ANOTHER company never yields private data", async () => {
  const s = await resolveJobOfferListScope(
    { role: "COMPANY", userId: "user-a", requestedCompanyId: "company-b", requestedStatus: "DRAFT" },
    findOwn
  );
  // Falls back to that company's PUBLIC listing (status ignored there).
  assert.deepEqual(s, { kind: "public", companyId: "company-b" });
});

test("S2: COMPANY user without a company profile never gets an unfiltered private query", async () => {
  const s = await resolveJobOfferListScope({ role: "COMPANY", userId: "orphan", requestedStatus: "DRAFT" }, findOwn);
  assert.deepEqual(s, { kind: "public", companyId: undefined });
});

test("S2: admin may filter by any company and status", async () => {
  const s = await resolveJobOfferListScope(
    { role: "ADMIN", userId: "adm", requestedCompanyId: "company-b", requestedStatus: "DRAFT" },
    findOwn
  );
  assert.deepEqual(s, { kind: "admin", companyId: "company-b", status: "DRAFT" });
});

test("S2: role claim without a user id is treated as public", async () => {
  const s = await resolveJobOfferListScope({ role: "ADMIN" }, findOwn);
  assert.equal(s.kind, "public");
});

// ─── S3: recruiter notes confidentiality ─────────────────────────────────

test("S3: candidate application select never includes recruiter notes", () => {
  assert.equal(Object.prototype.hasOwnProperty.call(CANDIDATE_APPLICATION_SCALARS, "notes"), false);
  assert.deepEqual(Object.keys(CANDIDATE_APPLICATION_SCALARS).sort(), [
    "candidateId", "coverLetter", "createdAt", "cvUrl", "id", "isSaved", "jobOfferId", "status", "updatedAt",
  ]);
});

test("S3: serializer strips notes from objects and arrays", () => {
  const app = { id: "a1", status: "NOUVEAU", notes: "weak communicator — reject" };
  assert.deepEqual(stripRecruiterOnlyFields(app), { id: "a1", status: "NOUVEAU" });
  assert.deepEqual(stripRecruiterOnlyFields([app, app]), [
    { id: "a1", status: "NOUVEAU" },
    { id: "a1", status: "NOUVEAU" },
  ]);
  // Input is not mutated (recruiter view built from the same row keeps notes).
  assert.equal(app.notes, "weak communicator — reject");
});

// ─── S9: benefit ownership ────────────────────────────────────────────────

const benefitRows = [
  { id: "11111111-1111-4111-8111-111111111111", companyId: "company-a" },
  { id: "22222222-2222-4222-8222-222222222222", companyId: "company-a" },
  { id: "33333333-3333-4333-8333-333333333333", companyId: "company-b" },
];
const fakeDb: BenefitLookup = {
  companyBenefit: {
    async findMany({ where }) {
      return benefitRows
        .filter((b) => where.id.in.includes(b.id) && b.companyId === where.companyId)
        .map(({ id }) => ({ id }));
    },
  },
};
const [A1, A2, B1] = benefitRows.map((b) => b.id);
const MISSING = "44444444-4444-4444-8444-444444444444";

test("S9: valid own benefits are accepted (and de-duplicated)", async () => {
  assert.deepEqual(await validateBenefitOwnership(fakeDb, "company-a", [A1, A2, A1]), { ok: true, benefitIds: [A1, A2] });
});

test("S9: empty list is accepted (clears benefits)", async () => {
  assert.deepEqual(await validateBenefitOwnership(fakeDb, "company-a", []), { ok: true, benefitIds: [] });
});

test("S9: nonexistent benefit id is rejected", async () => {
  assert.deepEqual(await validateBenefitOwnership(fakeDb, "company-a", [MISSING]), { ok: false, invalidIds: [MISSING] });
});

test("S9: another company's benefit is rejected (cross-tenant)", async () => {
  assert.deepEqual(await validateBenefitOwnership(fakeDb, "company-a", [B1]), { ok: false, invalidIds: [B1] });
});

test("S9: mixed valid/invalid list is rejected as a whole", async () => {
  const r = await validateBenefitOwnership(fakeDb, "company-a", [A1, B1, MISSING]);
  assert.deepEqual(r, { ok: false, invalidIds: [B1, MISSING] });
});

test("S9: duplicates of a valid id do not mask an invalid one", async () => {
  const r = await validateBenefitOwnership(fakeDb, "company-a", [A1, A1, B1]);
  assert.equal(r.ok, false);
});

test("S9: company cannot mass-assign promotion flags or lifecycle timestamps", () => {
  const out = stripCompanyProtectedJobFields({
    title: "Agent",
    featured: true,
    highlight: true,
    publishedAt: new Date(0),
    closedAt: null,
  });
  assert.deepEqual(out, { title: "Agent" });
});

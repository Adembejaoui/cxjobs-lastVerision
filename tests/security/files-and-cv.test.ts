import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCvFile, checkImageFile, detectCvFormat } from "../../lib/security/file-type";
import {
  canAccessApplicationCv,
  cvPathOwner,
  extractCvObjectPath,
  normalizeOwnCvReference,
} from "../../lib/security/cv-access";

// ─── Additional issue B: content-based file validation ─────────────────

const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n1 0 obj<<>>endobj\n"), Buffer.alloc(200, 0x20), Buffer.from("\n%%EOF\n")]);
const docx = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.alloc(30),
  Buffer.from("[Content_Types].xml"),
  Buffer.alloc(30),
  Buffer.from("word/document.xml"),
]);
const xlsx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("[Content_Types].xml xl/workbook.xml")]);
const doc = Buffer.concat([
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  Buffer.alloc(100),
  Buffer.from("WordDocument", "utf16le"),
]);
const html = Buffer.from("<!doctype html><script>alert(document.cookie)</script>");
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

test("B: genuine PDF / DOCX / DOC are accepted with server-derived mime+extension", () => {
  assert.deepEqual(checkCvFile(pdf, "cv.pdf"), { ok: true, format: "pdf", mime: "application/pdf", extension: "pdf" });
  assert.equal(checkCvFile(docx, "cv.docx").ok, true);
  assert.equal(checkCvFile(doc, "cv.doc").ok, true);
  assert.equal(checkCvFile(pdf, "no-extension").ok, true);
});

test("B: HTML renamed to .pdf (fake extension) is rejected", () => {
  assert.equal(checkCvFile(html, "cv.pdf").ok, false);
});

test("B: real PDF with a dangerous extension is rejected (extension/content mismatch)", () => {
  assert.equal(checkCvFile(pdf, "cv.html").ok, false);
  assert.equal(checkCvFile(pdf, "cv.pdf.exe").ok, false);
});

test("B: truncated/malformed PDF (magic only, no %%EOF) is rejected", () => {
  assert.equal(detectCvFormat(Buffer.from("%PDF-1.4 garbage")), null);
});

test("B: generic ZIP / XLSX disguised as DOCX is rejected", () => {
  assert.equal(checkCvFile(xlsx, "cv.docx").ok, false);
  assert.equal(checkCvFile(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), "cv.docx").ok, false);
});

test("B: unsupported formats and images are rejected for CVs", () => {
  assert.equal(checkCvFile(png, "cv.png").ok, false);
  assert.equal(checkCvFile(Buffer.alloc(0), "cv.pdf").ok, false);
});

test("B: cv-parse PDF-only policy rejects DOCX even with a forged type", () => {
  assert.equal(checkCvFile(docx, "cv.pdf", ["pdf"]).ok, false);
});

test("B: image checks use bytes, not the declared type", () => {
  assert.equal(checkImageFile(png, "a.png", ["png", "jpeg"]).ok, true);
  assert.equal(checkImageFile(html, "a.png", ["png"]).ok, false);
  assert.equal(checkImageFile(png, "a.svg", ["png"]).ok, false);
});

// ─── S6: CV references and access policy ────────────────────────────────

const U1 = "0b8f5f3e-1111-4a8f-9a7e-000000000001";
const U2 = "0b8f5f3e-2222-4a8f-9a7e-000000000002";
const HOST = "proj.supabase.co";
const path1 = `${U1}/1700000000000-abc.pdf`;

test("S6: object paths are parsed with owner; traversal and junk are rejected", () => {
  assert.equal(cvPathOwner(path1), U1);
  for (const bad of [`${U1}/../${U2}/x.pdf`, `../${U1}/x.pdf`, `${U1}`, `x/${U1}.pdf`, `${U1}/a/b.pdf`]) {
    assert.equal(cvPathOwner(bad), null, bad);
  }
});

test("S6: legacy signed/public Supabase URLs map back to their object path", () => {
  assert.equal(extractCvObjectPath(`https://${HOST}/storage/v1/object/sign/cv/${path1}?token=abc`, HOST), path1);
  assert.equal(extractCvObjectPath(`https://${HOST}/storage/v1/object/public/cv/${path1}`, HOST), path1);
});

test("S6: URLs on other hosts, other buckets, or other schemes are rejected", () => {
  assert.equal(extractCvObjectPath(`https://evil.example/storage/v1/object/sign/cv/${path1}`, HOST), null);
  assert.equal(extractCvObjectPath(`https://${HOST}/storage/v1/object/public/avatars/${path1}`, HOST), null);
  assert.equal(extractCvObjectPath(`javascript:alert(1)`, HOST), null);
  assert.equal(extractCvObjectPath(`https://${HOST}/storage/v1/object/sign/cv/${path1}`, null), null);
});

test("S6: a candidate cannot point their profile at another candidate's CV", () => {
  assert.deepEqual(normalizeOwnCvReference(path1, U1, HOST), { ok: true, path: path1 });
  assert.deepEqual(normalizeOwnCvReference(path1, U2, HOST), { ok: false });
  assert.deepEqual(normalizeOwnCvReference("https://attacker.example/cv.pdf", U1, HOST), { ok: false });
  assert.deepEqual(normalizeOwnCvReference("", U1, HOST), { ok: true, path: null });
});

const ctx = { candidateUserId: U1, jobCompanyId: "company-a" };

test("S6: CV access — applicant, owning company and admin allowed", () => {
  assert.equal(canAccessApplicationCv({ role: "CANDIDATE", userId: U1 }, ctx), true);
  assert.equal(canAccessApplicationCv({ role: "COMPANY", userId: "co", companyId: "company-a" }, ctx), true);
  assert.equal(canAccessApplicationCv({ role: "ADMIN", userId: "adm" }, ctx), true);
});

test("S6: CV access — other candidates, unrelated companies, profile-less companies denied", () => {
  assert.equal(canAccessApplicationCv({ role: "CANDIDATE", userId: U2 }, ctx), false);
  assert.equal(canAccessApplicationCv({ role: "COMPANY", userId: "co-b", companyId: "company-b" }, ctx), false);
  assert.equal(canAccessApplicationCv({ role: "COMPANY", userId: "co-x", companyId: null }, ctx), false);
  assert.equal(canAccessApplicationCv({ role: "SOMETHING", userId: U1 }, ctx), false);
});

/**
 * Image upload pipeline on sharp >= 0.35.5 (libvips >= 8.18.3), through the
 * real /api/upload route: JPEG, PNG, GIF and WebP inputs are validated by
 * content, decoded by sharp, and re-encoded to the server-chosen format.
 */
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { installMocks, resetState, as, req, body, storage, IDS } from "./harness";

let upload: typeof import("@/app/api/upload/route");
before(async () => {
  installMocks();
  upload = await import("@/app/api/upload/route");
});
beforeEach(resetState);
after(() => setTimeout(() => process.exit(0), 50).unref());

const u8 = (b: Buffer) => new Uint8Array(b);

async function image(format: "jpeg" | "png" | "gif" | "webp", width: number, height: number): Promise<Buffer> {
  const base = sharp({ create: { width, height, channels: 3, background: { r: 30, g: 60, b: 120 } } });
  return base[format]().toBuffer();
}

function send(type: string, buf: Buffer, name: string, mime: string) {
  const fd = new FormData();
  fd.append("file", new Blob([u8(buf)], { type: mime }), name);
  return upload.POST(req(`/api/upload?type=${type}`, { method: "POST", body: fd }));
}

test("sharp: patched version is in use (libvips GIF/TIFF loader advisory)", () => {
  const [maj, min, patch] = sharp.versions.vips.split(".").map(Number);
  assert.ok(maj > 8 || (maj === 8 && (min > 18 || (min === 18 && patch >= 3))), `libvips ${sharp.versions.vips}`);
  const [smaj, smin, spatch] = (sharp.versions.sharp ?? "0.0.0").split(".").map(Number);
  assert.ok(smaj > 0 || smin > 35 || (smin === 35 && spatch >= 5), `sharp ${sharp.versions.sharp}`);
});

for (const [format, mime, ext] of [
  ["jpeg", "image/jpeg", "jpg"],
  ["png", "image/png", "png"],
  ["gif", "image/gif", "gif"],
  ["webp", "image/webp", "webp"],
] as const) {
  test(`avatar upload: ${format} is decoded and re-encoded to 400x400 WebP`, async () => {
    as("candidate");
    const res = await send("avatar", await image(format, 512, 512), `me.${ext}`, mime);
    assert.equal(res.status, 200, JSON.stringify(await body(res.clone())));
    const json = await body(res);
    assert.match(json.data.path, new RegExp(`^${IDS.candUser}/\\d+-[0-9a-f-]{36}\\.webp$`));
    const stored = storage.objects.get(`avatars/${json.data.path}`)!;
    assert.equal(stored.contentType, "image/webp");
    const meta = await sharp(stored.body).metadata();
    assert.equal(meta.format, "webp");
    assert.equal(meta.width, 400);
    assert.equal(meta.height, 400);
  });
}

test("logo upload: company PNG output at 500x500", async () => {
  as("companyA");
  const res = await send("logo", await image("jpeg", 600, 600), "logo.jpg", "image/jpeg");
  assert.equal(res.status, 200);
  const json = await body(res);
  const meta = await sharp(storage.objects.get(`logos/${json.data.path}`)!.body).metadata();
  assert.equal(meta.format, "png");
  assert.equal(meta.width, 500);
});

test("GIF is not accepted where the bucket policy excludes it (logo)", async () => {
  as("companyA");
  const res = await send("logo", await image("gif", 600, 600), "logo.gif", "image/gif");
  assert.equal(res.status, 400);
  assert.equal(storage.objects.size, 0);
});

test("corrupt GIF (valid magic, garbage body) is rejected without being stored", async () => {
  as("candidate");
  const corrupt = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(2048, 0xff)]);
  const res = await send("avatar", corrupt, "x.gif", "image/gif");
  assert.equal(res.status, 400);
  assert.equal(storage.objects.size, 0);
});

test("too-small image rejected by server-side dimension check", async () => {
  as("candidate");
  const res = await send("avatar", await image("png", 100, 100), "small.png", "image/png");
  assert.equal(res.status, 400);
});

test("SVG / TIFF / HEIF-style payloads never reach sharp (content-type gate)", async () => {
  as("candidate");
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');
  const tiff = await sharp({ create: { width: 500, height: 500, channels: 3, background: "#000" } }).tiff().toBuffer();
  for (const [buf, name, mime] of [
    [svg, "a.svg", "image/svg+xml"],
    [svg, "a.png", "image/png"],
    [tiff, "a.tiff", "image/tiff"],
    [tiff, "a.png", "image/png"],
  ] as const) {
    assert.equal((await send("avatar", buf, name, mime)).status, 400, name);
  }
  assert.equal(storage.objects.size, 0);
});

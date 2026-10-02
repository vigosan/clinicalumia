import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { LOGO_MAX_WIDTH_PX, shrinkLogo } from "./logo";

async function transparentPng(width: number, height: number) {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 200, g: 100, b: 50, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buffer);
}

async function jpeg(width: number, height: number) {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .jpeg()
    .toBuffer();
  return new Uint8Array(buffer);
}

describe("shrinkLogo", () => {
  it("narrows a wide PNG to the width the A4 invoice needs, so every PDF that embeds it stays light", async () => {
    const original = await transparentPng(3000, 1000);
    const shrunk = await shrinkLogo(original, "image/png");
    const meta = await sharp(shrunk).metadata();
    expect(meta.width).toBe(LOGO_MAX_WIDTH_PX);
    expect(meta.height).toBe(200);
    expect(shrunk.byteLength).toBeLessThan(original.byteLength);
  });

  it("keeps a PNG as PNG with its transparency, so the logo does not get a box behind it on the invoice", async () => {
    const shrunk = await shrinkLogo(
      await transparentPng(3000, 1000),
      "image/png",
    );
    const meta = await sharp(shrunk).metadata();
    expect(meta.format).toBe("png");
    expect(meta.hasAlpha).toBe(true);
  });

  it("keeps a JPEG as JPEG, because the PDF only embeds PNG and JPEG", async () => {
    const shrunk = await shrinkLogo(await jpeg(2400, 800), "image/jpeg");
    const meta = await sharp(shrunk).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(LOGO_MAX_WIDTH_PX);
  });

  it("leaves a logo that is already narrow enough untouched, so re-encoding never blurs it or makes it heavier", async () => {
    const original = await transparentPng(400, 150);
    expect(await shrinkLogo(original, "image/png")).toBe(original);
  });

  it("leaves an SVG untouched, since it is vector and rasterizing it would lose quality", async () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="1000"></svg>',
    );
    expect(await shrinkLogo(svg, "image/svg+xml")).toBe(svg);
  });

  it("rejects bytes that are not an image, so a broken file never reaches storage", async () => {
    await expect(
      shrinkLogo(new Uint8Array(100), "image/png"),
    ).rejects.toThrow();
  });
});

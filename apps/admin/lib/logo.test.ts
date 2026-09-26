import { describe, expect, it } from "vitest";
import { validateLogoFile } from "./logo";

function pngFile(sizeInBytes: number) {
  return new File([new Uint8Array(sizeInBytes)], "logo.png", {
    type: "image/png",
  });
}

describe("validateLogoFile", () => {
  it("accepts a PNG under 2 MB", () => {
    expect(validateLogoFile(pngFile(1024))).toEqual({ ok: true });
  });

  it("rejects a file larger than 2 MB, since a phone photo would otherwise crash the upload before this check runs on the server", () => {
    expect(validateLogoFile(pngFile(3 * 1024 * 1024))).toEqual({
      error: "El logo no puede pesar más de 2 MB.",
    });
  });

  it("rejects a file type outside PNG/JPEG/WebP/SVG", () => {
    const gif = new File([new Uint8Array(100)], "logo.gif", {
      type: "image/gif",
    });
    expect(validateLogoFile(gif)).toEqual({
      error: "El logo debe ser PNG, JPG, WebP o SVG.",
    });
  });
});

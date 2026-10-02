import { afterEach, describe, expect, it, vi } from "vitest";
import { clinicLogo } from "./clinic-logo";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const WEBP = new TextEncoder().encode("RIFF....WEBP");

function fakeSupabase(logoPath: string | null) {
  return {
    from: () => ({
      select: () => ({
        maybeSingle: async () => ({ data: { logo_path: logoPath } }),
      }),
    }),
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://storage.test/branding/${path}` },
        }),
      }),
    },
  } as unknown as Parameters<typeof clinicLogo>[0];
}

function serve(response: Response | Promise<never>) {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("clinicLogo", () => {
  it("returns nothing when the clinic has no logo, so the PDF falls back to the default one", async () => {
    const fetchMock = serve(new Response(PNG));
    expect(await clinicLogo(fakeSupabase(null))).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("downloads the logo from its public URL in the branding bucket", async () => {
    const fetchMock = serve(new Response(PNG));
    expect(await clinicLogo(fakeSupabase("logo-1.png"))).toEqual(PNG);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://storage.test/branding/logo-1.png",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("accepts a JPEG logo, since the PDF can embed it", async () => {
    serve(new Response(JPEG));
    expect(await clinicLogo(fakeSupabase("logo-1.jpg"))).toEqual(JPEG);
  });

  it("ignores a WebP or SVG logo, because the PDF renderer only embeds PNG and JPEG and would fail the whole invoice", async () => {
    serve(new Response(WEBP));
    expect(await clinicLogo(fakeSupabase("logo-1.webp"))).toBeUndefined();
  });

  it("ignores a logo the storage cannot serve, so a missing file never blocks the invoice", async () => {
    serve(new Response("not found", { status: 404 }));
    expect(await clinicLogo(fakeSupabase("logo-1.png"))).toBeUndefined();
  });

  it("ignores a logo download that fails or times out, so the invoice still renders", async () => {
    serve(Promise.reject(new Error("timeout")));
    expect(await clinicLogo(fakeSupabase("logo-1.png"))).toBeUndefined();
  });
});

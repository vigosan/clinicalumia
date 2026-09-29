import { afterEach, describe, expect, it, vi } from "vitest";

describe("site.url", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("falls back to the public domain when the variable is set but empty, so emailed links never lose their host", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const { site } = await import("./site");

    expect(site.url).toBe("https://www.clinicalumia.es");
  });

  it("uses the configured address when there is one", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const { site } = await import("./site");

    expect(site.url).toBe("http://localhost:3000");
  });
});

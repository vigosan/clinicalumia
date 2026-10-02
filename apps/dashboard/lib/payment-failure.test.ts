import { afterEach, describe, expect, it, vi } from "vitest";
import { adminUrl } from "./payment-failure";

describe("adminUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the configured admin address when there is one", () => {
    vi.stubEnv("ADMIN_URL", "https://admin.example.test");
    vi.stubEnv("NODE_ENV", "production");

    expect(adminUrl()).toBe("https://admin.example.test");
  });

  it("falls back to the public admin in production, so the owner's link never points to her own computer", () => {
    vi.stubEnv("ADMIN_URL", "");
    vi.stubEnv("NODE_ENV", "production");

    expect(adminUrl()).toBe("https://admin.clinicalumia.es");
  });

  it("points to the local admin in development, so links work on the developer's machine", () => {
    vi.stubEnv("ADMIN_URL", "");
    vi.stubEnv("NODE_ENV", "development");

    expect(adminUrl()).toBe("http://localhost:3002");
  });
});

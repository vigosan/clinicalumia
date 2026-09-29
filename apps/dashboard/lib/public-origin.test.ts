import { describe, expect, it } from "vitest";
import { publicOrigin } from "./public-origin";

describe("publicOrigin", () => {
  it("uses the host the visitor reached behind the proxy, so the link works outside the server", () => {
    const headers = new Headers({
      host: "internal:3001",
      "x-forwarded-host": "panel.clinicalumia.es",
      "x-forwarded-proto": "https",
    });

    expect(publicOrigin(headers)).toBe("https://panel.clinicalumia.es");
  });

  it("keeps only the first protocol when the proxy chain lists several", () => {
    const headers = new Headers({
      "x-forwarded-host": "panel.clinicalumia.es",
      "x-forwarded-proto": "https,http",
    });

    expect(publicOrigin(headers)).toBe("https://panel.clinicalumia.es");
  });

  it("serves plain http on localhost in development", () => {
    const headers = new Headers({ host: "localhost:3001" });

    expect(publicOrigin(headers)).toBe("http://localhost:3001");
  });

  it("assumes https for any other host, since the panel is only published over https", () => {
    const headers = new Headers({ host: "panel.clinicalumia.es" });

    expect(publicOrigin(headers)).toBe("https://panel.clinicalumia.es");
  });
});

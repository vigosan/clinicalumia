import { describe, expect, it } from "vitest";
import { currentTotp } from "./totp";

describe("currentTotp", () => {
  it("matches the RFC 6238 test vector for instant 59s", () => {
    expect(
      currentTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", new Date(59 * 1000)),
    ).toBe("287082");
  });

  it("gives the same code for two instants in the same 30s window", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(currentTotp(secret, new Date(1000))).toBe(
      currentTotp(secret, new Date(29 * 1000)),
    );
  });
});

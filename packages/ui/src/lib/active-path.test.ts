import { describe, expect, it } from "vitest";
import { isActivePath } from "./active-path";

describe("isActivePath", () => {
  it("marks a section active on its own page and on its sub-pages", () => {
    expect(isActivePath("/team", "/team")).toBe(true);
    expect(isActivePath("/team", "/team/123")).toBe(true);
  });

  it("does not mark Inicio active everywhere, only on the home page", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/", "/team")).toBe(false);
  });

  it("does not confuse sections that share a prefix", () => {
    expect(isActivePath("/team", "/teams")).toBe(false);
  });
});

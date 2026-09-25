import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("lets a caller override a component's default size with the app title size", () => {
    expect(cn("text-sm", "text-title")).toBe("text-title");
  });

  it("keeps a custom size and a text colour together, since they are different properties", () => {
    expect(cn("text-title", "text-sage-800")).toBe("text-title text-sage-800");
  });

  it("lets a caller override the card radius", () => {
    expect(cn("rounded-card", "rounded-field")).toBe("rounded-field");
  });
});

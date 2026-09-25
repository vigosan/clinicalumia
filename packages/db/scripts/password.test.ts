import { describe, expect, it } from "vitest";
import { validateOwnerPassword } from "./password";

describe("validateOwnerPassword", () => {
  it("accepts a password of at least 12 characters", () => {
    expect(validateOwnerPassword("lumia-segura-2026")).toBeNull();
  });

  it("rejects a password shorter than 12 characters, since it creates a real account", () => {
    expect(validateOwnerPassword("corta")).toBe(
      "La contraseña debe tener al menos 12 caracteres.",
    );
  });
});

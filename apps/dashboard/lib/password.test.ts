import { describe, expect, it } from "vitest";
import { validateNewPassword } from "./password";

describe("validateNewPassword", () => {
  it("accepts a long enough password typed twice", () => {
    expect(
      validateNewPassword("lumia-segura-2026", "lumia-segura-2026"),
    ).toBeNull();
  });

  it("rejects short passwords, since these accounts protect health data", () => {
    expect(validateNewPassword("corta", "corta")).toBe(
      "La contraseña debe tener al menos 12 caracteres.",
    );
  });

  it("rejects a confirmation that does not match, to avoid locking the user out", () => {
    expect(validateNewPassword("lumia-segura-2026", "lumia-segura-2027")).toBe(
      "Las contraseñas no coinciden.",
    );
  });
});

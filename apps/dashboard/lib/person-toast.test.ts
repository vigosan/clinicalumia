import { describe, expect, it } from "vitest";
import { newPersonToast } from "./person-toast";

describe("newPersonToast", () => {
  it("confirms a new record that goes straight to its page or back to Nueva cita", () => {
    expect(newPersonToast("/patients/p1")).toBe("Ficha creada");
    expect(newPersonToast("/appointments/new?date=2026-10-05&patient=p1")).toBe(
      "Ficha creada",
    );
  });

  it("names the guardian link when the record was created from «Nuevo tutor/a»", () => {
    expect(newPersonToast("/patients/minor-1", "minor-1")).toBe(
      "Tutor/a añadido/a",
    );
  });

  it("names the consent when the record was created from a consent", () => {
    expect(newPersonToast("/consentimientos/c1")).toBe(
      "Ficha creada y consentimiento asociado",
    );
  });

  it("only confirms the record when linking it afterwards failed, since the page shows that error", () => {
    expect(
      newPersonToast("/patients/minor-1?guardianError=primary", "minor-1"),
    ).toBe("Ficha creada");
    expect(newPersonToast("/consentimientos/c1?linkError=linked")).toBe(
      "Ficha creada",
    );
  });
});

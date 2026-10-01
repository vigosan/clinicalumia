import { describe, expect, it } from "vitest";
import { wardsLabel } from "./ward-label";

describe("wardsLabel", () => {
  it("returns an empty string for someone with no wards", () => {
    expect(wardsLabel([])).toBe("");
  });

  it("lists a mother's wards separated by commas, matching the seed's exact copy", () => {
    expect(
      wardsLabel([
        { name: "Nora Ferrer Martínez", relationship: "madre" },
        { name: "Pablo Ferrer Martínez", relationship: "madre" },
      ]),
    ).toBe("madre de Nora Ferrer Martínez, Pablo Ferrer Martínez");
  });

  it("uses the father wording for a padre, not the mother's", () => {
    expect(
      wardsLabel([{ name: "Iván Costa Bravo", relationship: "padre" }]),
    ).toBe("padre de Iván Costa Bravo");
  });

  it("uses the legal guardian wording for a tutor_legal", () => {
    expect(
      wardsLabel([{ name: "Sara López Vidal", relationship: "tutor_legal" }]),
    ).toBe("tutor legal de Sara López Vidal");
  });

  it("falls back to a generic wording for otro", () => {
    expect(wardsLabel([{ name: "Iris Roca Sanz", relationship: "otro" }])).toBe(
      "tutor/a de Iris Roca Sanz",
    );
  });

  it("joins two different relationships with y, keeping each group's own wording", () => {
    expect(
      wardsLabel([
        { name: "Nora Ferrer Martínez", relationship: "madre" },
        { name: "Iván Costa Bravo", relationship: "padre" },
      ]),
    ).toBe("madre de Nora Ferrer Martínez y padre de Iván Costa Bravo");
  });
});

import { describe, expect, it } from "vitest";
import { formatCents, parseEurosToCents } from "./money";

describe("parseEurosToCents", () => {
  it("understands prices typed the Spanish way", () => {
    expect(parseEurosToCents("45")).toBe(4500);
    expect(parseEurosToCents("45,5")).toBe(4550);
    expect(parseEurosToCents("45,50")).toBe(4550);
    expect(parseEurosToCents("1.234,00")).toBe(123400);
    expect(parseEurosToCents(" 45 € ")).toBe(4500);
  });

  it("also accepts a dot as decimal separator", () => {
    expect(parseEurosToCents("45.50")).toBe(4550);
  });

  it("rejects anything that is not an unambiguous positive amount, instead of saving a wrong price", () => {
    expect(parseEurosToCents("")).toBeNull();
    expect(parseEurosToCents("-5")).toBeNull();
    expect(parseEurosToCents("45,555")).toBeNull();
    expect(parseEurosToCents("cuarenta")).toBeNull();
  });
});

describe("formatCents", () => {
  it("shows amounts as the clinic writes them", () => {
    expect(formatCents(4550)).toBe("45,50 €");
    expect(formatCents(123400)).toBe("1234,00 €");
  });
});

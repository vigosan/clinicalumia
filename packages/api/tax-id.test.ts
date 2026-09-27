import { describe, expect, it } from "vitest";
import {
  isValidPersonalId,
  isValidSpanishTaxId,
  normalizeTaxId,
} from "./tax-id";

describe("Spanish tax ids", () => {
  it("normalises how people type them", () => {
    expect(normalizeTaxId(" 20.449.989-e ")).toBe("20449989E");
  });

  it("accepts a DNI whose control letter matches, like the clinic owner's", () => {
    expect(isValidSpanishTaxId("20449989E")).toBe(true);
    expect(isValidSpanishTaxId("20449989-e")).toBe(true);
  });

  it("rejects a DNI with the wrong letter, which would make invoices invalid", () => {
    expect(isValidSpanishTaxId("20449989A")).toBe(false);
  });

  it("accepts NIE (X/Y/Z) and company CIF numbers with a correct control character", () => {
    expect(isValidSpanishTaxId("X1234567L")).toBe(true);
    expect(isValidSpanishTaxId("B12345674")).toBe(true);
    expect(isValidSpanishTaxId("B12345675")).toBe(false);
  });

  it("rejects anything that is not a tax id", () => {
    expect(isValidSpanishTaxId("")).toBe(false);
    expect(isValidSpanishTaxId("1234")).toBe(false);
  });
});

describe("Spanish personal ids (DNI or NIE, never a CIF)", () => {
  it("accepts a DNI with the correct control letter", () => {
    expect(isValidPersonalId("20449989E")).toBe(true);
  });

  it("accepts a NIE with the correct control letter", () => {
    expect(isValidPersonalId("X1234567L")).toBe(true);
  });

  it("rejects a valid company CIF, since a company is not a person", () => {
    expect(isValidPersonalId("B12345674")).toBe(false);
  });

  it("rejects a DNI with the wrong control letter", () => {
    expect(isValidPersonalId("20449989A")).toBe(false);
  });
});

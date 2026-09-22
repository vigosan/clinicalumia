import { describe, expect, it } from "vitest";
import { parseConsent } from "./consent";

const signature = "data:image/png;base64,iVBORw0KGgo=";
const today = new Date("2026-09-22T12:00:00Z");

function form(overrides: Record<string, string | string[] | null> = {}) {
  const values: Record<string, string | string[] | null> = {
    firstName: "Ana",
    lastName: "García López",
    guardian: "",
    birthDate: "1990-05-10",
    dni: "12345678Z",
    email: "ana@example.com",
    source: ["Familiares o amigos"],
    privacy: "on",
    signature,
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === null) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      data.append(key, item);
    }
  }
  return data;
}

describe("parseConsent", () => {
  it("accepts a complete adult consent", () => {
    const result = parseConsent(form(), today);
    expect(result).toEqual({
      ok: true,
      consent: {
        firstName: "Ana",
        lastName: "García López",
        guardian: "",
        birthDate: "1990-05-10",
        dni: "12345678Z",
        email: "ana@example.com",
        sources: ["Familiares o amigos"],
        marketing: false,
        signature,
      },
    });
  });

  it("requires the identifying data that makes the consent attributable to a person", () => {
    for (const field of ["firstName", "lastName", "birthDate", "dni"]) {
      const result = parseConsent(form({ [field]: "  " }), today);
      expect(result).toHaveProperty("error");
    }
  });

  it("rejects a minor without a parent or guardian, since a minor cannot consent alone", () => {
    const minor = form({ birthDate: "2015-01-01", guardian: "" });
    expect(parseConsent(minor, today)).toEqual({
      error:
        "Si el paciente es menor, indica el nombre del padre, madre o tutor.",
    });
  });

  it("accepts a minor when a guardian signs on their behalf", () => {
    const minor = form({ birthDate: "2015-01-01", guardian: "Luis García" });
    expect(parseConsent(minor, today)).toHaveProperty("ok", true);
  });

  it("treats someone turning 18 today as an adult", () => {
    const result = parseConsent(form({ birthDate: "2008-09-22" }), today);
    expect(result).toHaveProperty("ok", true);
  });

  it("rejects a birth date in the future, which can only be a typo", () => {
    const result = parseConsent(form({ birthDate: "2030-01-01" }), today);
    expect(result).toHaveProperty("error");
  });

  it("never assumes marketing consent: it is opt-in only (RGPD)", () => {
    const withoutBox = parseConsent(form(), today);
    const withBox = parseConsent(form({ marketing: "on" }), today);
    expect(withoutBox).toHaveProperty("consent.marketing", false);
    expect(withBox).toHaveProperty("consent.marketing", true);
  });

  it("requires accepting the privacy policy", () => {
    const result = parseConsent(form({ privacy: null }), today);
    expect(result).toHaveProperty("error");
  });

  it("requires at least one answer about how the patient found us", () => {
    const result = parseConsent(form({ source: null }), today);
    expect(result).toHaveProperty("error");
  });

  it("requires a signature, because without it there is no consent", () => {
    expect(parseConsent(form({ signature: "" }), today)).toHaveProperty(
      "error",
    );
    expect(
      parseConsent(form({ signature: "not-an-image" }), today),
    ).toHaveProperty("error");
  });

  it("allows leaving the email empty but rejects a malformed one", () => {
    expect(parseConsent(form({ email: "" }), today)).toHaveProperty("ok", true);
    expect(parseConsent(form({ email: "ana@" }), today)).toHaveProperty(
      "error",
    );
  });

  it("normalises the DNI so the same person is always recorded the same way", () => {
    const result = parseConsent(form({ dni: " 12345678-z " }), today);
    expect(result).toHaveProperty("consent.dni", "12345678Z");
  });
});

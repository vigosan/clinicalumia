import { describe, expect, it } from "vitest";
import { checkPersonalId, consentFileName, parseConsent } from "./consent";

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
        guardianDni: "",
        email: "ana@example.com",
        sources: ["Familiares o amigos"],
        marketing: false,
        mediaForTraining: false,
        signature,
        signatureMethod: "drawn",
      },
    });
  });

  it("treats a form without a signature method as drawn, so a page opened before this change can still be signed", () => {
    const result = parseConsent(form({ signature_method: null }), today);
    expect(result).toHaveProperty("consent.signatureMethod", "drawn");
  });

  it("records that the signature was typed, so the PDF says how it was signed", () => {
    const result = parseConsent(form({ signature_method: "typed" }), today);
    expect(result).toHaveProperty("consent.signatureMethod", "typed");
  });

  it("rejects an unknown signature method instead of printing something the patient never chose", () => {
    const result = parseConsent(form({ signature_method: "stamped" }), today);
    expect(result).toEqual({ error: "La forma de firmar no es válida." });
  });

  it("asks for the signature when the typed name was left empty", () => {
    const result = parseConsent(
      form({ signature_method: "typed", signature: "" }),
      today,
    );
    expect(result).toEqual({ error: "Falta la firma." });
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

  it("accepts a minor when a guardian signs on their behalf with their own DNI", () => {
    const minor = form({
      birthDate: "2015-01-01",
      guardian: "Luis García",
      guardianDni: "X1234567L",
    });
    expect(parseConsent(minor, today)).toHaveProperty("ok", true);
  });

  it("keeps the minor's DNI and the guardian's DNI apart, so the guardian's never ends up as the child's", () => {
    const result = parseConsent(
      form({
        birthDate: "2015-01-01",
        guardian: "Luis García",
        dni: "",
        guardianDni: "x-1234567-l",
      }),
      today,
    );
    expect(result).toHaveProperty("consent.dni", "");
    expect(result).toHaveProperty("consent.guardianDni", "X1234567L");
  });

  it("asks for the guardian's DNI when the patient is a minor, because the guardian is who signs", () => {
    const minor = form({
      birthDate: "2015-01-01",
      guardian: "Luis García",
      guardianDni: "",
    });
    expect(parseConsent(minor, today)).toEqual({
      error:
        "Si el paciente es menor, indica el DNI/NIE del padre, madre o tutor.",
    });
  });

  it("ignores a guardian DNI on an adult's consent, since an adult signs for themselves", () => {
    const result = parseConsent(form({ guardianDni: "X1234567L" }), today);
    expect(result).toHaveProperty("consent.guardianDni", "");
  });

  it("ignores a guardian name typed by mistake on an adult's consent, so it is not taken for a minor's", () => {
    const result = parseConsent(form({ guardian: "Luis García" }), today);
    expect(result).toHaveProperty("consent.guardian", "");
  });

  it("stores an old DNI typed without its leading zero with the zero, so it matches the record", () => {
    const result = parseConsent(form({ dni: "1234567L" }), today);
    expect(result).toHaveProperty("consent.dni", "01234567L");
  });

  it("rejects a DNI with the wrong letter or without it, so the team does not have to chase a typo", () => {
    for (const dni of ["12345678A", "12345678", "X1234567A"]) {
      expect(parseConsent(form({ dni }), today)).toEqual({
        error:
          "El DNI/NIE del paciente no es válido. Revisa los números y la letra.",
      });
    }
  });

  it("rejects a guardian DNI with the wrong letter", () => {
    const minor = form({
      birthDate: "2015-01-01",
      guardian: "Luis García",
      guardianDni: "12345678A",
    });
    expect(parseConsent(minor, today)).toEqual({
      error:
        "El DNI/NIE del padre, madre o tutor no es válido. Revisa los números y la letra.",
    });
  });

  it("accepts what looks like a passport, because some patients have neither DNI nor NIE", () => {
    const result = parseConsent(form({ dni: "paa123456" }), today);
    expect(result).toHaveProperty("consent.dni", "PAA123456");
  });

  it("treats someone turning 18 today as an adult", () => {
    const result = parseConsent(form({ birthDate: "2008-09-22" }), today);
    expect(result).toHaveProperty("ok", true);
  });

  it("rejects a birth date in the future, which can only be a typo", () => {
    const result = parseConsent(form({ birthDate: "2030-01-01" }), today);
    expect(result).toHaveProperty("error");
  });

  it("rejects a day that does not exist in that month, instead of silently storing another date", () => {
    const result = parseConsent(form({ birthDate: "1990-02-30" }), today);
    expect(result).toEqual({
      error: "La fecha de nacimiento es obligatoria.",
    });
  });

  it("never assumes marketing consent: it is opt-in only (RGPD)", () => {
    const withoutBox = parseConsent(form(), today);
    const withBox = parseConsent(form({ marketing: "on" }), today);
    expect(withoutBox).toHaveProperty("consent.marketing", false);
    expect(withBox).toHaveProperty("consent.marketing", true);
  });

  it("never assumes consent to use images for research, talks or courses: it is a separate opt-in", () => {
    const withoutBox = parseConsent(form(), today);
    const withBox = parseConsent(form({ mediaForTraining: "on" }), today);
    expect(withoutBox).toHaveProperty("consent.mediaForTraining", false);
    expect(withBox).toHaveProperty("consent.mediaForTraining", true);
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

  it("drops the dots people often type in a DNI, so the clinic finds it the same way it finds people", () => {
    const result = parseConsent(form({ dni: "12.345.678-z" }), today);
    expect(result).toHaveProperty("consent.dni", "12345678Z");
  });

  it("normalises the DNI so the same person is always recorded the same way", () => {
    const result = parseConsent(form({ dni: " 12345678-z " }), today);
    expect(result).toHaveProperty("consent.dni", "12345678Z");
  });
});

describe("checkPersonalId", () => {
  it("accepts an old DNI written without its leading zero", () => {
    expect(checkPersonalId("1234567L")).toBe("valid");
  });

  it("recognises a valid DNI and NIE whatever the dots, dashes or case", () => {
    expect(checkPersonalId("12.345.678-z")).toBe("valid");
    expect(checkPersonalId("x1234567l")).toBe("valid");
  });

  it("flags a DNI or NIE whose letter does not match or is missing as invalid", () => {
    expect(checkPersonalId("12345678A")).toBe("invalid");
    expect(checkPersonalId("12345678")).toBe("invalid");
    expect(checkPersonalId("Y1234567")).toBe("invalid");
  });

  it("treats other letters and digits as a passport, which only deserves a soft warning", () => {
    expect(checkPersonalId("PAA123456")).toBe("passport");
    expect(checkPersonalId("AB1234567")).toBe("passport");
  });

  it("rejects symbols or lengths no identity document has", () => {
    expect(checkPersonalId("12<script>")).toBe("invalid");
    expect(checkPersonalId("AB1")).toBe("invalid");
    expect(checkPersonalId("")).toBe("empty");
  });
});

describe("consentFileName", () => {
  const signedAt = new Date("2026-09-22T10:30:00Z");

  it("names the attachment after the patient's DNI and the date, so the clinic can file it", () => {
    expect(consentFileName({ dni: "12345678Z" }, signedAt)).toBe(
      "consentimiento-12345678Z-2026-09-22.pdf",
    );
  });

  it("keeps only letters and digits from the identifier, so a typed value cannot shape the file name", () => {
    expect(consentFileName({ dni: "../A<b>1" }, signedAt)).toBe(
      "consentimiento-Ab1-2026-09-22.pdf",
    );
  });

  it("still gives a name when a minor has no DNI", () => {
    expect(consentFileName({ dni: "" }, signedAt)).toBe(
      "consentimiento-2026-09-22.pdf",
    );
  });
});

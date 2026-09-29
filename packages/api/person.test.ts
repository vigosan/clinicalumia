import { describe, expect, it } from "vitest";
import {
  ageOn,
  isMinor,
  normalizePhone,
  normalizeSearch,
  parsePersonForm,
  toIlikePattern,
} from "./person";

function form(values: Record<string, string>) {
  const data = new FormData();
  const defaults: Record<string, string> = {
    first_name: "Ana",
    last_name: "García",
    birth_date: "2000-01-01",
    tax_id: "",
    email: "",
    phone: "",
    address: "",
    admin_notes: "",
    is_patient: "on",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...values })) {
    data.set(key, value);
  }
  return data;
}

describe("normalizePhone", () => {
  it("returns null when there are no digits, like the database rule", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("+")).toBeNull();
    expect(normalizePhone(" - ")).toBeNull();
  });

  it("keeps only the 9 digits of a Spanish number written with a country prefix", () => {
    expect(normalizePhone("(+34) 614.55.28.08")).toBe("614552808");
  });

  it("collapses a doubled leading plus the same way the database does", () => {
    expect(normalizePhone("++34 614 55 28 08")).toBe("614552808");
  });

  it("keeps the country prefix for other international numbers", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
  });
});

describe("normalizeSearch", () => {
  it("lowercases and strips accents so 'García' matches 'garcia'", () => {
    expect(normalizeSearch("García")).toBe("garcia");
  });

  it("normalizes a partial phone number by dropping the space", () => {
    expect(normalizeSearch("614 55")).toBe("61455");
  });

  it("trims surrounding spaces from a plain name", () => {
    expect(normalizeSearch("  Ana  ")).toBe("ana");
  });

  it("strips the dash from a dni typed as digits-dash-letter, so it matches the stored dni", () => {
    expect(normalizeSearch("11223344-B")).toBe("11223344b");
  });

  it("strips the dots from a dni typed with dot separators", () => {
    expect(normalizeSearch("11.223.344")).toBe("11223344");
  });

  it("treats a +34-prefixed fragment as a phone search, dropping the country code like the stored phone does", () => {
    expect(normalizeSearch("+34 600")).toBe("600");
  });
});

describe("toIlikePattern", () => {
  it("wraps a normal query with wildcards", () => {
    expect(toIlikePattern("martinez")).toBe("%martinez%");
  });

  it("escapes a literal % so it isn't treated as a wildcard", () => {
    expect(toIlikePattern("100%")).toBe("%100\\%%");
  });

  it("escapes a literal _ so it isn't treated as a single-character wildcard", () => {
    expect(toIlikePattern("a_b")).toBe("%a\\_b%");
  });

  it("escapes a literal backslash before escaping % and _, so a query ending in \\ can't unescape the wildcards it's followed by", () => {
    expect(toIlikePattern("a\\b")).toBe("%a\\\\b%");
    expect(toIlikePattern("\\%")).toBe(`%${"\\".repeat(3)}%%`);
  });
});

describe("ageOn / isMinor", () => {
  it("is still a minor the day before the 18th birthday", () => {
    expect(ageOn("2008-06-15", "2026-06-14")).toBe(17);
    expect(isMinor("2008-06-15", "2026-06-14")).toBe(true);
  });

  it("is no longer a minor on the 18th birthday itself", () => {
    expect(ageOn("2008-06-15", "2026-06-15")).toBe(18);
    expect(isMinor("2008-06-15", "2026-06-15")).toBe(false);
  });

  it("treats a February 29 birthday as turning a year older on March 1 in non-leap years", () => {
    expect(ageOn("2008-02-29", "2025-02-28")).toBe(16);
    expect(ageOn("2008-02-29", "2025-03-01")).toBe(17);
  });
});

describe("parsePersonForm", () => {
  it("requires a first name", () => {
    expect(parsePersonForm(form({ first_name: "" }), "2026-09-27")).toEqual({
      error: "El nombre es obligatorio.",
    });
  });

  it("requires a last name", () => {
    expect(parsePersonForm(form({ last_name: "" }), "2026-09-27")).toEqual({
      error: "Los apellidos son obligatorios.",
    });
  });

  it("requires a birth date for a patient, since age drives the rest of the record", () => {
    expect(parsePersonForm(form({ birth_date: "" }), "2026-09-27")).toEqual({
      error: "La fecha de nacimiento es obligatoria para un paciente.",
    });
  });

  it("rejects a birth date in the future", () => {
    expect(
      parsePersonForm(form({ birth_date: "2026-09-28" }), "2026-09-27"),
    ).toEqual({
      error: "La fecha de nacimiento no puede ser futura.",
    });
  });

  it("rejects a DNI whose check letter is wrong", () => {
    expect(
      parsePersonForm(form({ tax_id: "12345678A" }), "2026-09-27"),
    ).toEqual({
      error: "El DNI/NIE no es válido. Revisa la letra.",
    });
  });

  it("rejects a valid company CIF, since a person must be a DNI or NIE", () => {
    expect(
      parsePersonForm(form({ tax_id: "B12345674" }), "2026-09-27"),
    ).toEqual({
      error: "El DNI/NIE no es válido. Revisa la letra.",
    });
  });

  it("treats a DNI made only of separators as empty, like the database's nullif", () => {
    expect(
      parsePersonForm(form({ tax_id: " . - " }), "2026-09-27"),
    ).toHaveProperty("person.tax_id", null);
  });

  it("rejects an email without an at sign", () => {
    expect(
      parsePersonForm(form({ email: "ana-arroba-nada.com" }), "2026-09-27"),
    ).toEqual({
      error: "El email no es válido.",
    });
  });

  it("rejects a phone with fewer than 9 digits, as the database would reject it too", () => {
    expect(parsePersonForm(form({ phone: "123456" }), "2026-09-27")).toEqual({
      error: "El teléfono no es válido.",
    });
  });

  it("accepts an international phone with at least 8 digits after the plus sign", () => {
    expect(
      parsePersonForm(form({ phone: "+44 20 7946 0958" }), "2026-09-27"),
    ).toHaveProperty("person.phone", "+442079460958");
  });

  it("rejects an international phone with fewer than 8 digits after the plus sign", () => {
    expect(parsePersonForm(form({ phone: "+1 234567" }), "2026-09-27")).toEqual(
      {
        error: "El teléfono no es válido.",
      },
    );
  });

  it("allows a guardian, who is not a patient, without a birth date", () => {
    expect(
      parsePersonForm(
        form({ is_patient: "off", birth_date: "" }),
        "2026-09-27",
      ),
    ).toEqual({
      ok: true,
      person: {
        first_name: "Ana",
        last_name: "García",
        birth_date: null,
        tax_id: null,
        email: null,
        phone: null,
        address: "",
        admin_notes: "",
        is_patient: false,
      },
    });
  });

  it("normalizes the DNI, email and phone in the parsed output", () => {
    expect(
      parsePersonForm(
        form({
          tax_id: "12345678z",
          email: "  Ana@Example.com ",
          phone: "614 55 28 08",
        }),
        "2026-09-27",
      ),
    ).toEqual({
      ok: true,
      person: {
        first_name: "Ana",
        last_name: "García",
        birth_date: "2000-01-01",
        tax_id: "12345678Z",
        email: "ana@example.com",
        phone: "614552808",
        address: "",
        admin_notes: "",
        is_patient: true,
      },
    });
  });
});

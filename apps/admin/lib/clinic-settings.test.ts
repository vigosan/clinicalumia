import { describe, expect, it } from "vitest";
import { parseClinicSettings } from "./clinic-settings";

function form(values: Record<string, string>) {
  const data = new FormData();
  const defaults: Record<string, string> = {
    legal_name: "Patricia Hernán Sánchez",
    tax_id: "20449989E",
    address_line: "Calle Montesa 7",
    postal_code: "46800",
    city: "Xàtiva",
    province: "Valencia",
    phone: "614 552 808",
    email: "info@clinicalumia.es",
    website: "https://www.clinicalumia.es",
    vat_exemption_text:
      "Operación exenta de IVA según el artículo 20.Uno.3º de la Ley 37/1992, del Impuesto sobre el Valor Añadido.",
    invoice_footer: "",
    invoice_prefix: "",
    rectifying_prefix: "R",
    cancellation_hours: "24",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...values })) {
    data.set(key, value);
  }
  return data;
}

describe("parseClinicSettings", () => {
  it("turns the form into settings with a normalized NIF and a numeric cancellation window", () => {
    const result = parseClinicSettings(form({ tax_id: "20.449.989-e" }));
    expect(result).toEqual({
      ok: true,
      settings: {
        legal_name: "Patricia Hernán Sánchez",
        tax_id: "20449989E",
        address_line: "Calle Montesa 7",
        postal_code: "46800",
        city: "Xàtiva",
        province: "Valencia",
        phone: "614 552 808",
        email: "info@clinicalumia.es",
        website: "https://www.clinicalumia.es",
        vat_exemption_text:
          "Operación exenta de IVA según el artículo 20.Uno.3º de la Ley 37/1992, del Impuesto sobre el Valor Añadido.",
        invoice_footer: "",
        invoice_prefix: "",
        rectifying_prefix: "R",
        cancellation_hours: 24,
      },
    });
  });

  it("rejects an invalid NIF/CIF so invoices don't carry a wrong tax id", () => {
    expect(parseClinicSettings(form({ tax_id: "20449989A" }))).toEqual({
      error: "El NIF/CIF no es válido. Revisa la letra o el dígito de control.",
    });
  });

  it("rejects an invalid email so appointment notifications don't bounce", () => {
    expect(parseClinicSettings(form({ email: "no-es-un-email" }))).toEqual({
      error: "El email no es válido.",
    });
  });

  it("requires a 5-digit postal code", () => {
    expect(parseClinicSettings(form({ postal_code: "4680" }))).toEqual({
      error: "El código postal debe tener 5 cifras.",
    });
  });

  it("keeps the general cancellation window within 0-720 hours", () => {
    expect(parseClinicSettings(form({ cancellation_hours: "800" }))).toEqual({
      error: "El plazo de cancelación debe estar entre 0 y 720 horas.",
    });
  });

  it("requires an explicit cancellation window instead of defaulting an empty field to zero, since zero means no free cancellation", () => {
    expect(parseClinicSettings(form({ cancellation_hours: "" }))).toEqual({
      error: "Indica el plazo de cancelación gratuita.",
    });
  });

  it("requires the legal name or owner's name, since invoices need it", () => {
    expect(parseClinicSettings(form({ legal_name: " " }))).toEqual({
      error: "La razón social o nombre del titular es obligatorio.",
    });
  });

  it("accepts an empty website and completes one missing https:// with it", () => {
    expect(parseClinicSettings(form({ website: "" }))).toHaveProperty(
      "settings.website",
      "",
    );
    expect(
      parseClinicSettings(form({ website: "www.clinicalumia.es" })),
    ).toHaveProperty("settings.website", "https://www.clinicalumia.es");
  });
});

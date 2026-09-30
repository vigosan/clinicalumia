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
    cancellation_hours: "24",
    booking_min_notice_hours: "24",
    booking_horizon_days: "60",
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
        cancellation_hours: 24,
        booking_min_notice_hours: 24,
        booking_horizon_days: 60,
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

  it("keeps the minimum notice within 0-168 hours, since patients cannot book further ahead than a week's worth of hours", () => {
    expect(
      parseClinicSettings(form({ booking_min_notice_hours: "200" })),
    ).toEqual({
      error: "La antelación mínima debe estar entre 0 y 168 horas.",
    });
  });

  it("requires an explicit minimum notice instead of defaulting an empty field to zero", () => {
    expect(parseClinicSettings(form({ booking_min_notice_hours: "" }))).toEqual(
      {
        error: "Indica la antelación mínima.",
      },
    );
  });

  it("keeps the booking horizon within 1-365 days", () => {
    expect(parseClinicSettings(form({ booking_horizon_days: "400" }))).toEqual({
      error: "El horizonte de reserva debe estar entre 1 y 365 días.",
    });
  });

  it("requires an explicit booking horizon instead of defaulting an empty field to zero, since zero would leave nothing to book", () => {
    expect(parseClinicSettings(form({ booking_horizon_days: "" }))).toEqual({
      error: "Indica el horizonte de reserva.",
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

  it("doesn't double the protocol when the website already has http:// or https://, in any case", () => {
    expect(
      parseClinicSettings(form({ website: "http://www.clinicalumia.es" })),
    ).toHaveProperty("settings.website", "http://www.clinicalumia.es");
    expect(
      parseClinicSettings(form({ website: "HTTPS://www.clinicalumia.es" })),
    ).toHaveProperty("settings.website", "HTTPS://www.clinicalumia.es");
  });
});

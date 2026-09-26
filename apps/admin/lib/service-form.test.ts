import { describe, expect, it } from "vitest";
import { parseServiceForm } from "./service-form";

function form(values: Record<string, string>) {
  const data = new FormData();
  const defaults: Record<string, string> = {
    specialty_id: "spec-1",
    name: "Sesión individual",
    duration_minutes: "60",
    price: "45,00",
    vat: "exempt",
    booking_payment: "none",
    booking_payment_value: "",
    cancellation_hours: "",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...values })) {
    data.set(key, value);
  }
  return data;
}

describe("parseServiceForm", () => {
  it("turns the form into a service with the price in cents", () => {
    const result = parseServiceForm(form({ bookable_online: "on" }));
    expect(result).toEqual({
      ok: true,
      service: {
        specialty_id: "spec-1",
        name: "Sesión individual",
        duration_minutes: 60,
        price_cents: 4500,
        vat: "exempt",
        bookable_online: true,
        booking_payment: "none",
        booking_payment_value: 0,
        cancellation_hours: null,
      },
    });
  });

  it("stores a fixed deposit in cents and refuses one above the price", () => {
    expect(
      parseServiceForm(
        form({ booking_payment: "fixed", booking_payment_value: "10" }),
      ),
    ).toHaveProperty("service.booking_payment_value", 1000);
    expect(
      parseServiceForm(
        form({ booking_payment: "fixed", booking_payment_value: "50" }),
      ),
    ).toEqual({
      error: "La señal no puede ser mayor que el precio.",
    });
  });

  it("requires a percentage between 1 and 100", () => {
    expect(
      parseServiceForm(
        form({ booking_payment: "percent", booking_payment_value: "20" }),
      ),
    ).toHaveProperty("service.booking_payment_value", 20);
    expect(
      parseServiceForm(
        form({ booking_payment: "percent", booking_payment_value: "0" }),
      ),
    ).toEqual({
      error: "El porcentaje debe estar entre 1 y 100.",
    });
  });

  it("ignores any deposit value when nothing or the full price is paid at booking", () => {
    expect(
      parseServiceForm(
        form({ booking_payment: "full", booking_payment_value: "99" }),
      ),
    ).toHaveProperty("service.booking_payment_value", 0);
  });

  it("keeps a per-service cancellation window only when it is filled in", () => {
    expect(parseServiceForm(form({ cancellation_hours: "48" }))).toHaveProperty(
      "service.cancellation_hours",
      48,
    );
    expect(parseServiceForm(form({ cancellation_hours: "800" }))).toEqual({
      error: "El plazo de cancelación debe estar entre 0 y 720 horas.",
    });
  });

  it("rejects missing or invalid basics with a clear message", () => {
    expect(parseServiceForm(form({ name: " " }))).toEqual({
      error: "El nombre es obligatorio.",
    });
    expect(parseServiceForm(form({ specialty_id: "" }))).toEqual({
      error: "Elige una especialidad.",
    });
    expect(parseServiceForm(form({ duration_minutes: "0" }))).toEqual({
      error: "La duración debe estar entre 5 y 480 minutos.",
    });
    expect(parseServiceForm(form({ price: "cuarenta" }))).toEqual({
      error: "El precio no es válido. Escríbelo como 45 o 45,50.",
    });
    expect(parseServiceForm(form({ vat: "10" }))).toEqual({
      error: "Elige el tratamiento de IVA.",
    });
  });
});

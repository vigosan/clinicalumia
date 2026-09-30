import { madridInstant } from "@clinicalumia/api/madrid-time";
import { describe, expect, it } from "vitest";
import {
  canVoidPayment,
  formatEuros,
  methodLabel,
  needsPaymentNote,
  parseAmount,
  paymentError,
  paymentHistoryLines,
  paymentStatus,
} from "./payments";

describe("parseAmount", () => {
  it("reads a plain integer as whole euros", () => {
    expect(parseAmount("45")).toEqual({ cents: 4500 });
  });

  it("reads a comma with one decimal as tenths of a euro", () => {
    expect(parseAmount("45,5")).toEqual({ cents: 4550 });
  });

  it("reads a comma with two decimals", () => {
    expect(parseAmount("45,50")).toEqual({ cents: 4550 });
  });

  it("accepts a dot as the decimal separator too", () => {
    expect(parseAmount("45.50")).toEqual({ cents: 4550 });
  });

  it("accepts a euro sign and surrounding spaces", () => {
    expect(parseAmount(" 45,50 € ")).toEqual({ cents: 4550 });
    expect(parseAmount("€45")).toEqual({ cents: 4500 });
  });

  it("reads a dot as a thousands separator when followed by exactly three digits and a comma decimal", () => {
    expect(parseAmount("1.000,00")).toEqual({ cents: 100000 });
  });

  it("reads a dot as a thousands separator when followed by exactly three digits and no decimal part", () => {
    expect(parseAmount("1.000")).toEqual({ cents: 100000 });
  });

  it("rejects an empty amount instead of silently defaulting to zero", () => {
    expect(parseAmount("")).toEqual({ error: "Escribe un importe válido." });
  });

  it("rejects a negative amount", () => {
    expect(parseAmount("-3")).toEqual({ error: "Escribe un importe válido." });
  });

  it("rejects text that isn't a number", () => {
    expect(parseAmount("abc")).toEqual({ error: "Escribe un importe válido." });
  });

  it("rejects more than two decimals", () => {
    expect(parseAmount("45,555")).toEqual({
      error: "Escribe un importe válido.",
    });
  });

  it("rejects an amount above the 100.000,00 € limit", () => {
    expect(parseAmount("100000,01")).toEqual({
      error: "Escribe un importe válido.",
    });
  });

  it("accepts an amount right at the 100.000,00 € limit", () => {
    expect(parseAmount("100000,00")).toEqual({ cents: 10000000 });
  });

  it("accepts a free service written as zero", () => {
    expect(parseAmount("0")).toEqual({ cents: 0 });
  });
});

describe("formatEuros", () => {
  it("formats cents as Spanish euros with a comma decimal", () => {
    expect(formatEuros(4500)).toBe("45,00 €");
  });

  it("pads a single cent digit", () => {
    expect(formatEuros(4505)).toBe("45,05 €");
  });
});

describe("methodLabel", () => {
  it("labels each payment method in Spanish", () => {
    expect(methodLabel("cash")).toBe("Efectivo");
    expect(methodLabel("card")).toBe("Tarjeta");
    expect(methodLabel("bizum")).toBe("Bizum");
    expect(methodLabel("transfer")).toBe("Transferencia");
  });
});

describe("paymentStatus", () => {
  const scheduled = {
    starts_at: "2026-09-30T10:00:00Z",
    status: "scheduled" as const,
  };
  const now = new Date("2026-09-30T12:00:00Z");

  it("shows the amount and method when an active payment exists", () => {
    expect(
      paymentStatus({
        appointment: scheduled,
        payment: { amount_cents: 4500, method: "cash", note: "" },
        now,
      }),
    ).toEqual({ kind: "paid", label: "Pagada · Efectivo · 45,00 €" });
  });

  it("shows the reason instead of an amount for a free service", () => {
    expect(
      paymentStatus({
        appointment: scheduled,
        payment: { amount_cents: 0, method: "cash", note: "Revisión gratuita" },
        now,
      }),
    ).toEqual({ kind: "free", label: "Sin cobro · Revisión gratuita" });
  });

  it("says pending when the appointment already started and has no payment", () => {
    expect(
      paymentStatus({ appointment: scheduled, payment: null, now }),
    ).toEqual({ kind: "pending", label: "Pendiente de cobro" });
  });

  it("shows nothing for an appointment that hasn't started yet, so staff aren't nagged to collect early", () => {
    const future = {
      starts_at: "2026-10-01T10:00:00Z",
      status: "scheduled" as const,
    };
    expect(paymentStatus({ appointment: future, payment: null, now })).toEqual({
      kind: "future",
      label: "",
    });
  });

  it("says pending for a no-show without payment, since a missed session can still be charged", () => {
    const noShow = {
      starts_at: scheduled.starts_at,
      status: "no_show" as const,
    };
    expect(paymentStatus({ appointment: noShow, payment: null, now })).toEqual({
      kind: "pending",
      label: "Pendiente de cobro",
    });
  });

  it("shows nothing for a cancelled appointment with no payment, instead of nagging staff to collect a cancelled visit", () => {
    const cancelled = {
      starts_at: scheduled.starts_at,
      status: "cancelled" as const,
    };
    expect(
      paymentStatus({ appointment: cancelled, payment: null, now }),
    ).toEqual({ kind: "none", label: "" });
  });
});

describe("paymentHistoryLines", () => {
  const nameById = new Map([
    ["staff-1", "Laura Ejemplo"],
    ["staff-2", "Patricia"],
  ]);

  it("describes an active payment with the amount, method, collector and Madrid time", () => {
    const lines = paymentHistoryLines(
      {
        amount_cents: 4500,
        method: "cash",
        collected_at: "2026-09-28T08:12:00Z",
        collected_by: "staff-1",
        voided_at: null,
        voided_by: null,
        void_reason: "",
      },
      nameById,
    );
    expect(lines).toEqual([
      "Cobrada · 45,00 € · Efectivo por Laura Ejemplo el 28/09 a las 10:12",
    ]);
  });

  it("adds a second line for the void, naming who anulled it and why", () => {
    const lines = paymentHistoryLines(
      {
        amount_cents: 4500,
        method: "cash",
        collected_at: "2026-09-28T08:12:00Z",
        collected_by: "staff-1",
        voided_at: "2026-09-28T09:00:00Z",
        voided_by: "staff-2",
        void_reason: "Importe duplicado",
      },
      nameById,
    );
    expect(lines).toEqual([
      "Cobrada · 45,00 € · Efectivo por Laura Ejemplo el 28/09 a las 10:12",
      "Cobro anulado · Importe duplicado por Patricia el 28/09 a las 11:00",
    ]);
  });

  it("keeps the correct Madrid day for a payment collected at 23:30 on the clock-change night", () => {
    const collectedAt = madridInstant("2026-10-25", "23:30");
    const lines = paymentHistoryLines(
      {
        amount_cents: 4500,
        method: "card",
        collected_at: collectedAt,
        collected_by: "staff-1",
        voided_at: null,
        voided_by: null,
        void_reason: "",
      },
      nameById,
    );
    expect(lines).toEqual([
      "Cobrada · 45,00 € · Tarjeta por Laura Ejemplo el 25/10 a las 23:30",
    ]);
  });
});

describe("needsPaymentNote", () => {
  const base = {
    cancelled: false,
    amount: "55,00",
    suggestedAmountCents: 5500,
    error: null,
  };

  it("asks for no reason when charging exactly what is proposed", () => {
    expect(needsPaymentNote(base)).toBe(false);
  });

  it("asks for a reason when the amount differs from the proposal", () => {
    expect(needsPaymentNote({ ...base, amount: "50" })).toBe(true);
  });

  it("asks for a reason when charging a cancelled appointment", () => {
    expect(needsPaymentNote({ ...base, cancelled: true })).toBe(true);
  });

  it("asks for a reason when the database says one is required, since the proposal on screen may be out of date and otherwise there would be nowhere to type it", () => {
    expect(
      needsPaymentNote({
        ...base,
        error: paymentError({ code: "P0001", message: "note_required" }),
      }),
    ).toBe(true);
  });

  it("does not ask for a reason because of an unrelated error", () => {
    expect(
      needsPaymentNote({
        ...base,
        error: paymentError({ code: "P0001", message: "already_paid" }),
      }),
    ).toBe(false);
  });
});

describe("paymentError", () => {
  it("tells the person who charges that the clinic's fiscal data is missing, because without it no invoice can be issued and the charge is refused", () => {
    expect(
      paymentError({ code: "P0001", message: "clinic_fiscal_data_missing" }),
    ).toBe(
      "Faltan los datos fiscales de la clínica (razón social y NIF). Pide a la propietaria que los complete en el admin.",
    );
  });

  it("tells the person who charges that the invoice numbering is not confirmed yet, because issuing before that could repeat a number of the clinic's spreadsheet", () => {
    expect(
      paymentError({ code: "P0001", message: "invoice_series_not_configured" }),
    ).toBe(
      "Falta configurar la numeración de facturas. Pide a la propietaria que la complete en el admin (Datos de la clínica → Facturación).",
    );
  });

  it("explains that a charge over 400 € cannot get a simplified invoice, so the person knows who can solve it", () => {
    expect(
      paymentError({ code: "P0001", message: "full_invoice_required" }),
    ).toBe(
      "Este importe supera los 400 € de una factura simplificada. Habla con la propietaria para emitir la factura completa.",
    );
  });

  it("explains each invoice refusal in words the staff can act on", () => {
    expect(
      paymentError({ code: "P0001", message: "invoice_already_rectified" }),
    ).toBe("Esta factura ya está rectificada.");
    expect(
      paymentError({ code: "P0001", message: "invoice_already_replaced" }),
    ).toBe("Esta factura ya tiene factura completa.");
    expect(
      paymentError({ code: "P0001", message: "recipient_tax_id_invalid" }),
    ).toBe(
      "Escribe un DNI, NIE o CIF válido. Otros documentos (pasaporte, NIF extranjero) no se admiten todavía.",
    );
    expect(paymentError({ code: "P0001", message: "recipient_invalid" })).toBe(
      "Completa nombre, NIF, dirección, código postal y ciudad.",
    );
    expect(
      paymentError({ code: "P0001", message: "clinic_tax_id_changed" }),
    ).toBe(
      "El NIF de la clínica ha cambiado desde la factura original. Consulta con la gestoría.",
    );
    expect(paymentError({ code: "P0001", message: "invoice_not_found" })).toBe(
      "Esta factura ya no está disponible.",
    );
  });

  it("says the appointment is no longer available when it was deleted or belongs to someone else, instead of a vague save failure", () => {
    expect(
      paymentError({ code: "P0001", message: "appointment_not_found" }),
    ).toBe("Esta cita ya no está disponible.");
  });

  it("says the payment is no longer available when it cannot be found, instead of a vague save failure", () => {
    expect(paymentError({ code: "P0001", message: "payment_not_found" })).toBe(
      "Este cobro ya no está disponible.",
    );
  });

  it("maps each known code to its Spanish message", () => {
    expect(paymentError({ code: "P0001", message: "already_paid" })).toBe(
      "Esta cita ya está cobrada.",
    );
    expect(paymentError({ code: "P0001", message: "note_required" })).toBe(
      "Indica el motivo del cambio de importe.",
    );
    expect(
      paymentError({
        code: "P0001",
        message: "appointment_cancelled_needs_note",
      }),
    ).toBe("Indica por qué se cobra una cita cancelada.");
    expect(
      paymentError({ code: "P0001", message: "appointment_not_started" }),
    ).toBe("Todavía no se puede cobrar esta cita.");
    expect(paymentError({ code: "P0001", message: "invalid_amount" })).toBe(
      "Escribe un importe válido.",
    );
    expect(paymentError({ code: "P0001", message: "invalid_method" })).toBe(
      "Elige la forma de pago.",
    );
    expect(paymentError({ code: "P0001", message: "reason_required" })).toBe(
      "Indica el motivo de la anulación.",
    );
    expect(paymentError({ code: "P0001", message: "not_allowed" })).toBe(
      "Solo puede anular este cobro quien lo registró hoy o la propietaria.",
    );
    expect(paymentError({ code: "P0001", message: "already_voided" })).toBe(
      "Este cobro ya está anulado.",
    );
  });

  it("ignores a message that looks like a known code when it doesn't come from our own raise, so a foreign error isn't shown as a payment rule", () => {
    expect(paymentError({ code: "23505", message: "already_paid" })).toBe(
      "No se ha podido guardar. Inténtalo de nuevo.",
    );
  });

  it("gives the forbidden message for a 42501 no matter the underlying message", () => {
    expect(paymentError({ code: "42501", message: "payment_forbidden" })).toBe(
      "No tienes permiso para hacer esto.",
    );
  });

  it("falls back to a generic retry message for anything unrecognised", () => {
    expect(paymentError({ code: "P0001", message: "something_new" })).toBe(
      "No se ha podido guardar. Inténtalo de nuevo.",
    );
    expect(paymentError({})).toBe(
      "No se ha podido guardar. Inténtalo de nuevo.",
    );
  });
});

describe("canVoidPayment", () => {
  const payment = {
    collected_by: "staff-1",
    collected_at: madridInstant("2026-09-30", "09:00"),
  };

  it("lets whoever collected it undo a mistake the same Madrid day", () => {
    expect(
      canVoidPayment({
        payment,
        userId: "staff-1",
        isOwner: false,
        now: new Date(madridInstant("2026-09-30", "23:59")),
      }),
    ).toBe(true);
  });

  it("stops the collector the next Madrid day, so closed cash can't be changed quietly", () => {
    expect(
      canVoidPayment({
        payment,
        userId: "staff-1",
        isOwner: false,
        now: new Date(madridInstant("2026-10-01", "00:01")),
      }),
    ).toBe(false);
  });

  it("stops a colleague from voiding someone else's payment", () => {
    expect(
      canVoidPayment({
        payment,
        userId: "staff-2",
        isOwner: false,
        now: new Date(madridInstant("2026-09-30", "10:00")),
      }),
    ).toBe(false);
  });

  it("always lets the owner void, whoever collected it and whenever", () => {
    expect(
      canVoidPayment({
        payment,
        userId: "owner-1",
        isOwner: true,
        now: new Date(madridInstant("2026-11-15", "10:00")),
      }),
    ).toBe(true);
  });
});

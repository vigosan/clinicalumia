import { describe, expect, it } from "vitest";
import {
  formatEuros,
  formatMadridDate,
  formatSessionDate,
  invoiceFileName,
  paymentSummary,
} from "./format";

describe("invoiceFileName", () => {
  it("turns the code into a safe file name, because a slash would create a folder on download", () => {
    expect(invoiceFileName("34/26")).toBe("factura-34-26.pdf");
    expect(invoiceFileName("R1/26")).toBe("factura-R1-26.pdf");
  });
});

describe("formatEuros", () => {
  it("uses the Spanish decimal comma and a minus sign for rectifying amounts", () => {
    expect(formatEuros(4500)).toBe("45,00 €");
    expect(formatEuros(-6050)).toBe("-60,50 €");
  });
});

describe("formatMadridDate", () => {
  it("prints the day the invoice was issued in Madrid, not in UTC", () => {
    expect(formatMadridDate("2026-12-31T23:30:00Z")).toBe("01/01/2027");
    expect(formatMadridDate("2026-09-30T10:15:00+02:00")).toBe("30/09/2026");
  });
});

describe("formatSessionDate", () => {
  it("prints the stored calendar day without shifting it through a time zone", () => {
    expect(formatSessionDate("2026-09-29")).toBe("29/09/2026");
  });
});

describe("paymentSummary", () => {
  it("names the single payment method in plain Spanish", () => {
    expect(paymentSummary([{ method: "card", amount_cents: 4500 }])).toBe(
      "Pagado con tarjeta",
    );
    expect(paymentSummary([{ method: "cash", amount_cents: 4500 }])).toBe(
      "Pagado en efectivo",
    );
    expect(paymentSummary([{ method: "bizum", amount_cents: 4500 }])).toBe(
      "Pagado por Bizum",
    );
    expect(paymentSummary([{ method: "transfer", amount_cents: 4500 }])).toBe(
      "Pagado por transferencia",
    );
  });

  it("details each amount when an online deposit covered part of the session", () => {
    expect(
      paymentSummary([
        { method: "online", amount_cents: 1000 },
        { method: "card", amount_cents: 3500 },
      ]),
    ).toBe("Pagado: señal online 10,00 € · tarjeta 35,00 €");
  });

  it("prints nothing when no payment is recorded, such as a free session", () => {
    expect(paymentSummary(null)).toBe("");
    expect(paymentSummary([])).toBe("");
  });
});

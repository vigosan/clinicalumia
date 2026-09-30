import { describe, expect, it } from "vitest";
import {
  formatInvoiceCode,
  invoiceSeriesError,
  invoiceSetupWarnings,
  parseInvoiceSeries,
} from "./invoice-series";

describe("formatInvoiceCode", () => {
  it("continues the clinic's spreadsheet numbering, number then two-digit year", () => {
    expect(formatInvoiceCode("{n}/{aa}", 2026, 34)).toBe("34/26");
  });

  it("marks rectifying invoices with an R so they are never confused with the main series", () => {
    expect(formatInvoiceCode("R{n}/{aa}", 2026, 1)).toBe("R1/26");
  });

  it("pads the number to a fixed width when the format asks for it", () => {
    expect(formatInvoiceCode("F{año}-{n:4}", 2026, 7)).toBe("F2026-0007");
  });

  it("never truncates a number wider than its configured padding, so two invoices can't collide", () => {
    expect(formatInvoiceCode("F{año}-{n:4}", 2026, 12345)).toBe("F2026-12345");
  });

  it("returns nothing for a non-integer or zero number, since there is no invoice to preview yet", () => {
    expect(formatInvoiceCode("{n}/{aa}", 2026, 0)).toBe("");
    expect(formatInvoiceCode("{n}/{aa}", 2026, Number.NaN)).toBe("");
  });
});

describe("parseInvoiceSeries", () => {
  function form(values: Record<string, string>) {
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.set(key, value);
    return data;
  }

  it("reads the series code, format, year and next number from the form", () => {
    expect(
      parseInvoiceSeries(
        form({
          code: "main",
          format: "{n}/{aa}",
          year: "2026",
          next_number: "35",
        }),
      ),
    ).toEqual({
      ok: true,
      series: { code: "main", format: "{n}/{aa}", year: 2026, next_number: 35 },
    });
  });

  it("rejects a code that isn't main or rectifying", () => {
    expect(
      parseInvoiceSeries(
        form({
          code: "other",
          format: "{n}/{aa}",
          year: "2026",
          next_number: "1",
        }),
      ),
    ).toEqual({ error: "Serie no válida." });
  });

  it("requires a format", () => {
    expect(
      parseInvoiceSeries(
        form({ code: "main", format: "  ", year: "2026", next_number: "1" }),
      ),
    ).toEqual({ error: "Indica el formato de la numeración." });
  });

  it("requires a year within a sane range", () => {
    expect(
      parseInvoiceSeries(
        form({
          code: "main",
          format: "{n}/{aa}",
          year: "1999",
          next_number: "1",
        }),
      ),
    ).toEqual({ error: "Indica un año válido." });
  });

  it("requires a next number of at least 1", () => {
    expect(
      parseInvoiceSeries(
        form({
          code: "main",
          format: "{n}/{aa}",
          year: "2026",
          next_number: "0",
        }),
      ),
    ).toEqual({ error: "El siguiente número debe ser 1 o mayor." });
  });
});

describe("invoiceSeriesError", () => {
  it("names the year that is already locked, so the owner knows which one she can't touch", () => {
    expect(
      invoiceSeriesError({ code: "P0001", message: "series_locked" }, 2026),
    ).toBe("La numeración de 2026 ya está en uso y no se puede cambiar.");
  });

  it("explains a rejected format instead of surfacing a database error", () => {
    expect(
      invoiceSeriesError({ code: "P0001", message: "format_invalid" }, 2026),
    ).toBe("El formato de la numeración no es válido.");
  });

  it("explains a rejected starting number", () => {
    expect(
      invoiceSeriesError({ code: "P0001", message: "number_invalid" }, 2026),
    ).toBe("El siguiente número debe ser 1 o mayor.");
  });

  it("tells a non-owner she lacks permission", () => {
    expect(invoiceSeriesError({ code: "42501" }, 2026)).toBe(
      "No tienes permiso para hacer esto.",
    );
  });

  it("falls back to a generic message for anything else", () => {
    expect(invoiceSeriesError({ code: "500" }, 2026)).toBe(
      "No se ha podido guardar la numeración.",
    );
  });
});

describe("invoiceSetupWarnings", () => {
  const settings = {
    legal_name: "Patricia Hernán Sánchez",
    tax_id: "20449989E",
  };

  it("says nothing when the clinic can already issue invoices", () => {
    expect(
      invoiceSetupWarnings({
        settings,
        mainSeries: { configured: true },
        year: 2026,
      }),
    ).toEqual([]);
  });

  it("warns that charges are refused until the owner confirms this year's numbering, so the first invoice never repeats a spreadsheet number", () => {
    expect(
      invoiceSetupWarnings({
        settings,
        mainSeries: { configured: false },
        year: 2026,
      }),
    ).toEqual([
      {
        id: "invoice-series-warning",
        text: "Confirma la numeración de facturas de 2026 en Facturación: hasta que la guardes, no se pueden registrar cobros.",
      },
    ]);
    expect(
      invoiceSetupWarnings({ settings, mainSeries: undefined, year: 2026 }),
    ).toHaveLength(1);
  });

  it("warns about the missing legal name or tax id, without which no invoice can be issued", () => {
    expect(
      invoiceSetupWarnings({
        settings: { legal_name: " ", tax_id: "20449989E" },
        mainSeries: { configured: true },
        year: 2026,
      }),
    ).toEqual([
      {
        id: "clinic-fiscal-warning",
        text: "Faltan la razón social o el NIF: sin estos datos no se pueden emitir facturas ni registrar cobros.",
      },
    ]);
  });
});

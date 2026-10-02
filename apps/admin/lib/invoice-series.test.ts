import { describe, expect, it } from "vitest";
import {
  effectiveSeries,
  formatInvoiceCode,
  invoiceFormatProblem,
  invoiceSeriesError,
  invoiceSetupWarnings,
  parseInvoiceSeries,
  seriesYearSummary,
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

  it("explains that both series cannot produce the same codes, since two invoices would share a number", () => {
    expect(
      invoiceSeriesError({ code: "P0001", message: "format_conflict" }, 2026),
    ).toBe(
      "Ese formato puede dar los mismos códigos que la otra serie. Usa una letra que las distinga, como R{n}/{aa}.",
    );
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

const confirmed = [
  { code: "main" as const, year: 2026, configured: true },
  { code: "rectifying" as const, year: 2026, configured: true },
];

describe("invoiceSetupWarnings", () => {
  const settings = {
    legal_name: "Patricia Hernán Sánchez",
    tax_id: "20449989E",
    address_line: "Calle Montesa 7",
    postal_code: "46800",
    city: "Xàtiva",
  };

  it("says nothing when the clinic can already issue invoices", () => {
    expect(
      invoiceSetupWarnings({
        settings,
        series: confirmed,
        year: 2026,
      }),
    ).toEqual([]);
  });

  it("warns that charges are refused until the owner confirms this year's numbering, so the first invoice never repeats a spreadsheet number", () => {
    expect(
      invoiceSetupWarnings({
        settings,
        series: [
          { code: "main", year: 2026, configured: false },
          confirmed[1]!,
        ],
        year: 2026,
      }),
    ).toEqual([
      {
        id: "invoice-series-warning",
        text: "Confirma la numeración de facturas de 2026 en Datos de la clínica → Facturación: hasta que la guardes, no se pueden registrar cobros.",
      },
    ]);
  });

  it("warns when the rectifying numbering is not confirmed, because voiding an invoiced charge needs a rectifying invoice", () => {
    expect(
      invoiceSetupWarnings({
        settings,
        series: [
          confirmed[0]!,
          { code: "rectifying", year: 2026, configured: false },
        ],
        year: 2026,
      }),
    ).toEqual([
      {
        id: "invoice-series-rectifying-warning",
        text: "Falta confirmar la numeración de las rectificativas: sin ella no se pueden anular cobros facturados.",
      },
    ]);
  });

  it("does not warn on 1 January, because a new year without its own row inherits the previous year's confirmation and invoicing keeps working", () => {
    expect(
      invoiceSetupWarnings({ settings, series: confirmed, year: 2027 }),
    ).toEqual([]);
  });

  it("still warns in a new year when the previous year was never confirmed, since the new row inherits that too", () => {
    expect(
      invoiceSetupWarnings({
        settings,
        series: [
          { code: "main", year: 2026, configured: false },
          confirmed[1]!,
        ],
        year: 2027,
      }).map((warning) => warning.text),
    ).toEqual([
      "Confirma la numeración de facturas de 2027 en Datos de la clínica → Facturación: hasta que la guardes, no se pueden registrar cobros.",
    ]);
  });

  it("warns about the missing legal name or tax id, without which no invoice can be issued", () => {
    expect(
      invoiceSetupWarnings({
        settings: { ...settings, legal_name: " " },
        series: confirmed,
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

describe("invoiceSetupWarnings address", () => {
  it("warns that full and rectifying invoices need the clinic's full address, so voiding an invoiced charge would fail without it", () => {
    for (const missing of ["address_line", "postal_code", "city"]) {
      expect(
        invoiceSetupWarnings({
          settings: {
            legal_name: "Patricia Hernán Sánchez",
            tax_id: "20449989E",
            address_line: "Calle Montesa 7",
            postal_code: "46800",
            city: "Xàtiva",
            [missing]: "",
          },
          series: confirmed,
          year: 2026,
        }),
      ).toEqual([
        {
          id: "clinic-address-warning",
          text: "Falta la dirección completa (dirección, código postal y ciudad): sin ella no se pueden emitir facturas completas ni rectificativas, ni anular cobros facturados.",
        },
      ]);
    }
  });
});

describe("seriesYearSummary", () => {
  it("shows the next code of a year in use, so the owner sees where the numbering goes", () => {
    expect(
      seriesYearSummary(2026, {
        format: "{n}/{aa}",
        next_number: 34,
        locked: true,
        configured: true,
      }),
    ).toBe("2026: próxima 34/26 · en uso");
  });

  it("marks a saved year that has not issued anything yet as confirmed", () => {
    expect(
      seriesYearSummary(2027, {
        format: "{n}/{aa}",
        next_number: 1,
        locked: false,
        configured: true,
      }),
    ).toBe("2027: próxima 1/27 · confirmada");
  });

  it("marks an unconfirmed year, since charges are refused until it is saved", () => {
    expect(
      seriesYearSummary(2026, {
        format: "{n}/{aa}",
        next_number: 1,
        locked: false,
        configured: false,
      }),
    ).toBe("2026: próxima 1/26 · sin confirmar");
  });

  it("explains that a year without its own row continues the previous format from 1", () => {
    expect(seriesYearSummary(2027, undefined)).toBe(
      "2027: seguirá el formato de 2026, empezando en 1",
    );
  });
});

describe("invoiceFormatProblem", () => {
  it("accepts the clinic's formats, so the owner can save them", () => {
    expect(invoiceFormatProblem("{n}/{aa}", "R{n}/{aa}", 2026)).toBeNull();
    expect(invoiceFormatProblem("F{año}-{n:4}", null, 2026)).toBeNull();
  });

  it("names the missing year, since the database refuses a format without it", () => {
    expect(invoiceFormatProblem("F-{n}", null, 2026)).toBe(
      "Falta el año ({aa} o {año}).",
    );
  });

  it("names the missing number, or the extra one, since each invoice needs exactly one", () => {
    expect(invoiceFormatProblem("F{aa}", null, 2026)).toBe(
      "Falta el número ({n} o {n:4}).",
    );
    expect(invoiceFormatProblem("{n}-{n:2}/{aa}", null, 2026)).toBe(
      "Solo puede haber un número ({n} o {n:4}).",
    );
  });

  it("rejects unknown markers and paddings outside 1 to 8, as the database does", () => {
    for (const format of ["{x}/{n}/{aa}", "{n:0}/{aa}", "{n:9}/{aa}"]) {
      expect(invoiceFormatProblem(format, null, 2026)).toBe(
        "Solo se admiten {n}, {n:1} a {n:8}, {aa} y {año}.",
      );
    }
  });

  it("rejects characters the codes cannot carry", () => {
    expect(invoiceFormatProblem("{n}#{aa}", null, 2026)).toBe(
      "Usa solo letras, números y los signos / _ . -",
    );
  });

  it("rejects a format longer than 30 characters", () => {
    expect(invoiceFormatProblem(`${"a".repeat(31)}{n}{aa}`, null, 2026)).toBe(
      "El formato no puede pasar de 30 caracteres.",
    );
  });

  it("asks for a format when the field is empty", () => {
    expect(invoiceFormatProblem("  ", null, 2026)).toBe("Escribe el formato.");
  });

  it("refuses a format that can give the other series' codes, so no two invoices share a code", () => {
    const conflict =
      "Da los mismos códigos que la otra serie. Usa una letra que las distinga, como R{n}/{aa}.";
    expect(invoiceFormatProblem("{n}/{aa}", "{n}/{aa}", 2026)).toBe(conflict);
    expect(invoiceFormatProblem("{n:3}/{aa}", "{n}/{aa}", 2026)).toBe(conflict);
    expect(invoiceFormatProblem("F{año}-9{n}", "F{año}-{n:4}", 2026)).toBe(
      conflict,
    );
    expect(invoiceFormatProblem("{n}/{año}", "{n}/{aa}", 2026)).toBeNull();
  });
});

describe("effectiveSeries", () => {
  it("uses the latest row up to the year, which is the one numbering will copy, and ignores later years", () => {
    const rows = [
      { year: 2025, format: "{n}/{aa}" },
      { year: 2026, format: "F{n}/{aa}" },
      { year: 2028, format: "G{n}/{aa}" },
    ];
    expect(effectiveSeries(rows, 2027)?.format).toBe("F{n}/{aa}");
    expect(effectiveSeries(rows, 2026)?.format).toBe("F{n}/{aa}");
    expect(effectiveSeries(rows, 2024)).toBeUndefined();
  });
});

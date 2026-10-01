import type { InvoiceSnapshot } from "@clinicalumia/invoices";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { ledgerXlsx } from "./ledger-xlsx";
import {
  ledgerRows,
  type QuarterInvoice,
  summarizeInvoices,
} from "./quarter-summary";

type Line = InvoiceSnapshot["lines"][number];

function line(overrides: Partial<Line> = {}): Line {
  return {
    description: "Psicoterapia individual",
    session_date: "2026-08-10",
    patient: "María L.",
    quantity: 1,
    base_cents: 5500,
    vat_rate: 0,
    vat_cents: 0,
    total_cents: 5500,
    ...overrides,
  };
}

function snapshot(overrides: Partial<InvoiceSnapshot> = {}): InvoiceSnapshot {
  return {
    issuer: {
      name: "Patricia Hernán Sánchez",
      tax_id: "20449989E",
      address_line: "Calle Montesa 7",
      postal_code: "46800",
      city: "Xàtiva",
      province: "Valencia",
      phone: "",
      email: "",
      website: "",
    },
    recipient: null,
    lines: [line()],
    totals: { base_cents: 5500, vat_cents: 0, total_cents: 5500 },
    vat: "exempt",
    vat_note: "Exenta de IVA (art. 20.Uno.3.º LIVA)",
    payments: [{ method: "card", amount_cents: 5500 }],
    footer: "",
    ...overrides,
  };
}

const RATE_21 = line({
  description: "Informe psicológico no sanitario",
  base_cents: 7438,
  vat_rate: 21,
  vat_cents: 1562,
  total_cents: 9000,
});

const invoices: QuarterInvoice[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    code: "1/26",
    kind: "simplified",
    status: "replaced",
    issued_at: "2026-07-02T10:00:00+02:00",
    replaces: null,
    rectifies: null,
    replaced_by: "2/26",
    snapshot: snapshot(),
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    code: "2/26",
    kind: "full",
    status: "issued",
    issued_at: "2026-07-03T10:00:00+02:00",
    replaces: "1/26",
    rectifies: null,
    replaced_by: null,
    snapshot: snapshot({
      recipient: {
        name: "Empresa Cliente SL",
        tax_id: "B12345674",
        address: "Calle Mayor 1",
        postal_code: "46001",
        city: "Valencia",
      },
    }),
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    code: "3/26",
    kind: "simplified",
    status: "issued",
    issued_at: "2026-08-14T18:30:00+02:00",
    replaces: null,
    rectifies: null,
    replaced_by: null,
    snapshot: snapshot({
      lines: [line(), RATE_21],
      totals: { base_cents: 12938, vat_cents: 1562, total_cents: 14500 },
      payments: [
        { method: "online", amount_cents: 1000 },
        { method: "cash", amount_cents: 13500 },
      ],
    }),
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    code: "R1/26",
    kind: "rectifying",
    status: "issued",
    issued_at: "2026-09-30T23:30:00+02:00",
    replaces: null,
    rectifies: "3/26",
    replaced_by: null,
    snapshot: snapshot({
      lines: [
        line({ base_cents: -5500, total_cents: -5500 }),
        line({
          ...RATE_21,
          base_cents: -7438,
          vat_cents: -1562,
          total_cents: -9000,
        }),
      ],
      totals: { base_cents: -12938, vat_cents: -1562, total_cents: -14500 },
    }),
  },
];

const HEADERS = [
  "Fecha",
  "Número",
  "Tipo",
  "Sustituye a / Rectifica a",
  "Estado",
  "Cliente",
  "NIF",
  "Concepto",
  "Base",
  "% IVA",
  "Cuota IVA",
  "Total",
  "Suma en totales",
  "Exención",
  "Forma de pago",
];

const EUROS = "#,##0.00 €";

async function readBack(bytes: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
  return workbook;
}

function rowValues(sheet: ExcelJS.Worksheet, rowNumber: number): unknown[] {
  const values = sheet.getRow(rowNumber).values as unknown[];
  return values.slice(1);
}

function rowByLabel(sheet: ExcelJS.Worksheet, label: string): ExcelJS.Row {
  let found: ExcelJS.Row | undefined;
  sheet.eachRow((row) => {
    if (row.getCell(1).value === label) found = row;
  });
  if (!found) throw new Error(`No hay fila «${label}» en ${sheet.name}`);
  return found;
}

describe("ledgerXlsx", () => {
  it("has the two sheets the gestoría expects, «Facturas» then «Resumen»", async () => {
    const workbook = await readBack(
      await ledgerXlsx({ year: 2026, q: 3, invoices }),
    );
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Facturas",
      "Resumen",
    ]);
  });

  it("lists every ledger row under the spec's column headers, replaced and replacing invoices included", async () => {
    const workbook = await readBack(
      await ledgerXlsx({ year: 2026, q: 3, invoices }),
    );
    const sheet = workbook.getWorksheet("Facturas")!;
    expect(rowValues(sheet, 1)).toEqual(HEADERS);
    const expected = ledgerRows(invoices);
    expect(sheet.rowCount).toBe(expected.length + 1);
    expected.forEach((row, index) => {
      const values = rowValues(sheet, index + 2);
      expect(values.slice(1, 8)).toEqual([
        row.code,
        row.type,
        row.related,
        row.status,
        row.client,
        row.taxId,
        row.concept,
      ]);
      expect(values.slice(8, 12)).toEqual([
        row.base_cents / 100,
        row.vat_rate,
        row.vat_cents / 100,
        row.total_cents / 100,
      ]);
      expect(values.slice(12)).toEqual([
        row.inTotals ? "Sí" : "No",
        row.exemption,
        row.paymentMethod,
      ]);
    });
  });

  it("marks the full invoice that replaces a simplified one as not adding up, so summing «Total» over the «Sí» rows gives the net", async () => {
    const workbook = await readBack(
      await ledgerXlsx({ year: 2026, q: 3, invoices }),
    );
    const sheet = workbook.getWorksheet("Facturas")!;
    const marks: Record<string, unknown> = {};
    let summed = 0;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      marks[`${row.getCell(2).value}`] = row.getCell(13).value;
      if (row.getCell(13).value === "Sí")
        summed += row.getCell(12).value as number;
    });
    expect(marks).toEqual({
      "1/26": "Sí",
      "2/26": "No",
      "3/26": "Sí",
      "R1/26": "Sí",
    });
    expect(summed).toBeCloseTo(summarizeInvoices(invoices).net_cents / 100, 2);
  });

  it("writes amounts as real numbers in euros, so the gestoría can add them up in Excel", async () => {
    const workbook = await readBack(
      await ledgerXlsx({ year: 2026, q: 3, invoices }),
    );
    const sheet = workbook.getWorksheet("Facturas")!;
    const rectifying = sheet.getRow(sheet.rowCount);
    expect(rectifying.getCell(2).value).toBe("R1/26");
    expect(rectifying.getCell(12).value).toBe(-90);
    for (const column of [9, 11, 12]) {
      expect(rectifying.getCell(column).numFmt).toBe(EUROS);
    }
  });

  it("writes the Madrid issue date as a real date shown dd/mm/aaaa, so a 23:30 invoice on 30/09 stays in September", async () => {
    const workbook = await readBack(
      await ledgerXlsx({ year: 2026, q: 3, invoices }),
    );
    const sheet = workbook.getWorksheet("Facturas")!;
    const cell = sheet.getRow(sheet.rowCount).getCell(1);
    expect(cell.value).toEqual(new Date(Date.UTC(2026, 8, 30)));
    expect(cell.numFmt).toBe("dd/mm/yyyy");
  });

  it("summarises the quarter with the same counts and totals as the screen", async () => {
    const workbook = await readBack(
      await ledgerXlsx({ year: 2026, q: 3, invoices }),
    );
    const sheet = workbook.getWorksheet("Resumen")!;
    const summary = summarizeInvoices(invoices);

    expect(rowByLabel(sheet, "Trimestre").getCell(2).value).toBe("T3 2026");
    expect(rowByLabel(sheet, "Emisor").getCell(2).value).toBe(
      "Patricia Hernán Sánchez",
    );
    expect(rowByLabel(sheet, "NIF").getCell(2).value).toBe("20449989E");
    expect(rowByLabel(sheet, "Simplificadas").getCell(2).value).toBe(
      summary.counts.simplified,
    );
    expect(rowByLabel(sheet, "Completas").getCell(2).value).toBe(
      summary.counts.full,
    );
    expect(rowByLabel(sheet, "Rectificativas").getCell(2).value).toBe(
      summary.counts.rectifying,
    );
    expect(rowByLabel(sheet, "Sustituidas").getCell(2).value).toBe(
      summary.counts.replaced,
    );
    expect(rowByLabel(sheet, "IVA").values).toEqual([
      undefined,
      "IVA",
      "Base",
      "Cuota IVA",
      "Total",
    ]);
    expect(rowByLabel(sheet, "Exento").values).toEqual([
      undefined,
      "Exento",
      55,
      0,
      55,
    ]);
    expect(rowByLabel(sheet, "IVA 21 %").values).toEqual([
      undefined,
      "IVA 21 %",
      0,
      0,
      0,
    ]);
    const net = rowByLabel(sheet, "Total neto");
    expect(net.getCell(4).value).toBe(summary.net_cents / 100);
    expect(net.getCell(4).value).toBe(55);
    expect(net.getCell(4).numFmt).toBe(EUROS);
    expect(rowByLabel(sheet, "Nota").getCell(2).value).toBe(
      "Las rectificativas restan. Una completa que sustituye a una simplificada aparece en el libro pero no suma: ya cuenta la simplificada original.",
    );
  });

  it("still produces a readable workbook for a quarter without invoices", async () => {
    const workbook = await readBack(
      await ledgerXlsx({ year: 2026, q: 4, invoices: [] }),
    );
    expect(workbook.getWorksheet("Facturas")!.rowCount).toBe(1);
    expect(
      rowByLabel(workbook.getWorksheet("Resumen")!, "Total neto").getCell(4)
        .value,
    ).toBe(0);
  });
});

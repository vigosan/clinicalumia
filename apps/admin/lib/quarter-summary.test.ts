import type { InvoiceSnapshot } from "@clinicalumia/invoices";
import { describe, expect, it } from "vitest";
import {
  exportFileName,
  ledgerRows,
  pdfFileName,
  type QuarterInvoice,
  summarizeInvoices,
} from "./quarter-summary";

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
    lines: [
      {
        description: "Sesión de fisioterapia",
        session_date: "2026-08-10",
        patient: "María López",
        quantity: 1,
        base_cents: 5000,
        vat_rate: 21,
        vat_cents: 1050,
        total_cents: 6050,
      },
    ],
    totals: { base_cents: 5000, vat_cents: 1050, total_cents: 6050 },
    vat: "standard_21",
    vat_note: "",
    payments: [{ method: "cash", amount_cents: 6050 }],
    footer: "",
    ...overrides,
  };
}

function invoice(overrides: Partial<QuarterInvoice> = {}): QuarterInvoice {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    code: "1/26",
    kind: "simplified",
    status: "issued",
    issued_at: "2026-08-10T10:00:00+02:00",
    replaces: null,
    rectifies: null,
    replaced_by: null,
    snapshot: snapshot(),
    ...overrides,
  };
}

describe("summarizeInvoices", () => {
  it("counts each invoice once, as a simplified, full, rectifying or replaced one", () => {
    const invoices = [
      invoice({ id: "1", code: "1/26", kind: "simplified" }),
      invoice({ id: "2", code: "2/26", kind: "full", replaces: "1/26" }),
      invoice({
        id: "3",
        code: "R1/26",
        kind: "rectifying",
        rectifies: "2/26",
      }),
    ];
    expect(summarizeInvoices(invoices).counts).toEqual({
      simplified: 1,
      full: 1,
      rectifying: 1,
      replaced: 0,
    });
  });

  it("no duplica el importe de una simplificada sustituida: solo suma la factura completa que la sustituye", () => {
    const replacedSimplified = invoice({
      id: "1",
      code: "1/26",
      kind: "simplified",
      status: "replaced",
      replaced_by: "2/26",
      snapshot: snapshot({
        lines: [
          {
            description: "Sesión de fisioterapia",
            session_date: "2026-08-10",
            patient: "María López",
            quantity: 1,
            base_cents: 5000,
            vat_rate: 21,
            vat_cents: 1050,
            total_cents: 6050,
          },
        ],
      }),
    });
    const full = invoice({
      id: "2",
      code: "2/26",
      kind: "full",
      replaces: "1/26",
      snapshot: snapshot({
        recipient: {
          name: "María López",
          tax_id: "12345678Z",
          address: "Calle Mayor 1",
          postal_code: "46800",
          city: "Xàtiva",
        },
        lines: [
          {
            description: "Sesión de fisioterapia",
            session_date: "2026-08-10",
            patient: "María López",
            quantity: 1,
            base_cents: 5000,
            vat_rate: 21,
            vat_cents: 1050,
            total_cents: 6050,
          },
        ],
      }),
    });
    const summary = summarizeInvoices([replacedSimplified, full]);
    expect(summary.counts.replaced).toBe(1);
    expect(summary.vatRates).toEqual([
      { vat_rate: 21, base_cents: 5000, vat_cents: 1050, total_cents: 6050 },
    ]);
    expect(summary.net_cents).toBe(6050);
  });

  it("una rectificativa resta del total, porque sus líneas llevan importes negativos", () => {
    const full = invoice({
      id: "1",
      code: "1/26",
      kind: "full",
      replaces: "0/26",
      snapshot: snapshot({
        lines: [
          {
            description: "Sesión de fisioterapia",
            session_date: "2026-08-10",
            patient: "María López",
            quantity: 1,
            base_cents: 10000,
            vat_rate: 21,
            vat_cents: 2100,
            total_cents: 12100,
          },
        ],
      }),
    });
    const rectifying = invoice({
      id: "2",
      code: "R1/26",
      kind: "rectifying",
      rectifies: "1/26",
      snapshot: snapshot({
        lines: [
          {
            description: "Sesión de fisioterapia",
            session_date: "2026-08-10",
            patient: "María López",
            quantity: 1,
            base_cents: -10000,
            vat_rate: 21,
            vat_cents: -2100,
            total_cents: -12100,
          },
        ],
      }),
    });
    const summary = summarizeInvoices([full, rectifying]);
    expect(summary.vatRates).toEqual([
      { vat_rate: 21, base_cents: 0, vat_cents: 0, total_cents: 0 },
    ]);
    expect(summary.net_cents).toBe(0);
  });

  it("agrupa en líneas distintas cuando una factura mezcla tipos de IVA, sin perder ninguna de las dos", () => {
    const mixed = invoice({
      snapshot: snapshot({
        vat_note: "Exento de IVA (art. 20 LIVA)",
        lines: [
          {
            description: "Sesión exenta",
            session_date: "2026-08-10",
            patient: "María López",
            quantity: 1,
            base_cents: 4000,
            vat_rate: 0,
            vat_cents: 0,
            total_cents: 4000,
          },
          {
            description: "Producto con IVA",
            session_date: "2026-08-10",
            patient: "María López",
            quantity: 1,
            base_cents: 2000,
            vat_rate: 21,
            vat_cents: 420,
            total_cents: 2420,
          },
        ],
      }),
    });
    const summary = summarizeInvoices([mixed]);
    expect(summary.vatRates).toEqual([
      { vat_rate: 0, base_cents: 4000, vat_cents: 0, total_cents: 4000 },
      { vat_rate: 21, base_cents: 2000, vat_cents: 420, total_cents: 2420 },
    ]);
    expect(summary.net_cents).toBe(6420);
  });
});

describe("ledgerRows", () => {
  it("lista la sustituida igual que las demás, para que la gestoría vea todo lo emitido", () => {
    const replacedSimplified = invoice({
      id: "1",
      code: "1/26",
      kind: "simplified",
      status: "replaced",
      replaced_by: "2/26",
    });
    const full = invoice({
      id: "2",
      code: "2/26",
      kind: "full",
      replaces: "1/26",
      issued_at: "2026-08-10T11:00:00+02:00",
    });
    const rows = ledgerRows([replacedSimplified, full]);
    expect(rows.map((row) => row.code)).toEqual(["1/26", "2/26"]);
    expect(rows[0]?.status).toBe("Sustituida por 2/26");
    expect(rows[1]?.status).toBe("Emitida");
  });

  it("muestra «Consumidor final» cuando una simplificada no tiene destinatario", () => {
    const [row] = ledgerRows([
      invoice({ snapshot: snapshot({ recipient: null }) }),
    ]);
    expect(row?.client).toBe("Consumidor final");
    expect(row?.taxId).toBe("");
  });

  it("muestra el nombre y NIF del destinatario en una factura completa", () => {
    const [row] = ledgerRows([
      invoice({
        kind: "full",
        replaces: "0/26",
        snapshot: snapshot({
          recipient: {
            name: "María López",
            tax_id: "12345678Z",
            address: "Calle Mayor 1",
            postal_code: "46800",
            city: "Xàtiva",
          },
        }),
      }),
    ]);
    expect(row?.client).toBe("María López");
    expect(row?.taxId).toBe("12345678Z");
  });

  it("una fila por tipo de IVA cuando la factura mezcla tipos, con el mismo número en las dos", () => {
    const mixed = invoice({
      snapshot: snapshot({
        vat_note: "Exento de IVA (art. 20 LIVA)",
        lines: [
          {
            description: "Sesión exenta",
            session_date: "2026-08-10",
            patient: "María López",
            quantity: 1,
            base_cents: 4000,
            vat_rate: 0,
            vat_cents: 0,
            total_cents: 4000,
          },
          {
            description: "Producto con IVA",
            session_date: "2026-08-10",
            patient: "María López",
            quantity: 1,
            base_cents: 2000,
            vat_rate: 21,
            vat_cents: 420,
            total_cents: 2420,
          },
        ],
      }),
    });
    const rows = ledgerRows([mixed]);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.code)).toEqual(["1/26", "1/26"]);
    expect(rows[0]).toMatchObject({
      vat_rate: 0,
      base_cents: 4000,
      vat_cents: 0,
      total_cents: 4000,
      exemption: "Exento de IVA (art. 20 LIVA)",
      concept: "Sesión exenta",
    });
    expect(rows[1]).toMatchObject({
      vat_rate: 21,
      base_cents: 2000,
      vat_cents: 420,
      total_cents: 2420,
      exemption: "",
      concept: "Producto con IVA",
    });
  });

  it("solo rellena la exención cuando el tipo de IVA es 0", () => {
    const [row] = ledgerRows([invoice()]);
    expect(row?.vat_rate).toBe(21);
    expect(row?.exemption).toBe("");
  });

  it("muestra las formas de pago con las mismas etiquetas que el resto de la app", () => {
    const [row] = ledgerRows([
      invoice({
        snapshot: snapshot({
          payments: [
            { method: "cash", amount_cents: 3000 },
            { method: "card", amount_cents: 3050 },
          ],
        }),
      }),
    ]);
    expect(row?.paymentMethod).toBe("Efectivo, Tarjeta");
  });

  it("deja la forma de pago vacía cuando la factura no tiene cobros asociados", () => {
    const [row] = ledgerRows([
      invoice({ snapshot: snapshot({ payments: null }) }),
    ]);
    expect(row?.paymentMethod).toBe("");
  });

  it("indica a qué factura sustituye o rectifica", () => {
    const [full] = ledgerRows([invoice({ kind: "full", replaces: "1/26" })]);
    expect(full?.related).toBe("1/26");
    const [rectifying] = ledgerRows([
      invoice({ kind: "rectifying", rectifies: "2/26" }),
    ]);
    expect(rectifying?.related).toBe("2/26");
    const [simplified] = ledgerRows([invoice()]);
    expect(simplified?.related).toBe("");
  });

  it("ordena las filas por fecha de emisión y número, como la hoja que recibe la gestoría", () => {
    const rows = ledgerRows([
      invoice({
        id: "2",
        code: "2/26",
        issued_at: "2026-08-11T10:00:00+02:00",
      }),
      invoice({
        id: "1",
        code: "1/26",
        issued_at: "2026-08-10T10:00:00+02:00",
      }),
    ]);
    expect(rows.map((row) => row.code)).toEqual(["1/26", "2/26"]);
  });

  it("escribe la fecha en formato español, en hora de Madrid", () => {
    const [row] = ledgerRows([
      invoice({ issued_at: "2026-01-01T00:30:00+01:00" }),
    ]);
    expect(row?.date).toBe("01/01/2026");
  });

  it("une las descripciones de un mismo tipo de IVA con « · »", () => {
    const [row] = ledgerRows([
      invoice({
        snapshot: snapshot({
          lines: [
            {
              description: "Sesión de fisioterapia",
              session_date: "2026-08-10",
              patient: "María López",
              quantity: 1,
              base_cents: 3000,
              vat_rate: 21,
              vat_cents: 630,
              total_cents: 3630,
            },
            {
              description: "Material",
              session_date: "2026-08-10",
              patient: "María López",
              quantity: 1,
              base_cents: 2000,
              vat_rate: 21,
              vat_cents: 420,
              total_cents: 2420,
            },
          ],
        }),
      }),
    ]);
    expect(row?.concept).toBe("Sesión de fisioterapia · Material");
  });
});

describe("exportFileName", () => {
  it("names the quarterly Excel file the way the owner expects to find it", () => {
    expect(exportFileName(2026, 3, "xlsx")).toBe("LUMIA-facturas-2026-T3.xlsx");
  });

  it("uses the same pattern for the ZIP", () => {
    expect(exportFileName(2026, 3, "zip")).toBe("LUMIA-facturas-2026-T3.zip");
  });
});

describe("pdfFileName", () => {
  it("replaces the slash in the invoice code, which the filesystem cannot carry as a path separator", () => {
    expect(pdfFileName("1347/26")).toBe("1347-26.pdf");
  });

  it("does the same for a rectifying invoice's code", () => {
    expect(pdfFileName("R3/26")).toBe("R3-26.pdf");
  });
});

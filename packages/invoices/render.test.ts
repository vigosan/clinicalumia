import { readFile } from "node:fs/promises";
import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";
import { type InvoiceDetail, renderInvoicePdf } from "./index";

const exemption =
  "Operación exenta de IVA según el artículo 20.Uno.3º de la Ley 37/1992, del Impuesto sobre el Valor Añadido.";

const issuer = {
  name: "Patricia Hernán Sánchez",
  tax_id: "12345678Z",
  address_line: "Calle Montesa 7",
  postal_code: "46800",
  city: "Xàtiva",
  province: "Valencia",
  phone: "614 552 808",
  email: "info@clinicalumia.es",
  website: "https://www.clinicalumia.es/",
};

const noRelated = {
  replaces: null,
  replaced_by: null,
  rectifies: null,
  rectified_by: null,
};

function simplified(overrides: Partial<InvoiceDetail> = {}): InvoiceDetail {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    code: "34/26",
    kind: "simplified",
    status: "issued",
    issued_at: "2026-09-30T10:15:00+02:00",
    total_cents: 4500,
    reason: "",
    payment_id: "22222222-2222-2222-2222-222222222222",
    appointment_id: "33333333-3333-3333-3333-333333333333",
    patient_id: "44444444-4444-4444-4444-444444444444",
    professional_id: "55555555-5555-5555-5555-555555555555",
    snapshot: {
      issuer,
      recipient: null,
      lines: [
        {
          description: "Sesión de logopedia miofuncional (45 min)",
          session_date: "2026-09-29",
          patient: "Lucía M.",
          quantity: 1,
          base_cents: 4500,
          vat_rate: 0,
          vat_cents: 0,
          total_cents: 4500,
        },
      ],
      totals: { base_cents: 4500, vat_cents: 0, total_cents: 4500 },
      vat: "exempt",
      vat_note: exemption,
      payments: [{ method: "card", amount_cents: 4500 }],
      footer:
        "LUMIA · Calle Montesa 7, 46800 Xàtiva · Gracias por confiar en LUMIA.",
    },
    related: noRelated,
    qr: {
      nif: "12345678Z",
      code: "34/26",
      issued_on: "30-09-2026",
      total_cents: 4500,
    },
    ...overrides,
  };
}

function fullWithVat(): InvoiceDetail {
  const base = simplified();
  return {
    ...base,
    code: "35/26",
    kind: "full",
    total_cents: 6050,
    snapshot: {
      issuer,
      recipient: {
        name: "Marta López Ferrer",
        tax_id: "87654321X",
        address: "Avinguda Selgas 12, 3º B",
        postal_code: "46800",
        city: "Xàtiva",
      },
      lines: [
        {
          description: "Informe logopédico de valoración",
          session_date: "2026-09-29",
          patient: "Lucía M.",
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
      payments: [{ method: "bizum", amount_cents: 6050 }],
      footer: "",
    },
    related: { ...noRelated, replaces: { id: base.id, code: "34/26" } },
  };
}

function rectifying(): InvoiceDetail {
  const base = simplified();
  return {
    ...base,
    code: "R1/26",
    kind: "rectifying",
    total_cents: -4500,
    reason: "Cobro registrado por error en la cita equivocada",
    snapshot: {
      issuer,
      recipient: null,
      lines: [
        {
          description: "Sesión de logopedia miofuncional (45 min)",
          session_date: "2026-09-29",
          patient: "Lucía M.",
          quantity: 1,
          base_cents: -4500,
          vat_rate: 0,
          vat_cents: 0,
          total_cents: -4500,
        },
      ],
      totals: { base_cents: -4500, vat_cents: 0, total_cents: -4500 },
      vat: "exempt",
      vat_note: exemption,
      payments: [{ method: "cash", amount_cents: -4500 }],
      footer: "",
      rectifies: { code: "34/26", issued_on: "2026-09-30" },
      reason: "Cobro registrado por error en la cita equivocada",
    },
    related: { ...noRelated, rectifies: { id: base.id, code: "34/26" } },
    qr: {
      nif: "12345678Z",
      code: "R1/26",
      issued_on: "30-09-2026",
      total_cents: -4500,
    },
  };
}

async function textPosition(
  bytes: Uint8Array,
  needle: string,
): Promise<{ x: number; y: number }> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const page = await pdf.getPage(1);
  const content = await page.getTextContent();
  const item = content.items.find(
    (entry) => "str" in entry && entry.str.includes(needle),
  );
  if (!item || !("transform" in item)) throw new Error(`${needle} not found`);
  return { x: item.transform[4], y: item.transform[5] };
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.replace(/\s+/g, " ");
}

describe("renderInvoicePdf", () => {
  it("produces a simplified invoice PDF with everything the patient needs to read, and only the QR label a non-VERI*FACTU system may print", async () => {
    const bytes = await renderInvoicePdf(simplified());

    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
    const text = await pdfText(bytes);
    expect(text).toContain("Factura simplificada 34/26");
    expect(text).toContain("30/09/2026");
    expect(text).toContain("Patricia Hernán Sánchez");
    expect(text).toContain("NIF 12345678Z");
    expect(text).toContain("29/09/2026 · Lucía M.");
    expect(text).toContain("45,00 €");
    expect(text).toContain("Pagado con tarjeta");
    expect(text).toContain(exemption);
    expect(text).toContain("QR tributario:");
    expect(text).not.toContain("Factura verificable");
    expect(text).not.toContain("Para");
  });

  it("shows the recipient, the VAT breakdown and which simplified invoice it replaces", async () => {
    const text = await pdfText(await renderInvoicePdf(fullWithVat()));

    expect(text).toContain("Factura 35/26");
    expect(text).toContain("Sustituye a la factura simplificada 34/26");
    expect(text).toContain("Para");
    expect(text).toContain("Marta López Ferrer");
    expect(text).toContain("NIF 87654321X");
    expect(text).toContain("Avinguda Selgas 12, 3º B");
    expect(text).toContain("Base");
    expect(text).toContain("50,00 €");
    expect(text).toContain("IVA 21 %");
    expect(text).toContain("10,50 €");
    expect(text).toContain("60,50 €");
    expect(text).toContain("Pagado por Bizum");
  });

  it("marks a rectifying invoice with the original code, the reason and negative amounts, without claiming a payment it reverses", async () => {
    const text = await pdfText(await renderInvoicePdf(rectifying()));

    expect(text).toContain("Factura rectificativa R1/26");
    expect(text).toContain("Rectifica la factura 34/26 del 30/09/2026");
    expect(text).toContain("Cobro registrado por error en la cita equivocada");
    expect(text).toContain("-45,00 €");
    expect(text).toContain("QR tributario:");
    expect(text).not.toContain("Pagado");
  });

  it("ends every page with the clinic's footer and its website, written without the protocol, so the patient knows where to find the clinic", async () => {
    const text = await pdfText(await renderInvoicePdf(simplified()));

    expect(text).toContain(
      "LUMIA · Calle Montesa 7, 46800 Xàtiva · Gracias por confiar en LUMIA. · www.clinicalumia.es",
    );
    expect(text).not.toContain("https://");
  });

  it("keeps accents, commas and very long texts readable instead of breaking the PDF", async () => {
    const longDescription = `Sesión de terapia miofuncional, deglución atípica y respiración oral, ${"con ejercicios de lengua, labios y mejillas ".repeat(6)}fin del concepto`;
    const detail = fullWithVat();
    const snapshot = detail.snapshot as Record<string, unknown>;
    const bytes = await renderInvoicePdf({
      ...detail,
      snapshot: {
        ...snapshot,
        recipient: {
          name: "Ñandú Àlex Güell-Pérez, S.L. y compañía de logopedia con un nombre larguísimo",
          tax_id: "B12345674",
          address: "Carrer de l'Àngel Guimerà, 123, escalera C, 5º 2ª",
          postal_code: "46800",
          city: "Xàtiva",
        },
        lines: [
          {
            description: longDescription,
            session_date: "2026-09-29",
            patient: "Íñigo Ñ.",
            quantity: 1,
            base_cents: 5000,
            vat_rate: 21,
            vat_cents: 1050,
            total_cents: 6050,
          },
        ],
      },
    });

    const text = await pdfText(bytes);
    expect(text).toContain("Ñandú Àlex Güell-Pérez");
    expect(text).toContain("Carrer de l'Àngel Guimerà");
    expect(text).toContain("Íñigo Ñ.");
    expect(text).toContain("fin del concepto");
    expect(text).toContain("60,50 €");
  });

  it("accepts the clinic's own logo bytes instead of the packaged one", async () => {
    const logo = new Uint8Array(
      await readFile(new URL("./assets/logo-dark.png", import.meta.url)),
    );

    const bytes = await renderInvoicePdf(simplified(), { logo });

    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
  });

  it("places the parties beside the tax QR so the QR does not take a band of its own", async () => {
    const bytes = await renderInvoicePdf(fullWithVat());
    const qrLabel = await textPosition(bytes, "QR tributario:");
    const issuerName = await textPosition(bytes, "Patricia Hernán Sánchez");
    const recipientName = await textPosition(bytes, "Marta López Ferrer");
    const qrBottom = qrLabel.y - 100;

    expect(issuerName.y).toBeLessThanOrEqual(qrLabel.y);
    expect(issuerName.y).toBeGreaterThan(qrBottom);
    expect(recipientName.y).toBeGreaterThan(qrBottom);
    expect(recipientName.x).toBeLessThan(qrLabel.x);
  });
});

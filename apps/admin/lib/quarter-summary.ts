import type { InvoiceSnapshot } from "@clinicalumia/invoices";
import {
  formatMadridDate,
  paymentMethodLabel,
} from "@clinicalumia/invoices/format";
import type { Quarter } from "./quarter";

export type QuarterInvoiceKind = "simplified" | "full" | "rectifying";
export type QuarterInvoiceStatus = "issued" | "replaced";

export type QuarterInvoice = {
  id: string;
  code: string;
  kind: QuarterInvoiceKind;
  status: QuarterInvoiceStatus;
  issued_at: string;
  replaces: string | null;
  rectifies: string | null;
  replaced_by: string | null;
  snapshot: InvoiceSnapshot;
};

export type VatRateTotal = {
  vat_rate: number;
  base_cents: number;
  vat_cents: number;
  total_cents: number;
};

export type QuarterSummary = {
  counts: {
    simplified: number;
    full: number;
    rectifying: number;
    replaced: number;
  };
  vatRates: VatRateTotal[];
  net_cents: number;
};

export function summarizeInvoices(invoices: QuarterInvoice[]): QuarterSummary {
  const counts = { simplified: 0, full: 0, rectifying: 0, replaced: 0 };
  const byRate = new Map<number, VatRateTotal>();
  for (const invoice of invoices) {
    if (invoice.status === "replaced") counts.replaced++;
    else counts[invoice.kind]++;

    const replacesAnother =
      invoice.kind === "full" && invoice.replaces !== null;
    if (replacesAnother) continue;

    for (const line of invoice.snapshot.lines) {
      const bucket = byRate.get(line.vat_rate) ?? {
        vat_rate: line.vat_rate,
        base_cents: 0,
        vat_cents: 0,
        total_cents: 0,
      };
      bucket.base_cents += line.base_cents;
      bucket.vat_cents += line.vat_cents;
      bucket.total_cents += line.total_cents;
      byRate.set(line.vat_rate, bucket);
    }
  }
  const vatRates = [...byRate.values()].sort((a, b) => a.vat_rate - b.vat_rate);
  const net_cents = vatRates.reduce((sum, rate) => sum + rate.total_cents, 0);
  return { counts, vatRates, net_cents };
}

const INVOICE_TYPE_LABEL: Record<QuarterInvoiceKind, string> = {
  simplified: "Simplificada",
  full: "Completa",
  rectifying: "Rectificativa",
};

export type LedgerRow = {
  date: string;
  code: string;
  type: string;
  related: string;
  status: string;
  client: string;
  taxId: string;
  concept: string;
  base_cents: number;
  vat_rate: number;
  vat_cents: number;
  total_cents: number;
  exemption: string;
  paymentMethod: string;
};

function relatedCode(invoice: QuarterInvoice): string {
  if (invoice.kind === "full") return invoice.replaces ?? "";
  if (invoice.kind === "rectifying") return invoice.rectifies ?? "";
  return "";
}

function statusLabel(invoice: QuarterInvoice): string {
  if (invoice.status === "replaced")
    return `Sustituida por ${invoice.replaced_by ?? ""}`;
  return "Emitida";
}

function paymentMethodColumn(snapshot: InvoiceSnapshot): string {
  if (!snapshot.payments || snapshot.payments.length === 0) return "";
  return [
    ...new Set(
      snapshot.payments.map((payment) => paymentMethodLabel(payment.method)),
    ),
  ].join(", ");
}

function codeNumber(code: string): number {
  return Number(/\d+/.exec(code)?.[0] ?? 0);
}

export function ledgerRows(invoices: QuarterInvoice[]): LedgerRow[] {
  const sorted = [...invoices].sort(
    (a, b) =>
      Date.parse(a.issued_at) - Date.parse(b.issued_at) ||
      codeNumber(a.code) - codeNumber(b.code),
  );
  const rows: LedgerRow[] = [];
  for (const invoice of sorted) {
    const { snapshot } = invoice;
    const byRate = new Map<number, { descriptions: string[] } & VatRateTotal>();
    for (const line of snapshot.lines) {
      const bucket = byRate.get(line.vat_rate) ?? {
        vat_rate: line.vat_rate,
        base_cents: 0,
        vat_cents: 0,
        total_cents: 0,
        descriptions: [],
      };
      bucket.base_cents += line.base_cents;
      bucket.vat_cents += line.vat_cents;
      bucket.total_cents += line.total_cents;
      bucket.descriptions.push(line.description);
      byRate.set(line.vat_rate, bucket);
    }
    for (const bucket of [...byRate.values()].sort(
      (a, b) => a.vat_rate - b.vat_rate,
    )) {
      rows.push({
        date: formatMadridDate(invoice.issued_at),
        code: invoice.code,
        type: INVOICE_TYPE_LABEL[invoice.kind],
        related: relatedCode(invoice),
        status: statusLabel(invoice),
        client: snapshot.recipient?.name ?? "Consumidor final",
        taxId: snapshot.recipient?.tax_id ?? "",
        concept: bucket.descriptions.join(" · "),
        base_cents: bucket.base_cents,
        vat_rate: bucket.vat_rate,
        vat_cents: bucket.vat_cents,
        total_cents: bucket.total_cents,
        exemption: bucket.vat_rate === 0 ? snapshot.vat_note : "",
        paymentMethod: paymentMethodColumn(snapshot),
      });
    }
  }
  return rows;
}

export function exportFileName(year: number, q: Quarter, ext: string): string {
  return `LUMIA-facturas-${year}-T${q}.${ext}`;
}

export function pdfFileName(code: string): string {
  return `${code.replaceAll("/", "-")}.pdf`;
}

export function vatRateLabel(vatRate: number): string {
  return vatRate === 0 ? "Exento" : `IVA ${vatRate} %`;
}

import type { createClient } from "@clinicalumia/api/server";
import { renderInvoicePdf } from "@clinicalumia/invoices";
import { clinicLogo } from "@clinicalumia/invoices/clinic-logo";
import { type Zippable, zipSync } from "fflate";
import { ledgerXlsx } from "./ledger-xlsx";
import type { Quarter } from "./quarter";
import {
  exportFileName,
  pdfFileName,
  type QuarterInvoice,
} from "./quarter-summary";

type Client = Awaited<ReturnType<typeof createClient>>;

const DETAIL_CONCURRENCY = 4;

async function invoiceDetail(supabase: Client, invoice: QuarterInvoice) {
  const { data: detail, error } = await supabase
    .rpc("invoice_detail", { p_invoice_id: invoice.id })
    .single();
  if (error || !detail)
    throw new Error(
      `No se ha podido generar la factura ${invoice.code}: ${error?.message ?? ""}`,
    );
  return detail;
}

function uniqueName(entries: Zippable, name: string): string {
  const base = name.replace(/\.pdf$/, "");
  let candidate = name;
  for (let copy = 2; candidate in entries; copy++)
    candidate = `${base} (${copy}).pdf`;
  return candidate;
}

export async function quarterZip(
  supabase: Client,
  {
    year,
    q,
    invoices,
    maxBytes,
  }: {
    year: number;
    q: Quarter;
    invoices: QuarterInvoice[];
    maxBytes: number;
  },
): Promise<{ zip: Uint8Array } | { tooLarge: true }> {
  const logo = await clinicLogo(supabase);
  const entries: Zippable = {};
  let total = 0;
  for (let start = 0; start < invoices.length; start += DETAIL_CONCURRENCY) {
    const details = await Promise.all(
      invoices
        .slice(start, start + DETAIL_CONCURRENCY)
        .map((invoice) => invoiceDetail(supabase, invoice)),
    );
    for (const detail of details) {
      const pdf = await renderInvoicePdf(detail, { logo });
      total += pdf.byteLength;
      if (total > maxBytes) return { tooLarge: true };
      entries[uniqueName(entries, pdfFileName(detail.code))] = [
        pdf,
        { level: 0 },
      ];
    }
  }
  const xlsx = await ledgerXlsx({ year, q, invoices });
  entries[exportFileName(year, q, "xlsx")] = [xlsx, { level: 0 }];
  const zip = zipSync(entries);
  return zip.byteLength > maxBytes ? { tooLarge: true } : { zip };
}

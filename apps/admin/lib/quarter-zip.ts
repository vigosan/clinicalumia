import type { createClient } from "@clinicalumia/api/server";
import { renderInvoicePdf } from "@clinicalumia/invoices";
import { type Zippable, zipSync } from "fflate";
import { ledgerXlsx } from "./ledger-xlsx";
import type { Quarter } from "./quarter";
import {
  exportFileName,
  pdfFileName,
  type QuarterInvoice,
} from "./quarter-summary";

type Client = Awaited<ReturnType<typeof createClient>>;

const LOGO_TIMEOUT_MS = 3000;

function isPngOrJpeg(bytes: Uint8Array): boolean {
  const png = [0x89, 0x50, 0x4e, 0x47].every(
    (byte, index) => bytes[index] === byte,
  );
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  return png || jpeg;
}

async function clinicLogo(supabase: Client): Promise<Uint8Array | undefined> {
  const { data } = await supabase
    .from("clinic_settings")
    .select("logo_path")
    .maybeSingle();
  if (!data?.logo_path) return undefined;
  const { publicUrl } = supabase.storage
    .from("branding")
    .getPublicUrl(data.logo_path).data;
  const response = await fetch(publicUrl, {
    signal: AbortSignal.timeout(LOGO_TIMEOUT_MS),
  }).catch(() => null);
  if (!response?.ok) return undefined;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return isPngOrJpeg(bytes) ? bytes : undefined;
}

export async function quarterZip(
  supabase: Client,
  {
    year,
    q,
    invoices,
  }: { year: number; q: Quarter; invoices: QuarterInvoice[] },
): Promise<Uint8Array> {
  const logo = await clinicLogo(supabase);
  const entries: Zippable = {};
  for (const invoice of invoices) {
    const { data: detail, error } = await supabase
      .rpc("invoice_detail", { p_invoice_id: invoice.id })
      .single();
    if (error || !detail)
      throw new Error(
        `No se ha podido generar la factura ${invoice.code}: ${error?.message ?? ""}`,
      );
    const pdf = await renderInvoicePdf(detail, { logo });
    entries[pdfFileName(detail.code)] = [pdf, { level: 0 }];
  }
  const xlsx = await ledgerXlsx({ year, q, invoices });
  entries[exportFileName(year, q, "xlsx")] = [xlsx, { level: 0 }];
  return zipSync(entries);
}

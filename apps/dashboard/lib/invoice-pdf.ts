import type { createClient } from "@clinicalumia/api/server";
import { invoiceFileName, renderInvoicePdf } from "@clinicalumia/invoices";
import type { DbError } from "./payments";

type Client = Awaited<ReturnType<typeof createClient>>;

const LOGO_TIMEOUT_MS = 3000;

export type InvoicePdf = {
  code: string;
  fileName: string;
  pdf: Uint8Array;
  patientId: string;
};

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

export async function loadInvoicePdf(
  supabase: Client,
  invoiceId: string,
): Promise<InvoicePdf | { error: DbError }> {
  const { data: detail, error } = await supabase
    .rpc("invoice_detail", { p_invoice_id: invoiceId })
    .single();
  if (error || !detail) return { error: error ?? {} };
  const logo = await clinicLogo(supabase);
  const pdf = await renderInvoicePdf(detail, { logo });
  return {
    code: detail.code,
    fileName: invoiceFileName(detail.code),
    pdf,
    patientId: detail.patient_id,
  };
}

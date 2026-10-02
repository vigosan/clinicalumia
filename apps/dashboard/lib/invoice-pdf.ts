import type { createClient } from "@clinicalumia/api/server";
import { invoiceFileName, renderInvoicePdf } from "@clinicalumia/invoices";
import { clinicLogo } from "@clinicalumia/invoices/clinic-logo";
import type { DbError } from "./payments";

type Client = Awaited<ReturnType<typeof createClient>>;

export type InvoicePdf = {
  code: string;
  fileName: string;
  pdf: Uint8Array;
  patientId: string;
};

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

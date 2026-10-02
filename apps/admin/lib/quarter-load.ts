import type { createClient } from "@clinicalumia/api/server";
import type { InvoiceSnapshot } from "@clinicalumia/invoices";
import { type Quarter, quarterRange } from "./quarter";
import type { QuarterInvoice } from "./quarter-summary";

type Client = Awaited<ReturnType<typeof createClient>>;

export const QUARTER_PAGE_SIZE = 1000;

const COLUMNS =
  "id, code, kind, status, issued_at, snapshot, replaces:replaces_invoice_id(code), rectifies:rectifies_invoice_id(code), replaced_by:invoices!replaces_invoice_id(code), rectified_by:invoices!rectifies_invoice_id(code), corrected_by:invoices!corrects_invoice_id(code)";

export async function loadQuarterInvoices(
  supabase: Client,
  year: number,
  q: Quarter,
): Promise<{ ok: true; invoices: QuarterInvoice[] } | { ok: false }> {
  const { from, to } = quarterRange(year, q);
  const invoices: QuarterInvoice[] = [];
  while (true) {
    const offset = invoices.length;
    const { data, error } = await supabase
      .from("invoices")
      .select(COLUMNS)
      .gte("issued_at", from)
      .lt("issued_at", to)
      .order("issued_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + QUARTER_PAGE_SIZE - 1);
    if (error || !data) return { ok: false };
    if (data.length === 0) return { ok: true, invoices };
    for (const row of data) {
      invoices.push({
        id: row.id,
        code: row.code,
        kind: row.kind,
        status: row.status,
        issued_at: row.issued_at,
        snapshot: row.snapshot as unknown as InvoiceSnapshot,
        replaces: row.replaces?.code ?? null,
        rectifies: row.rectifies?.code ?? null,
        replaced_by: row.replaced_by[0]?.code ?? null,
        rectified_by: row.rectified_by[0]?.code ?? null,
        corrected_by: row.corrected_by[0]?.code ?? null,
      });
    }
  }
}

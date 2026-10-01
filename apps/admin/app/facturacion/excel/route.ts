import { requireOwner } from "@clinicalumia/api/auth";
import { createClient } from "@clinicalumia/api/server";
import { ledgerXlsx } from "@/lib/ledger-xlsx";
import { parseQuarter } from "@/lib/quarter";
import { loadQuarterInvoices } from "@/lib/quarter-load";
import { exportFileName } from "@/lib/quarter-summary";

export const runtime = "nodejs";

function plain(status: number, message: string) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return plain(403, owner.error);

  const { searchParams } = new URL(request.url);
  const quarter = parseQuarter(searchParams.get("year"), searchParams.get("q"));
  if (!quarter) return plain(400, "El año o el trimestre no son válidos.");

  const result = await loadQuarterInvoices(supabase, quarter.year, quarter.q);
  if (!result.ok) throw new Error("No se ha podido cargar el trimestre.");

  const xlsx = await ledgerXlsx({ ...quarter, invoices: result.invoices });
  return new Response(Buffer.from(xlsx), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${exportFileName(quarter.year, quarter.q, "xlsx")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

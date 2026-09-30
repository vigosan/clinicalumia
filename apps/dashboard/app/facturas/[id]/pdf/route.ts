import { createClient } from "@clinicalumia/api/server";
import { isUuid } from "@/lib/agenda";
import { loadInvoicePdf } from "@/lib/invoice-pdf";

export const runtime = "nodejs";

function notFound() {
  return new Response("Factura no encontrada", {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const supabase = await createClient();
  const result = await loadInvoicePdf(supabase, id);
  if ("error" in result) {
    if (
      result.error.code === "42501" ||
      result.error.message === "invoice_not_found"
    )
      return notFound();
    throw new Error(
      `No se ha podido generar la factura: ${result.error.message}`,
    );
  }
  return new Response(Buffer.from(result.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${result.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

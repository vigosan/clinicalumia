import { requireOwner } from "@clinicalumia/api/auth";
import { createClient } from "@clinicalumia/api/server";
import { parseQuarter } from "@/lib/quarter";
import { loadQuarterInvoices } from "@/lib/quarter-load";
import { exportFileName } from "@/lib/quarter-summary";
import { quarterZip } from "@/lib/quarter-zip";

export const runtime = "nodejs";
export const maxDuration = 300;

const BUCKET = "exports";
const MAX_ZIP_BYTES = 50 * 1024 * 1024;
const SIGNED_URL_SECONDS = 600;

function json(status: number, body: { url: string } | { error: string }) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function storageFailure(error: { message: string }): never {
  throw new Error(`No se ha podido guardar el ZIP: ${error.message}`);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return json(403, { error: owner.error });

  const { searchParams } = new URL(request.url);
  const quarter = parseQuarter(searchParams.get("year"), searchParams.get("q"));
  if (!quarter)
    return json(400, { error: "El año o el trimestre no son válidos." });

  const result = await loadQuarterInvoices(supabase, quarter.year, quarter.q);
  if (!result.ok) throw new Error("No se ha podido cargar el trimestre.");
  if (result.invoices.length === 0)
    return json(404, { error: "No hay facturas en este trimestre." });

  const built = await quarterZip(supabase, {
    ...quarter,
    invoices: result.invoices,
    maxBytes: MAX_ZIP_BYTES,
  });
  if ("tooLarge" in built)
    return json(413, {
      error:
        "El ZIP del trimestre pesa más de 50 MB. Descarga las facturas desde el panel.",
    });

  const exports = supabase.storage.from(BUCKET);
  const previous = await exports.list(owner.userId);
  if (previous.error) storageFailure(previous.error);
  if (previous.data.length > 0) {
    const removed = await exports.remove(
      previous.data.map(({ name }) => `${owner.userId}/${name}`),
    );
    if (removed.error) storageFailure(removed.error);
  }

  const path = `${owner.userId}/${crypto.randomUUID()}.zip`;
  const uploaded = await exports.upload(path, built.zip, {
    contentType: "application/zip",
  });
  if (uploaded.error) storageFailure(uploaded.error);

  const signed = await exports.createSignedUrl(path, SIGNED_URL_SECONDS, {
    download: exportFileName(quarter.year, quarter.q, "zip"),
  });
  if (signed.error) storageFailure(signed.error);
  return json(200, { url: signed.data.signedUrl });
}

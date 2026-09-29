import { createAnonClient } from "@clinicalumia/api/anon";
import { icsCalendar } from "@clinicalumia/api/ics";

const SUFFIX = ".ics";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: segment } = await params;
  if (!segment.endsWith(SUFFIX)) return new Response(null, { status: 404 });
  const token = segment.slice(0, -SUFFIX.length);

  const supabase = createAnonClient();

  const { data: owner, error: ownerError } = await supabase.rpc(
    "calendar_owner",
    { p_token: token },
  );
  if (ownerError) throw ownerError;
  if (!owner) return new Response(null, { status: 404 });

  const { data: rows, error } = await supabase.rpc("calendar_feed", {
    p_token: token,
  });
  if (error) throw error;

  const ics = icsCalendar({
    name: `LUMIA · ${owner}`,
    events: rows.map((row) => ({
      uid: `${row.appointment_id}@clinicalumia.es`,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      stamp: row.updated_at,
      summary: row.summary,
    })),
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}

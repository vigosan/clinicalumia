import { appointmentIcs } from "@clinicalumia/api/appointment-notice";
import { createClient } from "@clinicalumia/api/server";
import { splitAppointments } from "@/lib/account";
import { isTeamSession } from "@/lib/booking";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 401 });

  const { data, error } = await supabase.rpc("my_appointments");
  if (isTeamSession(error)) return new Response(null, { status: 404 });
  if (error) throw error;
  const now = new Date();
  const appointment = splitAppointments(data, now).upcoming.find(
    (candidate) => candidate.id === id,
  );
  if (!appointment) return new Response(null, { status: 404 });

  const ics = appointmentIcs({
    id: appointment.id,
    startsAt: appointment.starts_at,
    endsAt: appointment.ends_at,
    serviceName: appointment.service_name,
    now,
    updatedAt: appointment.updated_at,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cita.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}

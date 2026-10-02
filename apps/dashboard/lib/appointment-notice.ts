import {
  type AppointmentNotice,
  sendAppointmentNotice,
} from "@clinicalumia/api/appointment-notice";
import type { createClient } from "@clinicalumia/api/server";

type Client = Awaited<ReturnType<typeof createClient>>;

type Guardian = { email: string | null; archived_at: string | null };

export function noticeRecipients(
  person: { email: string | null },
  guardians: Guardian[],
): string[] {
  if (person.email) return [person.email.toLowerCase()];
  const emails = guardians.flatMap((guardian) =>
    guardian.email && !guardian.archived_at
      ? [guardian.email.toLowerCase()]
      : [],
  );
  return [...new Set(emails)].sort();
}

export async function loadNoticeRecipients(
  supabase: Client,
  personId: string,
): Promise<string[]> {
  const [
    { data: person, error: personError },
    { data: guardianships, error: guardiansError },
  ] = await Promise.all([
    supabase.from("people").select("email").eq("id", personId).single(),
    supabase
      .from("guardianships")
      .select(
        "guardian:people!guardianships_guardian_id_fkey(email, archived_at)",
      )
      .eq("minor_id", personId),
  ]);
  if (personError) throw personError;
  if (guardiansError) throw guardiansError;
  return noticeRecipients(
    person,
    guardianships.flatMap(({ guardian }) => (guardian ? [guardian] : [])),
  );
}

async function loadAppointmentRecipients(
  supabase: Client,
  appointmentId: string,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("appointment_notice_recipients", {
    p_appointment_id: appointmentId,
  });
  if (error) throw error;
  return data;
}

export async function loadAppointmentTimes(
  supabase: Client,
  appointmentId: string,
): Promise<{
  starts_at: string;
  ends_at: string;
  professional_id: string;
  professional_name: string;
} | null> {
  const { data } = await supabase
    .from("appointments")
    .select(
      "starts_at, ends_at, professional_id, professional:profiles!appointments_professional_id_fkey(full_name)",
    )
    .eq("id", appointmentId)
    .maybeSingle();
  if (!data) return null;
  return {
    starts_at: data.starts_at,
    ends_at: data.ends_at,
    professional_id: data.professional_id,
    professional_name: data.professional?.full_name ?? "",
  };
}

export async function notifyPatient(
  supabase: Client,
  appointmentId: string,
  notice: AppointmentNotice,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("appointments")
      .select(
        "id, starts_at, ends_at, updated_at, patient:people(first_name, last_name), service:services(name), professional:profiles!appointments_professional_id_fkey(full_name)",
      )
      .eq("id", appointmentId)
      .single();
    if (error) throw error;
    if (!data.patient || !data.service || !data.professional)
      throw new Error(`Faltan datos de la cita ${appointmentId}`);
    await sendAppointmentNotice({
      recipients: await loadAppointmentRecipients(supabase, data.id),
      notice,
      appointment: {
        id: data.id,
        startsAt: data.starts_at,
        endsAt: data.ends_at,
        updatedAt: data.updated_at,
        serviceName: data.service.name,
        professionalName: data.professional.full_name,
        personName: `${data.patient.first_name} ${data.patient.last_name}`,
      },
    });
    return true;
  } catch (error) {
    console.error("No se ha podido avisar al paciente de la cita", error);
    return false;
  }
}

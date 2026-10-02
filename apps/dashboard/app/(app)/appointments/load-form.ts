import { addDays, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { appointmentFormInitials, isUuid } from "@/lib/agenda";
import { loadClosures } from "@/lib/closures";
import { canNotifyPatient } from "./actions";

export type AppointmentFormParams = {
  date?: string;
  time?: string;
  professional?: string;
  patient?: string;
};

export async function loadAppointmentForm(params: AppointmentFormParams) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: ownProfile, error: ownProfileError } = await supabase
    .from("profiles")
    .select("id, role, specialty_id")
    .eq("id", user.id)
    .single();
  if (ownProfileError || !ownProfile) return { ok: false as const };

  const patientId =
    params.patient && isUuid(params.patient) ? params.patient : null;

  const isOwner = ownProfile.role === "owner";

  const [
    { data: directory, error: directoryError },
    { data: pending, error: pendingError },
    { data: services, error: servicesError },
    { data: patient },
    closures,
  ] = await Promise.all([
    supabase.rpc("staff_directory"),
    isOwner
      ? supabase.rpc("pending_invitations")
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("services")
      .select("id, name, duration_minutes, specialty_id")
      .eq("is_active", true)
      .order("name"),
    patientId
      ? supabase
          .from("people")
          .select("id, first_name, last_name")
          .eq("id", patientId)
          .eq("is_patient", true)
          .is("archived_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    loadClosures(supabase, addDays(todayInMadrid(), -365)),
  ]);

  if (directoryError || pendingError || servicesError || !closures) {
    return { ok: false as const };
  }

  const initialCanNotify = patient ? await canNotifyPatient(patient.id) : false;

  const pendingIds = new Set((pending ?? []).map((row) => row.profile_id));
  const professionals = (directory ?? [])
    .filter((profile) => !pendingIds.has(profile.id))
    .map((profile) => ({
      id: profile.id,
      fullName: profile.full_name,
      specialtyId: profile.specialty_id,
    }));

  return {
    ok: true as const,
    patient,
    form: {
      professionals,
      fixedProfessionalId: isOwner ? null : ownProfile.id,
      services: (services ?? []).map((service) => ({
        id: service.id,
        name: service.name,
        durationMinutes: service.duration_minutes,
        specialtyId: service.specialty_id,
      })),
      ...appointmentFormInitials(params, professionals, todayInMadrid()),
      initialPatient: patient,
      initialCanNotify,
      closures,
    },
  };
}

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

  const [
    { data: directory, error: directoryError },
    { data: services, error: servicesError },
    { data: patient },
    closures,
  ] = await Promise.all([
    supabase.rpc("staff_directory"),
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

  if (directoryError || servicesError || !closures) {
    return { ok: false as const };
  }

  const initialCanNotify = patient ? await canNotifyPatient(patient.id) : false;

  const professionals = (directory ?? []).map((profile) => ({
    id: profile.id,
    fullName: profile.full_name,
    specialtyId: profile.specialty_id,
  }));

  return {
    ok: true as const,
    patient,
    form: {
      professionals,
      fixedProfessionalId: ownProfile.role === "owner" ? null : ownProfile.id,
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

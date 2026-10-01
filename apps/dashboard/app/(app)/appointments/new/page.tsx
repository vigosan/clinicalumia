import {
  isValidDate,
  isValidTime,
  todayInMadrid,
} from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import type { Metadata } from "next";
import { isUuid } from "@/lib/agenda";
import { AppointmentForm } from "../AppointmentForm";

export const metadata: Metadata = { title: "Nueva cita" };

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    time?: string;
    professional?: string;
    patient?: string;
  }>;
}) {
  const params = await searchParams;
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
  if (ownProfileError || !ownProfile) {
    return (
      <Card
        role="alert"
        className="text-center text-danger-600 text-sm"
        data-testid="appointment-form-error"
      >
        No se han podido cargar los datos del formulario.
      </Card>
    );
  }

  const patientId =
    params.patient && isUuid(params.patient) ? params.patient : null;

  const [
    { data: directory, error: directoryError },
    { data: services, error: servicesError },
    { data: patient },
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
  ]);

  if (directoryError || servicesError) {
    return (
      <Card
        role="alert"
        className="text-center text-danger-600 text-sm"
        data-testid="appointment-form-error"
      >
        No se han podido cargar los datos del formulario.
      </Card>
    );
  }

  const professionals = (directory ?? []).map((profile) => ({
    id: profile.id,
    fullName: profile.full_name,
    specialtyId: profile.specialty_id,
  }));

  const isOwner = ownProfile.role === "owner";
  const fixedProfessionalId = isOwner ? null : ownProfile.id;

  const initialDate =
    params.date && isValidDate(params.date) ? params.date : todayInMadrid();
  const initialTime =
    params.time && isValidTime(params.time) ? params.time : "";
  const initialProfessionalId =
    params.professional &&
    isUuid(params.professional) &&
    professionals.some(
      (professional) => professional.id === params.professional,
    )
      ? params.professional
      : null;

  return (
    <>
      <PageHeader title="Nueva cita" />
      <Card>
        <AppointmentForm
          professionals={professionals}
          fixedProfessionalId={fixedProfessionalId}
          services={(services ?? []).map((service) => ({
            id: service.id,
            name: service.name,
            durationMinutes: service.duration_minutes,
            specialtyId: service.specialty_id,
          }))}
          initialDate={initialDate}
          initialTime={initialTime}
          initialProfessionalId={initialProfessionalId}
          initialPatient={patient}
          cancelHref={
            patient && !params.date
              ? `/patients/${patient.id}`
              : `/?date=${initialDate}`
          }
        />
      </Card>
    </>
  );
}

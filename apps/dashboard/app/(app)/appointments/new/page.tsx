import {
  addDays,
  isValidDate,
  isValidTime,
  todayInMadrid,
} from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { Alert } from "@clinicalumia/ui/alert";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import type { Metadata } from "next";
import { isUuid } from "@/lib/agenda";
import { loadNoticeRecipients } from "@/lib/appointment-notice";
import { loadClosures } from "@/lib/closures";
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
      <Alert data-testid="appointment-form-error">
        No se han podido cargar los datos del formulario.
      </Alert>
    );
  }

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
    return (
      <Alert data-testid="appointment-form-error">
        No se han podido cargar los datos del formulario.
      </Alert>
    );
  }

  const initialCanNotify = patient
    ? (await loadNoticeRecipients(supabase, patient.id)).length > 0
    : false;

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
      <PageHeader
        breadcrumbs={
          patient && !params.date
            ? [
                { label: "Pacientes", href: "/patients" },
                {
                  label: `${patient.first_name} ${patient.last_name}`,
                  href: `/patients/${patient.id}`,
                },
                { label: "Nueva cita" },
              ]
            : [
                { label: "Agenda", href: `/?date=${initialDate}` },
                { label: "Nueva cita" },
              ]
        }
        title="Nueva cita"
      />
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
          initialCanNotify={initialCanNotify}
          closures={closures}
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

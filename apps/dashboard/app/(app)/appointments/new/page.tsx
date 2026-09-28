import {
  isValidDate,
  isValidTime,
  todayInMadrid,
} from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { isUuid } from "@/lib/agenda";
import { AppointmentForm } from "../AppointmentForm";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    time?: string;
    professional?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("id, role, specialty_id")
    .eq("id", user.id)
    .single();
  if (!ownProfile) return null;

  const [{ data: directory }, { data: services }] = await Promise.all([
    supabase.rpc("staff_directory"),
    supabase
      .from("services")
      .select("id, name, duration_minutes, specialty_id")
      .eq("is_active", true)
      .order("name"),
  ]);

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
        />
      </Card>
    </>
  );
}

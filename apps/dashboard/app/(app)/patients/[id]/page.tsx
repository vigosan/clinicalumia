import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { ageOn, isMinor } from "@clinicalumia/api/person";
import { createClient } from "@clinicalumia/api/server";
import { Badge } from "@clinicalumia/ui/badge";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { notFound } from "next/navigation";
import { guardianErrorMessage } from "@/lib/guardian-error";
import type { PatientAppointmentSource } from "@/lib/patient-appointments";
import { splitPatientAppointments } from "@/lib/patient-appointments";
import { GuardiansSection } from "./GuardiansSection";
import { PatientAppointments } from "./PatientAppointments";
import { PersonActions } from "./PersonActions";

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ guardianError?: string }>;
}) {
  const { id } = await params;
  const { guardianError } = await searchParams;
  const supabase = await createClient();

  const { data: person, error: personError } = await supabase
    .from("people")
    .select(
      "id, first_name, last_name, birth_date, tax_id, email, phone, address, admin_notes, is_patient, archived_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (personError) {
    return (
      <Card role="alert" className="text-center text-sm text-danger-600">
        No se ha podido cargar la ficha. Recarga la página.
      </Card>
    );
  }
  if (!person) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const isOwner = profile?.role === "owner";

  const today = todayInMadrid();
  const minor = person.birth_date ? isMinor(person.birth_date, today) : false;

  const { data: guardianRows, error: guardianRowsError } = await supabase
    .from("guardianships")
    .select("guardian_id, relationship, is_primary")
    .eq("minor_id", id);
  const guardianIds = (guardianRows ?? []).map((row) => row.guardian_id);
  const { data: guardianPeople, error: guardianPeopleError } =
    guardianIds.length > 0
      ? await supabase
          .from("people")
          .select("id, first_name, last_name")
          .in("id", guardianIds)
      : { data: [], error: null };
  const guardians = (guardianRows ?? []).map((row) => {
    const guardianPerson = guardianPeople?.find(
      (p) => p.id === row.guardian_id,
    );
    return {
      id: row.guardian_id,
      name: guardianPerson
        ? `${guardianPerson.first_name} ${guardianPerson.last_name}`
        : "—",
      relationship: row.relationship,
      isPrimary: row.is_primary,
    };
  });

  const { data: wardRows, error: wardRowsError } = await supabase
    .from("guardianships")
    .select("minor_id, relationship, is_primary")
    .eq("guardian_id", id);
  const wardIds = (wardRows ?? []).map((row) => row.minor_id);
  const { data: wardPeople, error: wardPeopleError } =
    wardIds.length > 0
      ? await supabase
          .from("people")
          .select("id, first_name, last_name")
          .in("id", wardIds)
      : { data: [], error: null };
  const wards = (wardRows ?? []).map((row) => {
    const wardPerson = wardPeople?.find((p) => p.id === row.minor_id);
    return {
      id: row.minor_id,
      name: wardPerson
        ? `${wardPerson.first_name} ${wardPerson.last_name}`
        : "—",
      relationship: row.relationship,
      isPrimary: row.is_primary,
    };
  });

  const guardianDataError = Boolean(
    guardianRowsError ||
      guardianPeopleError ||
      wardRowsError ||
      wardPeopleError,
  );

  const [
    { data: appointmentRows, error: appointmentsError },
    { data: directory, error: directoryError },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, starts_at, status, cancelled_by, professional_id, service:services(name)",
      )
      .eq("patient_id", id),
    supabase.rpc("staff_directory"),
  ]);

  const appointmentsFailed = Boolean(
    appointmentsError ||
      directoryError ||
      (appointmentRows ?? []).some((row) => !row.service),
  );

  const professionalNameById = new Map(
    (directory ?? []).map((member) => [member.id, member.full_name]),
  );

  const appointmentSources: PatientAppointmentSource[] = appointmentsFailed
    ? []
    : (appointmentRows ?? []).map((row) => ({
        id: row.id,
        startsAt: row.starts_at,
        serviceName: row.service?.name ?? "—",
        professionalName:
          professionalNameById.get(row.professional_id) ?? "Profesional",
        status: row.status,
        cancelledBy: row.cancelled_by,
      }));

  const { upcoming, upcomingTruncated, past, pastTruncated } =
    splitPatientAppointments(appointmentSources, new Date());

  return (
    <>
      <PageHeader
        title={`${person.first_name} ${person.last_name}`}
        description={
          person.birth_date
            ? `${ageOn(person.birth_date, today)} años`
            : undefined
        }
        actions={
          <PersonActions
            personId={id}
            isArchived={Boolean(person.archived_at)}
            isOwner={isOwner}
          />
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        {minor && <Badge tone="warning">Menor</Badge>}
        {minor && !guardianDataError && guardians.length === 0 && (
          <Badge tone="warning" data-testid="patient-no-guardian">
            Menor sin tutor
          </Badge>
        )}
        {person.archived_at && <Badge tone="neutral">Archivada</Badge>}
      </div>
      {guardianDataError && (
        <Card
          role="alert"
          data-testid="guardian-load-error"
          className="text-center text-sm text-danger-600"
        >
          No se han podido cargar los tutores. Recarga la página.
        </Card>
      )}

      <Card className="flex flex-col gap-2">
        <p>
          <strong>DNI/NIE:</strong> {person.tax_id ?? "—"}
        </p>
        <p>
          <strong>Email:</strong> {person.email ?? "—"}
        </p>
        <p>
          <strong>Teléfono:</strong> {person.phone ?? "—"}
        </p>
        <p>
          <strong>Dirección:</strong> {person.address || "—"}
        </p>
        {person.admin_notes && (
          <p>
            <strong>Notas:</strong> {person.admin_notes}
          </p>
        )}
      </Card>

      <GuardiansSection
        personId={id}
        isMinorPerson={minor}
        guardians={guardians}
        wards={wards}
        initialError={guardianErrorMessage(guardianError)}
      />

      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-ink-900">Historial</h2>
        <PatientAppointments
          error={appointmentsFailed}
          upcoming={upcoming}
          upcomingTruncated={upcomingTruncated}
          past={past}
          pastTruncated={pastTruncated}
        />
      </Card>
    </>
  );
}

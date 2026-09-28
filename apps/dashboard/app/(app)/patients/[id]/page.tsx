import { createClient } from "@clinicalumia/api/server";
import { Badge } from "@clinicalumia/ui/badge";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { notFound } from "next/navigation";
import { ageOn, isMinor, todayInMadrid } from "@/lib/person";
import { GuardiansSection } from "./GuardiansSection";
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

  const { data: person } = await supabase
    .from("people")
    .select(
      "id, first_name, last_name, birth_date, tax_id, email, phone, address, admin_notes, is_patient, archived_at",
    )
    .eq("id", id)
    .maybeSingle();
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

  const { data: guardianRows } = await supabase
    .from("guardianships")
    .select("guardian_id, relationship, is_primary")
    .eq("minor_id", id);
  const guardianIds = (guardianRows ?? []).map((row) => row.guardian_id);
  const { data: guardianPeople } =
    guardianIds.length > 0
      ? await supabase
          .from("people")
          .select("id, first_name, last_name")
          .in("id", guardianIds)
      : { data: [] };
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

  const { data: wardRows } = await supabase
    .from("guardianships")
    .select("minor_id, relationship, is_primary")
    .eq("guardian_id", id);
  const wardIds = (wardRows ?? []).map((row) => row.minor_id);
  const { data: wardPeople } =
    wardIds.length > 0
      ? await supabase
          .from("people")
          .select("id, first_name, last_name")
          .in("id", wardIds)
      : { data: [] };
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
        {minor && guardians.length === 0 && (
          <Badge tone="warning" data-testid="patient-no-guardian">
            Menor sin tutor
          </Badge>
        )}
        {person.archived_at && <Badge tone="neutral">Archivada</Badge>}
      </div>

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
        initialError={guardianError}
      />

      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-ink-900">Historial</h2>
        <p className="text-sm text-ink-800">
          Aquí aparecerán sus citas, cobros y facturas.
        </p>
      </Card>
    </>
  );
}

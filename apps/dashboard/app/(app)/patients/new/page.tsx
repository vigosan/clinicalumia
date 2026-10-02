import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import type { Metadata } from "next";
import { isUuid } from "@/lib/agenda";
import { newPersonBreadcrumbs } from "@/lib/breadcrumbs";
import { type ConsentPrefill, PersonForm } from "../PersonForm";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ guardianOf?: string; consentimiento?: string }>;
}): Promise<Metadata> {
  const { guardianOf, consentimiento } = await searchParams;
  if (guardianOf && UUID_REGEX.test(guardianOf))
    return { title: "Nuevo tutor/a" };
  if (consentimiento && isUuid(consentimiento)) return { title: "Crear ficha" };
  return { title: "Nuevo paciente" };
}

export default async function NewPersonPage({
  searchParams,
}: {
  searchParams: Promise<{
    guardianOf?: string;
    returnTo?: string;
    consentimiento?: string;
  }>;
}) {
  const { guardianOf, returnTo, consentimiento } = await searchParams;
  const minorId = guardianOf && UUID_REGEX.test(guardianOf) ? guardianOf : null;

  let guardianOfProp: { id: string; minorName: string } | undefined;
  if (minorId) {
    const supabase = await createClient();
    const { data: minor } = await supabase
      .from("people")
      .select("first_name, last_name")
      .eq("id", minorId)
      .maybeSingle();
    if (minor) {
      guardianOfProp = {
        id: minorId,
        minorName: `${minor.first_name} ${minor.last_name}`,
      };
    }
  }

  let consent: ConsentPrefill | undefined;
  if (consentimiento && isUuid(consentimiento)) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("consents")
      .select(
        "id, first_name, last_name, birth_date, tax_id, guardian_tax_id, email, guardian_name",
      )
      .eq("id", consentimiento)
      .is("person_id", null)
      .maybeSingle();
    consent = data ?? undefined;
  }

  const supabase = await createClient();
  const { data: isOwner } = await supabase.rpc("is_owner");

  const title = guardianOfProp
    ? "Nuevo tutor/a"
    : consent
      ? "Crear ficha desde consentimiento"
      : "Nuevo paciente";

  return (
    <>
      <PageHeader
        breadcrumbs={newPersonBreadcrumbs({
          minor: guardianOfProp && {
            id: guardianOfProp.id,
            name: guardianOfProp.minorName,
          },
          returnTo,
          consent: consent && {
            id: consent.id,
            name: `${consent.first_name} ${consent.last_name}`,
          },
        })}
        title={title}
        description={
          guardianOfProp ? `Tutor/a de ${guardianOfProp.minorName}` : undefined
        }
      />
      <Card>
        <PersonForm
          guardianOf={guardianOfProp}
          returnTo={returnTo}
          consent={consent}
          isOwner={isOwner === true}
        />
      </Card>
    </>
  );
}

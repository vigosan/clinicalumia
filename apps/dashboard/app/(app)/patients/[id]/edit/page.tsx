import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PersonForm } from "../../PersonForm";

export const metadata: Metadata = { title: "Editar ficha" };

export default async function EditPersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: person } = await supabase
    .from("people")
    .select(
      "id, first_name, last_name, birth_date, tax_id, email, phone, address, admin_notes, is_patient",
    )
    .eq("id", id)
    .maybeSingle();
  if (!person) notFound();
  const { data: isOwner } = await supabase.rpc("is_owner");

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Pacientes", href: "/patients" },
          {
            label: `${person.first_name} ${person.last_name}`,
            href: `/patients/${person.id}`,
          },
          { label: "Editar" },
        ]}
        title="Editar ficha"
        description={`${person.first_name} ${person.last_name}`}
      />
      <Card>
        <PersonForm person={person} isOwner={isOwner === true} />
      </Card>
    </>
  );
}

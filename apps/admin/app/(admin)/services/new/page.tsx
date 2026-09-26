import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { ServiceForm } from "../ServiceForm";

export default async function NewServicePage() {
  const supabase = await createClient();
  const { data: specialties } = await supabase
    .from("specialties")
    .select("id, name")
    .order("name");
  return (
    <>
      <PageHeader title="Nuevo servicio" />
      <Card>
        <ServiceForm specialties={specialties ?? []} />
      </Card>
    </>
  );
}

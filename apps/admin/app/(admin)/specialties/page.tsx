import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { EmptyState } from "@clinicalumia/ui/empty-state";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { NewSpecialty } from "./NewSpecialty";
import { SpecialtyRow } from "./SpecialtyRow";

export default async function SpecialtiesPage() {
  const supabase = await createClient();
  const { data: specialties } = await supabase
    .from("specialties")
    .select("id, name, slug")
    .order("name", { ascending: true });

  const list = specialties ?? [];

  return (
    <>
      <PageHeader
        title="Especialidades"
        description="Catálogo de especialidades. Se asignan a cada empleado al darlo de alta."
        actions={<NewSpecialty />}
      />
      {list.length === 0 ? (
        <EmptyState title="Aún no hay especialidades. Crea la primera con «Nueva especialidad»." />
      ) : (
        <Card className="p-2">
          <ul>
            {list.map((specialty) => (
              <SpecialtyRow key={specialty.id} specialty={specialty} />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

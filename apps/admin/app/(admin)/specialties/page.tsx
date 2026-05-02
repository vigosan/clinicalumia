import { createClient } from "@clinicalumia/api/server";
import { CreateForm } from "./CreateForm";
import { SpecialtyRow } from "./SpecialtyRow";

export default async function SpecialtiesPage() {
  const supabase = await createClient();
  const { data: specialties } = await supabase
    .from("specialties")
    .select("id, name, slug")
    .order("name", { ascending: true });

  const list = specialties ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Especialidades</h1>
        <p className="text-sm text-slate-500">
          Catálogo de especialidades clínicas. Se asignan a los médicos al darlos de alta.
        </p>
      </header>

      <CreateForm />

      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Aún no hay especialidades. Crea la primera arriba.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((specialty) => (
            <SpecialtyRow key={specialty.id} specialty={specialty} />
          ))}
        </ul>
      )}
    </div>
  );
}

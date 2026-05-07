import { createClient } from "@clinicalumia/api/server";
import { CreateForm } from "./CreateForm";
import { MemberRow } from "./MemberRow";

export default async function TeamPage() {
  const supabase = await createClient();

  const [{ data: members }, { data: specialties }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, specialty_id, is_active, role")
      .eq("role", "doctor")
      .order("full_name", { ascending: true }),
    supabase
      .from("specialties")
      .select("id, name")
      .order("name", { ascending: true }),
  ]);

  const memberList = members ?? [];
  const specialtyList = specialties ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Equipo</h1>
        <p className="text-sm text-slate-500">
          Médicos y personal con acceso al dashboard. Al invitar a alguien
          recibirá un email para fijar su contraseña.
        </p>
      </header>

      <CreateForm specialties={specialtyList} />

      {memberList.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Aún no hay médicos en el equipo. Invita al primero arriba.
        </p>
      ) : (
        <ul className="space-y-2">
          {memberList.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              specialties={specialtyList}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

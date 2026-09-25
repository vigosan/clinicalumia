import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { CreateForm } from "./CreateForm";
import { MemberRow } from "./MemberRow";

export default async function TeamPage() {
  const supabase = await createClient();

  const [{ data: members }, { data: specialties }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, specialty_id, is_active, role")
      .eq("role", "employee")
      .order("full_name", { ascending: true }),
    supabase
      .from("specialties")
      .select("id, name")
      .order("name", { ascending: true }),
  ]);

  const memberList = members ?? [];
  const specialtyList = specialties ?? [];

  return (
    <>
      <PageHeader
        title="Equipo"
        description="Empleados con acceso al dashboard. Al invitar a alguien recibirá un email para crear su contraseña."
      />
      <Card>
        <CreateForm specialties={specialtyList} />
      </Card>
      {memberList.length === 0 ? (
        <Card className="text-center text-sm text-ink-800">
          Aún no hay empleados. Invita al primero arriba.
        </Card>
      ) : (
        <Card className="p-2">
          <ul>
            {memberList.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                specialties={specialtyList}
              />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

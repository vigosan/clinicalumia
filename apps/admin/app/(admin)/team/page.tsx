import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { EmptyState } from "@clinicalumia/ui/empty-state";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { CreateForm } from "./CreateForm";
import { MemberRow } from "./MemberRow";

export default async function TeamPage() {
  const supabase = await createClient();

  const [{ data: members }, { data: specialties }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, email, full_name, specialty_id, is_active, role, license_number",
      )
      .order("role", { ascending: true })
      .order("full_name", { ascending: true }),
    supabase
      .from("specialties")
      .select("id, name")
      .order("name", { ascending: true }),
  ]);

  const memberList = members ?? [];
  const specialtyList = specialties ?? [];
  const hasEmployees = memberList.some((member) => member.role === "employee");

  return (
    <>
      <PageHeader
        title="Equipo"
        description="Empleados con acceso al dashboard. Al invitar a alguien recibirá un email para crear su contraseña."
      />
      <Card>
        <CreateForm specialties={specialtyList} />
      </Card>
      {!hasEmployees && (
        <EmptyState title="Aún no hay empleados. Invita al primero arriba." />
      )}
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
    </>
  );
}

import { createClient } from "@clinicalumia/api/server";
import { PageHeader } from "@clinicalumia/ui/page-header";

export default async function DashboardHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, specialty_id")
    .eq("id", user!.id)
    .single();

  let specialtyName: string | null = null;
  if (profile?.specialty_id) {
    const { data: specialty } = await supabase
      .from("specialties")
      .select("name")
      .eq("id", profile.specialty_id)
      .single();
    specialtyName = specialty?.name ?? null;
  }

  const greeting = profile?.role === "owner" ? "Bienvenida" : "Hola";

  return (
    <PageHeader
      title={`${greeting}, ${profile?.full_name ?? ""}`}
      description={
        specialtyName
          ? `Tu especialidad es ${specialtyName}.`
          : "Aún no tienes una especialidad asignada."
      }
    />
  );
}

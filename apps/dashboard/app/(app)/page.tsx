import { createClient } from "@clinicalumia/api/server";

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
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold text-slate-900">
        {greeting}, {profile?.full_name ?? "doctora"}
      </h1>
      <p className="text-slate-600">
        {specialtyName
          ? `Tu especialidad es ${specialtyName}.`
          : "Aún no tienes una especialidad asignada."}
      </p>
    </div>
  );
}

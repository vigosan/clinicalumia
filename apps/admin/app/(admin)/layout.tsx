import { createClient } from "@clinicalumia/api/server";
import { AppShell } from "@clinicalumia/ui/app-shell";
import { Button } from "@clinicalumia/ui/button";
import logo from "@clinicalumia/ui/logo-dark.png";
import Image from "next/image";
import { redirect } from "next/navigation";
import { logout } from "./actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, is_active")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "owner" || !profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <AppShell
      logo={
        <Image
          src={logo}
          alt="LUMIA · Clínica Logopedia miofuncional"
          width={150}
          priority
        />
      }
      section="Administración"
      nav={[
        { href: "/", label: "Inicio" },
        { href: "/specialties", label: "Especialidades" },
        { href: "/team", label: "Equipo" },
      ]}
      user={{ name: profile.full_name, detail: "Propietaria" }}
      logout={
        <form action={logout}>
          <Button type="submit" variant="ghost" size="sm" data-testid="logout">
            Salir
          </Button>
        </form>
      }
    >
      {children}
    </AppShell>
  );
}

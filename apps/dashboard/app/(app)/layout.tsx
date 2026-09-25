import { createClient } from "@clinicalumia/api/server";
import { AppShell } from "@clinicalumia/ui/app-shell";
import { Button } from "@clinicalumia/ui/button";
import logo from "@clinicalumia/ui/logo-dark.png";
import Image from "next/image";
import { redirect } from "next/navigation";
import { logout } from "./actions";

export default async function DashboardLayout({
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
    .select("full_name, is_active, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.is_active === false) {
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
      section="Clínica"
      nav={[{ href: "/", label: "Inicio" }]}
      user={{
        name: profile.full_name,
        detail: profile.role === "owner" ? "Propietaria" : "Empleado",
      }}
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

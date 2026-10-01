import { createClient } from "@clinicalumia/api/server";
import { AppShell } from "@clinicalumia/ui/app-shell";
import logo from "@clinicalumia/ui/logo-dark.png";
import { Toaster } from "@clinicalumia/ui/toast";
import { CalendarDays } from "lucide-react";
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
    <>
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
        nav={[
          { href: "/", label: "Agenda", match: ["/appointments"] },
          { href: "/patients", label: "Pacientes" },
          { href: "/consentimientos", label: "Consentimientos" },
          { href: "/cobros", label: "Cobros" },
          { href: "/facturas", label: "Facturas" },
        ]}
        user={{
          name: profile.full_name,
          detail: profile.role === "owner" ? "Propietaria" : "Equipo",
        }}
        menu={[
          {
            href: "/mi-calendario",
            label: "Ver citas en mi móvil",
            icon: <CalendarDays aria-hidden="true" />,
            testId: "user-menu-calendar",
          },
        ]}
        logout={logout}
      >
        {children}
      </AppShell>
      <Toaster />
    </>
  );
}

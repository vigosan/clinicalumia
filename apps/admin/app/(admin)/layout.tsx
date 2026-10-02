import { createClient } from "@clinicalumia/api/server";
import { AppShell } from "@clinicalumia/ui/app-shell";
import logo from "@clinicalumia/ui/logo-dark.png";
import { Toaster } from "@clinicalumia/ui/toast";
import {
  Building2,
  CalendarOff,
  Clock,
  House,
  Receipt,
  Shapes,
  Tag,
  Users,
} from "lucide-react";
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
        section="Administración"
        nav={[
          { href: "/", label: "Inicio", icon: <House /> },
          { href: "/team", label: "Equipo", icon: <Users /> },
          { href: "/specialties", label: "Especialidades", icon: <Shapes /> },
          { href: "/services", label: "Servicios", icon: <Tag /> },
          { href: "/schedules", label: "Horarios", icon: <Clock /> },
          { href: "/closures", label: "Días de cierre", icon: <CalendarOff /> },
          {
            href: "/clinic",
            label: "Datos de la clínica",
            icon: <Building2 />,
          },
          { href: "/facturacion", label: "Facturación", icon: <Receipt /> },
        ]}
        user={{ name: profile.full_name, detail: "Propietaria" }}
        logout={logout}
      >
        {children}
      </AppShell>
      <Toaster />
    </>
  );
}

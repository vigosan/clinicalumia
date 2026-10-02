import { createClient } from "@clinicalumia/api/server";
import { AppShell } from "@clinicalumia/ui/app-shell";
import logo from "@clinicalumia/ui/logo-dark.png";
import { Toaster } from "@clinicalumia/ui/toast";
import {
  CalendarDays,
  FileSignature,
  ReceiptText,
  Users,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { loadNavCounts } from "@/lib/nav-counts";
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

  const counts = await loadNavCounts(supabase, new Date());

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
          {
            href: "/",
            label: "Agenda",
            match: ["/appointments"],
            icon: <CalendarDays />,
          },
          { href: "/patients", label: "Pacientes", icon: <Users /> },
          {
            href: "/consentimientos",
            label: "Consentimientos",
            icon: <FileSignature />,
            count: counts.consentimientos,
          },
          {
            href: "/cobros",
            label: "Cobros",
            icon: <Wallet />,
            count: counts.cobros,
          },
          { href: "/facturas", label: "Facturas", icon: <ReceiptText /> },
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

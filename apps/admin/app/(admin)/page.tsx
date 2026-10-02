import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { Alert } from "@clinicalumia/ui/alert";
import { Button } from "@clinicalumia/ui/button";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import Link from "next/link";
import { pendingSetup } from "@/lib/pending-setup";

const sections = [
  {
    href: "/team",
    title: "Equipo",
    text: "Empleados con acceso al dashboard.",
    testId: "home-card-team",
  },
  {
    href: "/specialties",
    title: "Especialidades",
    text: "Catálogo de especialidades de la clínica.",
    testId: "home-card-specialties",
  },
  {
    href: "/services",
    title: "Servicios",
    text: "Duración, precio, IVA y qué se paga al reservar.",
    testId: "home-card-services",
  },
  {
    href: "/schedules",
    title: "Horarios",
    text: "Horario semanal de cada persona del equipo y sus ausencias.",
    testId: "home-card-schedules",
  },
  {
    href: "/clinic",
    title: "Datos de la clínica",
    text: "Datos de facturación y condiciones de reserva.",
    testId: "home-card-clinic",
  },
  {
    href: "/facturacion",
    title: "Facturación",
    text: "Totales del trimestre y libro de facturas para la gestoría.",
    testId: "home-card-billing",
  },
];

export default async function AdminHome() {
  const supabase = await createClient();
  const year = Number(todayInMadrid().slice(0, 4));
  const [
    { data: settings },
    { data: series },
    { count: activeServiceCount },
    { data: professionals },
    { data: schedules },
  ] = await Promise.all([
    supabase
      .from("clinic_settings")
      .select("legal_name, tax_id, address_line, postal_code, city")
      .single(),
    supabase
      .from("invoice_series")
      .select("code, year, configured")
      .lte("year", year),
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .not("specialty_id", "is", null)
      .order("full_name"),
    supabase.from("employee_schedules").select("profile_id"),
  ]);
  const scheduled = new Set((schedules ?? []).map((row) => row.profile_id));
  const pending = pendingSetup({
    settings: settings!,
    series: series ?? [],
    year,
    activeServiceCount: activeServiceCount ?? 0,
    professionalsWithoutSchedule: (professionals ?? []).filter(
      (professional) => !scheduled.has(professional.id),
    ),
  });

  return (
    <>
      <PageHeader
        title="Bienvenida"
        description="Configura la clínica desde aquí."
      />
      {pending.length > 0 ? (
        <Alert
          tone="warning"
          title="Pendiente de configurar"
          data-testid="pending-setup"
        >
          <ul className="mt-1 flex flex-col gap-1.5">
            {pending.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  data-testid={`pending-${item.id}`}
                  className="underline underline-offset-2"
                >
                  {item.text}
                </Link>
              </li>
            ))}
          </ul>
        </Alert>
      ) : (
        <p data-testid="pending-none" className="text-[15px] text-ink-800">
          Todo listo: la clínica puede dar citas, cobrar y facturar.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.href} className="flex flex-col gap-1.5">
            <h2 className="text-lg font-bold text-ink-900">{section.title}</h2>
            <p className="text-sm text-ink-800">{section.text}</p>
            <Button asChild variant="secondary" size="sm" className="w-fit">
              <Link href={section.href} data-testid={section.testId}>
                Ir a {section.title}
              </Link>
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}

import { Button } from "@clinicalumia/ui/button";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import Link from "next/link";

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
];

export default function AdminHome() {
  return (
    <>
      <PageHeader
        title="Bienvenida"
        description="Configura la clínica desde aquí."
      />
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

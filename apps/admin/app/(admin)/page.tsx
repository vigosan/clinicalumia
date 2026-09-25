import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import Link from "next/link";

const sections = [
  {
    href: "/specialties",
    title: "Especialidades",
    text: "Catálogo de especialidades de la clínica.",
  },
  {
    href: "/team",
    title: "Equipo",
    text: "Empleados con acceso al dashboard.",
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
          <Link
            key={section.href}
            href={section.href}
            className="rounded-card transition-colors focus-visible:outline-2 focus-visible:outline-sage-800"
          >
            <Card className="flex h-full flex-col gap-1.5 hover:bg-sage-100">
              <h2 className="text-lg font-bold text-ink-900">
                {section.title}
              </h2>
              <p className="text-sm text-ink-800">{section.text}</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}

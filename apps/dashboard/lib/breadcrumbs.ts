import { isValidDate } from "@clinicalumia/api/madrid-time";
import { safeNext } from "@clinicalumia/api/route";
import type { Crumb } from "@clinicalumia/ui/breadcrumbs";

type Linked = { id: string; name: string };

export function newPersonBreadcrumbs({
  minor,
  returnTo,
  consent,
}: {
  minor?: Linked;
  returnTo?: string;
  consent?: Linked;
}): Crumb[] {
  if (minor) {
    return [
      { label: "Pacientes", href: "/patients" },
      { label: minor.name, href: `/patients/${minor.id}` },
      { label: "Nuevo tutor/a" },
    ];
  }
  if (consent) {
    return [
      { label: "Consentimientos", href: "/consentimientos" },
      { label: consent.name, href: `/consentimientos/${consent.id}` },
      { label: "Crear ficha" },
    ];
  }
  const appointment = safeNext(returnTo ?? null);
  if (appointment.startsWith("/appointments/new")) {
    const date = new URLSearchParams(appointment.split("?")[1]).get("date");
    return [
      {
        label: "Agenda",
        href: date && isValidDate(date) ? `/?date=${date}` : "/",
      },
      { label: "Nueva cita", href: appointment },
      { label: "Nuevo paciente" },
    ];
  }
  return [
    { label: "Pacientes", href: "/patients" },
    { label: "Nuevo paciente" },
  ];
}

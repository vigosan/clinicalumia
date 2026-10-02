import { invoiceSetupWarnings } from "./invoice-series";

export type PendingItem = { id: string; text: string; href: string };

export function pendingSetup({
  activeServiceCount,
  professionalsWithoutSchedule,
  ...invoicing
}: Parameters<typeof invoiceSetupWarnings>[0] & {
  activeServiceCount: number;
  professionalsWithoutSchedule: { id: string; full_name: string }[];
}): PendingItem[] {
  const items: PendingItem[] = invoiceSetupWarnings(invoicing).map(
    (warning) => ({ ...warning, href: "/clinic" }),
  );
  if (activeServiceCount === 0)
    items.push({
      id: "services-warning",
      text: "No hay ningún servicio activo: no se pueden dar citas ni reservar desde la web.",
      href: "/services",
    });
  for (const professional of professionalsWithoutSchedule)
    items.push({
      id: `schedule-warning-${professional.id}`,
      text: `${professional.full_name} no tiene horario semanal: no tendrá huecos en la agenda ni en la web.`,
      href: `/schedules?employee=${professional.id}`,
    });
  return items;
}

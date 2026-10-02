"use client";

import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { Alert } from "@clinicalumia/ui/alert";
import { Drawer } from "@clinicalumia/ui/drawer";
import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import { appointmentFormInitials } from "@/lib/agenda";
import { AppointmentForm } from "../appointments/AppointmentForm";
import { showUrl } from "../url-drawer";

export function NewAppointmentDrawer({
  closeHref,
  form,
}: {
  closeHref: string;
  form: Omit<ComponentProps<typeof AppointmentForm>, "cancelHref"> | null;
}) {
  const searchParams = useSearchParams();
  const open = searchParams.get("new") === "1";
  const patientId = searchParams.get("patient");
  const samePatient =
    form?.initialPatient != null && form.initialPatient.id === patientId;

  function handleOpenChange(next: boolean) {
    if (next) return;
    showUrl(closeHref);
  }

  return (
    <Drawer
      open={open}
      onOpenChange={handleOpenChange}
      data-testid="new-appointment-drawer"
      description="Elige paciente, servicio y hora."
      title="Nueva cita"
    >
      {form ? (
        <AppointmentForm
          {...form}
          {...appointmentFormInitials(
            {
              date: searchParams.get("date") ?? undefined,
              time: searchParams.get("time") ?? undefined,
              professional: searchParams.get("professional") ?? undefined,
            },
            form.professionals,
            todayInMadrid(),
          )}
          initialPatient={samePatient ? form.initialPatient : null}
          initialCanNotify={samePatient && form.initialCanNotify}
        />
      ) : (
        <Alert data-testid="appointment-form-error">
          No se han podido cargar los datos del formulario.
        </Alert>
      )}
    </Drawer>
  );
}

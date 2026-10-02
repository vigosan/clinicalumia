import { Alert } from "@clinicalumia/ui/alert";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { newAppointmentDrawerHref } from "@/lib/agenda";
import { AppointmentForm } from "../AppointmentForm";
import { type AppointmentFormParams, loadAppointmentForm } from "../load-form";

export const metadata: Metadata = { title: "Nueva cita" };

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<AppointmentFormParams>;
}) {
  const params = await searchParams;
  if (params.date || !params.patient) {
    redirect(newAppointmentDrawerHref(params));
  }

  const result = await loadAppointmentForm(params);
  if (!result) return null;
  if (!result.ok) {
    return (
      <Alert data-testid="appointment-form-error">
        No se han podido cargar los datos del formulario.
      </Alert>
    );
  }

  const { patient, form } = result;

  return (
    <>
      <PageHeader
        breadcrumbs={
          patient
            ? [
                { label: "Pacientes", href: "/patients" },
                {
                  label: `${patient.first_name} ${patient.last_name}`,
                  href: `/patients/${patient.id}`,
                },
                { label: "Nueva cita" },
              ]
            : [
                { label: "Agenda", href: `/?date=${form.initialDate}` },
                { label: "Nueva cita" },
              ]
        }
        title="Nueva cita"
      />
      <Card>
        <AppointmentForm
          {...form}
          cancelHref={
            patient ? `/patients/${patient.id}` : `/?date=${form.initialDate}`
          }
        />
      </Card>
    </>
  );
}

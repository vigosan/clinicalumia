import { formatDay } from "@clinicalumia/api/madrid-time";
import { Button } from "@clinicalumia/ui/button";
import { eyebrowClass } from "@clinicalumia/ui/page-header";
import Link from "next/link";
import type { PatientAppointmentRow } from "@/lib/patient-appointments";

function AppointmentList({
  title,
  rows,
  truncated,
  truncatedMessage,
}: {
  title: string;
  rows: PatientAppointmentRow[];
  truncated: boolean;
  truncatedMessage: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className={eyebrowClass}>{title}</h3>
      <ul className="flex flex-col divide-y divide-line">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={row.href}
              data-testid="patient-appointment"
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 -mx-3 rounded-field px-3 py-3 text-[15px] text-ink-900 hover:bg-cream-50"
            >
              <span>
                {formatDay(row.date)} {row.time} · {row.serviceName} ·{" "}
                {row.professionalName}
              </span>
              <span className="text-[13px] text-ink-800">
                {row.statusLabel}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {truncated && (
        <p className="text-[13px] text-ink-800">{truncatedMessage}</p>
      )}
    </div>
  );
}

export function PatientAppointments({
  error,
  upcoming,
  upcomingTruncated,
  past,
  pastTruncated,
  newAppointmentHref,
}: {
  error: boolean;
  upcoming: PatientAppointmentRow[];
  upcomingTruncated: boolean;
  past: PatientAppointmentRow[];
  pastTruncated: boolean;
  newAppointmentHref: string | null;
}) {
  if (error) {
    return (
      <p
        role="alert"
        data-testid="patient-appointments-error"
        className="text-[13px] text-danger-600"
      >
        No se han podido cargar las citas. Recarga la página.
      </p>
    );
  }

  if (upcoming.length === 0 && past.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-ink-800">Todavía no tiene citas.</p>
        {newAppointmentHref && (
          <Button
            asChild
            variant="secondary"
            data-testid="patient-new-appointment"
          >
            <Link href={newAppointmentHref}>Nueva cita</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AppointmentList
        title="Próximas"
        rows={upcoming}
        truncated={upcomingTruncated}
        truncatedMessage="Se muestran solo las 20 más próximas."
      />
      <AppointmentList
        title="Pasadas"
        rows={past}
        truncated={pastTruncated}
        truncatedMessage="Se muestran solo las 20 más recientes."
      />
    </div>
  );
}

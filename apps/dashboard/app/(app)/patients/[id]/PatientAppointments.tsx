import Link from "next/link";
import type { PatientAppointmentRow } from "@/lib/patient-appointments";

function formatDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

function AppointmentList({
  title,
  rows,
  truncated,
}: {
  title: string;
  rows: PatientAppointmentRow[];
  truncated: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-ink-700 uppercase tracking-[0.08em]">
        {title}
      </h3>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={row.href}
              data-testid="patient-appointment"
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border border-line px-3 py-2 text-[15px] text-ink-900 hover:bg-cream-200"
            >
              <span>
                {formatDate(row.date)} {row.time} · {row.serviceName} ·{" "}
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
        <p className="text-[13px] text-ink-800">
          Se muestran solo las 20 más recientes.
        </p>
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
}: {
  error: boolean;
  upcoming: PatientAppointmentRow[];
  upcomingTruncated: boolean;
  past: PatientAppointmentRow[];
  pastTruncated: boolean;
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
      <p className="text-sm text-ink-800">
        Aquí aparecerán sus citas, cobros y facturas.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AppointmentList
        title="Próximas"
        rows={upcoming}
        truncated={upcomingTruncated}
      />
      <AppointmentList title="Pasadas" rows={past} truncated={pastTruncated} />
    </div>
  );
}

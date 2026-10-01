import { madridDateTime } from "@clinicalumia/api/madrid-time";

export type PatientAppointmentStatus = "scheduled" | "cancelled" | "no_show";
export type PatientAppointmentCanceller = "patient" | "clinic" | null;

export type PatientAppointmentSource = {
  id: string;
  startsAt: string;
  serviceName: string;
  professionalName: string;
  status: PatientAppointmentStatus;
  cancelledBy: PatientAppointmentCanceller;
};

export type PatientAppointmentRow = {
  id: string;
  date: string;
  time: string;
  serviceName: string;
  professionalName: string;
  statusLabel: string;
  href: string;
};

const MAX_ROWS = 20;

export function appointmentStatusLabel(
  appointment: Pick<
    PatientAppointmentSource,
    "status" | "cancelledBy" | "startsAt"
  >,
  now: Date,
): string {
  if (appointment.status === "cancelled") {
    return appointment.cancelledBy === "patient"
      ? "Cancelada por el paciente"
      : "Cancelada por la clínica";
  }
  if (appointment.status === "no_show") return "No presentada";
  return new Date(appointment.startsAt).getTime() <= now.getTime()
    ? "Realizada"
    : "Programada";
}

function toRow(
  appointment: PatientAppointmentSource,
  now: Date,
): PatientAppointmentRow {
  const { date, time } = madridDateTime(appointment.startsAt);
  return {
    id: appointment.id,
    date,
    time: time.slice(0, 5),
    serviceName: appointment.serviceName,
    professionalName: appointment.professionalName,
    statusLabel: appointmentStatusLabel(appointment, now),
    href: `/?date=${date}&appointment=${appointment.id}`,
  };
}

export type SplitPatientAppointments = {
  upcoming: PatientAppointmentRow[];
  upcomingTruncated: boolean;
  past: PatientAppointmentRow[];
  pastTruncated: boolean;
};

export function splitPatientAppointments(
  appointments: PatientAppointmentSource[],
  now: Date,
): SplitPatientAppointments {
  const upcoming = appointments
    .filter((a) => new Date(a.startsAt).getTime() > now.getTime())
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  const past = appointments
    .filter((a) => new Date(a.startsAt).getTime() <= now.getTime())
    .sort(
      (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
    );

  return {
    upcoming: upcoming.slice(0, MAX_ROWS).map((a) => toRow(a, now)),
    upcomingTruncated: upcoming.length > MAX_ROWS,
    past: past.slice(0, MAX_ROWS).map((a) => toRow(a, now)),
    pastTruncated: past.length > MAX_ROWS,
  };
}

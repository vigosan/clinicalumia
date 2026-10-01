import { madridDateTime, todayInMadrid } from "@clinicalumia/api/madrid-time";
import {
  formatEuros,
  methodLabel,
  type PaymentMethod,
  paymentStatus,
} from "./payments";

export type PatientAppointmentStatus = "scheduled" | "cancelled" | "no_show";
export type PatientAppointmentCanceller = "patient" | "clinic" | null;

export type PatientPaymentSource = {
  id: string;
  amountCents: number;
  method: PaymentMethod;
  note: string;
  collectedAt: string;
  voidedAt: string | null;
};

export type PatientAppointmentSource = {
  id: string;
  startsAt: string;
  serviceName: string;
  professionalName: string;
  status: PatientAppointmentStatus;
  cancelledBy: PatientAppointmentCanceller;
  payments: PatientPaymentSource[];
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

function activePayment(
  appointment: PatientAppointmentSource,
): PatientPaymentSource | null {
  return (
    appointment.payments.find((payment) => payment.voidedAt === null) ?? null
  );
}

function statusWithPayment(
  appointment: PatientAppointmentSource,
  now: Date,
): string {
  const payment = activePayment(appointment);
  const { label } = paymentStatus({
    appointment: {
      starts_at: appointment.startsAt,
      status: appointment.status,
    },
    payment: payment && {
      amount_cents: payment.amountCents,
      method: payment.method,
      note: payment.note,
    },
    now,
  });
  return [appointmentStatusLabel(appointment, now), label]
    .filter(Boolean)
    .join(" · ");
}

function agendaHref(appointment: PatientAppointmentSource): string {
  const { date } = madridDateTime(appointment.startsAt);
  return `/?date=${date}&appointment=${appointment.id}`;
}

function formatDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
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
    statusLabel: statusWithPayment(appointment, now),
    href: agendaHref(appointment),
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

export function patientAppointmentsToCollect(
  appointments: PatientAppointmentSource[],
  now: Date,
): PatientAppointmentSource[] {
  const today = todayInMadrid(now);
  return appointments
    .filter(
      (appointment) =>
        appointment.status !== "cancelled" &&
        activePayment(appointment) === null &&
        madridDateTime(appointment.startsAt).date <= today,
    )
    .sort(
      (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
    );
}

export type PatientPaymentRow = {
  id: string;
  date: string;
  appointmentDate: string;
  serviceName: string;
  amountLabel: string;
  stateLabel: string;
  voided: boolean;
  href: string;
};

export function patientPaymentRows(appointments: PatientAppointmentSource[]): {
  rows: PatientPaymentRow[];
  truncated: boolean;
} {
  const all = appointments
    .flatMap((appointment) =>
      appointment.payments.map((payment) => ({ appointment, payment })),
    )
    .sort(
      (a, b) =>
        new Date(b.payment.collectedAt).getTime() -
        new Date(a.payment.collectedAt).getTime(),
    );
  return {
    rows: all.slice(0, MAX_ROWS).map(({ appointment, payment }) => ({
      id: payment.id,
      date: formatDate(madridDateTime(payment.collectedAt).date),
      appointmentDate: formatDate(madridDateTime(appointment.startsAt).date),
      serviceName: appointment.serviceName,
      amountLabel: `${formatEuros(payment.amountCents)} · ${methodLabel(payment.method)}`,
      stateLabel: payment.voidedAt ? "Anulado" : "Válido",
      voided: payment.voidedAt !== null,
      href: agendaHref(appointment),
    })),
    truncated: all.length > MAX_ROWS,
  };
}

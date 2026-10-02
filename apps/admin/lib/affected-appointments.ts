import { madridDateTime } from "@clinicalumia/api/madrid-time";
import { formatDay } from "./closures";

export const AFFECTED_APPOINTMENTS_SELECT =
  "id, starts_at, patient:people(first_name, last_name), professional:profiles!appointments_professional_id_fkey(full_name)";

export type AffectedAppointment = {
  id: string;
  date: string;
  time: string;
  patient: string;
  professional: string;
};

export function toAffectedAppointments(
  rows: {
    id: string;
    starts_at: string;
    patient: { first_name: string; last_name: string } | null;
    professional: { full_name: string } | null;
  }[],
): AffectedAppointment[] {
  return rows.map((appointment) => {
    const { date, time } = madridDateTime(appointment.starts_at);
    return {
      id: appointment.id,
      date: formatDay(date),
      time,
      patient: appointment.patient
        ? `${appointment.patient.first_name} ${appointment.patient.last_name}`
        : "",
      professional: appointment.professional?.full_name ?? "",
    };
  });
}

const SHOWN_AFFECTED = 4;

export function firstAffected<T>(items: T[]): { shown: T[]; more: number } {
  return {
    shown: items.slice(0, SHOWN_AFFECTED),
    more: Math.max(items.length - SHOWN_AFFECTED, 0),
  };
}

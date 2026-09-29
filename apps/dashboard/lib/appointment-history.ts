import { madridDateTime } from "@clinicalumia/api/madrid-time";

export type AppointmentEventRow = {
  id: string;
  kind: "created" | "moved" | "cancelled" | "no_show" | "restored";
  previous_starts_at: string | null;
  previous_ends_at: string | null;
  actor_id: string | null;
  actor_kind: "staff" | "patient";
  created_at: string;
};

export type HistoryAppointment = {
  starts_at: string;
  cancelled_by: "patient" | "clinic" | null;
  cancel_reason: string;
};

function formatHistoryMoment(instant: string): string {
  const { date, time } = madridDateTime(instant);
  return `${date.slice(8, 10)}/${date.slice(5, 7)} a las ${time.slice(0, 5)}`;
}

function formatMoveTime(instant: string, includeDate: boolean): string {
  const { date, time } = madridDateTime(instant);
  const hhmm = time.slice(0, 5);
  return includeDate
    ? `${date.slice(8, 10)}/${date.slice(5, 7)} ${hhmm}`
    : hhmm;
}

export function historyLine(
  event: AppointmentEventRow,
  index: number,
  events: AppointmentEventRow[],
  appointment: HistoryAppointment,
  nameById: Map<string, string>,
): string {
  const actorName = event.actor_id
    ? (nameById.get(event.actor_id) ?? "Alguien")
    : "Alguien";
  const moment = formatHistoryMoment(event.created_at);

  if (event.kind === "created") {
    if (event.actor_kind === "patient")
      return `Reservada desde la web el ${moment}`;
    return `Creada por ${actorName} el ${moment}`;
  }

  if (event.kind === "moved") {
    if (event.actor_kind === "patient") {
      const before = formatMoveTime(
        event.previous_starts_at ?? appointment.starts_at,
        true,
      );
      return `Cambiada desde la web el ${moment} (antes: ${before})`;
    }
    const nextMove = events
      .slice(index + 1)
      .find((candidate) => candidate.kind === "moved");
    const toStart = nextMove
      ? (nextMove.previous_starts_at ?? appointment.starts_at)
      : appointment.starts_at;
    const fromStart = event.previous_starts_at ?? toStart;
    const dateChanged =
      madridDateTime(fromStart).date !== madridDateTime(toStart).date;
    return `Movida de ${formatMoveTime(fromStart, dateChanged)} a ${formatMoveTime(toStart, dateChanged)} por ${actorName} el ${moment}`;
  }

  if (event.kind === "cancelled") {
    if (event.actor_kind === "patient")
      return `Cancelada desde la web el ${moment}`;
    const who = appointment.cancelled_by === "patient" ? "paciente" : "clínica";
    const reasonSuffix = appointment.cancel_reason
      ? ` · ${appointment.cancel_reason}`
      : "";
    return `Cancelada (${who}) por ${actorName} el ${moment}${reasonSuffix}`;
  }

  if (event.kind === "no_show")
    return `Marcada como no presentada por ${actorName} el ${moment}`;

  return `Restaurada por ${actorName} el ${moment}`;
}

import {
  madridDateTime,
  madridInstant,
  weekdayOf,
} from "@clinicalumia/api/madrid-time";

export type Block = {
  id: string;
  kind: "own" | "busy" | "time_off";
  professionalId: string;
  start: string;
  end: string;
  label?: string;
};

export type DayLayoutBlock = {
  id: string;
  kind: Block["kind"];
  top: number;
  height: number;
};

function minutesFromFirstHour(
  instant: string,
  date: string,
  firstHour: number,
): number {
  const wall = madridDateTime(instant);
  if (wall.date < date) return -Infinity;
  if (wall.date > date) return Infinity;
  const hours = Number(wall.time.slice(0, 2));
  const minutes = Number(wall.time.slice(3, 5));
  return (hours - firstHour) * 60 + minutes;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function layoutDay(
  blocks: Block[],
  date: string,
  firstHour: number,
  lastHour: number,
): DayLayoutBlock[] {
  const windowMinutes = (lastHour - firstHour) * 60;
  const laidOut: DayLayoutBlock[] = [];
  for (const block of blocks) {
    const top = clamp(
      minutesFromFirstHour(block.start, date, firstHour),
      0,
      windowMinutes,
    );
    const bottom = clamp(
      minutesFromFirstHour(block.end, date, firstHour),
      0,
      windowMinutes,
    );
    if (bottom <= top) continue;
    laidOut.push({ id: block.id, kind: block.kind, top, height: bottom - top });
  }
  return laidOut;
}

export type ScheduleBlock = {
  weekday: number;
  starts_at: string;
  ends_at: string;
};

export function visibleHours(
  schedules: ScheduleBlock[],
  weekday: number,
): { firstHour: number; lastHour: number } {
  const dayBlocks = schedules.filter(
    (schedule) => schedule.weekday === weekday,
  );
  if (dayBlocks.length === 0) return { firstHour: 8, lastHour: 20 };
  const firstHour = Math.min(
    ...dayBlocks.map((block) => Number(block.starts_at.slice(0, 2))),
  );
  const lastHour = Math.max(
    ...dayBlocks.map((block) => {
      const hour = Number(block.ends_at.slice(0, 2));
      const minute = Number(block.ends_at.slice(3, 5));
      return minute > 0 ? hour + 1 : hour;
    }),
  );
  return { firstHour, lastHour };
}

export type TimeOff = { starts_at: string; ends_at: string; reason: string };

export function scheduleWarnings({
  professionalName,
  start,
  end,
  schedules,
  timeOff,
}: {
  professionalName: string;
  start: string;
  end: string;
  schedules: ScheduleBlock[];
  timeOff: TimeOff[];
}): string[] {
  const warnings: string[] = [];
  const startWall = madridDateTime(start);
  const endWall = madridDateTime(end);
  const weekday = weekdayOf(startWall.date);
  const fitsSchedule =
    startWall.date === endWall.date &&
    schedules.some(
      (schedule) =>
        schedule.weekday === weekday &&
        startWall.time >= schedule.starts_at.slice(0, 5) &&
        endWall.time <= schedule.ends_at.slice(0, 5),
    );
  if (!fitsSchedule)
    warnings.push(`Queda fuera del horario de ${professionalName}.`);

  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const overlappingTimeOff = timeOff.find(
    (entry) =>
      startMs < new Date(entry.ends_at).getTime() &&
      endMs > new Date(entry.starts_at).getTime(),
  );
  if (overlappingTimeOff)
    warnings.push(
      `${professionalName} tiene una ausencia ese día (${overlappingTimeOff.reason}).`,
    );

  return warnings;
}

export type AppointmentInput = {
  professional_id: string;
  patient_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  notes: string;
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidCalendarDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

export function parseAppointmentForm(
  formData: FormData,
): { ok: true; appointment: AppointmentInput } | { error: string } {
  const patientId = text(formData, "patient_id");
  const serviceId = text(formData, "service_id");
  const professionalId = text(formData, "professional_id");
  const date = text(formData, "date");
  const time = text(formData, "time");
  const durationRaw = text(formData, "duration_minutes");
  const notes = text(formData, "notes");

  if (!patientId) return { error: "Elige un paciente." };
  if (!serviceId) return { error: "Elige un servicio." };
  if (!professionalId) return { error: "Elige profesional." };
  if (!date || !time) return { error: "Indica fecha y hora." };
  if (!isValidCalendarDate(date) || !TIME_RE.test(time))
    return { error: "Indica fecha y hora." };

  const duration = Number(durationRaw);
  if (
    !Number.isFinite(duration) ||
    duration < 5 ||
    duration > 480 ||
    duration % 5 !== 0
  )
    return {
      error: "La duración debe estar entre 5 y 480 minutos, en pasos de 5.",
    };

  const startsAt = madridInstant(date, time);
  const endInstant = new Date(new Date(startsAt).getTime() + duration * 60_000);
  const endWall = madridDateTime(endInstant);
  const endsAt = madridInstant(endWall.date, endWall.time);

  return {
    ok: true,
    appointment: {
      professional_id: professionalId,
      patient_id: patientId,
      service_id: serviceId,
      starts_at: startsAt,
      ends_at: endsAt,
      notes,
    },
  };
}

export type AppointmentState = {
  status: "scheduled" | "cancelled" | "no_show";
  starts_at: string;
};

export function canMarkNoShow(
  appointment: AppointmentState,
  now: Date,
): boolean {
  return (
    appointment.status === "scheduled" &&
    new Date(appointment.starts_at).getTime() <= now.getTime()
  );
}

export function canMove(appointment: AppointmentState, now: Date): boolean {
  return (
    appointment.status === "scheduled" &&
    new Date(appointment.starts_at).getTime() > now.getTime()
  );
}

export type DbError = { code?: string; message?: string };

const MESSAGE_BY_CODE: Record<string, string> = {
  appointment_not_started:
    "Solo se puede marcar «no se presentó» cuando la cita ya ha empezado.",
  appointment_cancelled_final:
    "Una cita cancelada no se puede reprogramar; crea una nueva.",
  appointment_in_past: "No se puede mover una cita que ya ha pasado.",
  appointment_immutable_fields: "Esos datos de la cita no se pueden cambiar.",
  patient_not_bookable: "Esa persona no es paciente o está archivada.",
  service_inactive: "Ese servicio ya no está activo.",
  professional_inactive: "Ese profesional no está activo.",
  cancelled_by_required: "Indica quién cancela la cita.",
  appointment_invalid_transition:
    "No se puede cancelar una cita marcada como no presentada.",
};

export function appointmentError(error: DbError): string {
  if (error.code === "23P01") return "Ya hay una cita en esa franja.";
  if (error.code === "42501")
    return "No tienes permiso para dar citas a otro profesional.";
  if (error.code === "23514" && error.message) {
    const mapped = MESSAGE_BY_CODE[error.message];
    if (mapped) return mapped;
  }
  return "No se ha podido guardar.";
}

export type SpecialtyTone = "sage" | "bark" | "pebble" | "neutral";

export function specialtyTone(slug: string): SpecialtyTone {
  if (slug === "logopedia") return "sage";
  if (slug === "psicologia") return "bark";
  if (slug === "fisioterapia") return "pebble";
  return "neutral";
}

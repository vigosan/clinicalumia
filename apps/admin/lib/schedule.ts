export type ScheduleBlock = {
  weekday: number;
  starts_at: string;
  ends_at: string;
};

export const WEEKDAYS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

function minutes(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function dayName(weekday: number) {
  return (WEEKDAYS[weekday - 1] ?? "").toLowerCase();
}

export function validateSchedule(
  blocks: ScheduleBlock[],
): { ok: true; blocks: ScheduleBlock[] } | { error: string } {
  const sorted = [...blocks].sort(
    (a, b) => a.weekday - b.weekday || a.starts_at.localeCompare(b.starts_at),
  );
  for (const [index, block] of sorted.entries()) {
    if (block.weekday < 1 || block.weekday > 7)
      return { error: "Hay un día no válido en el horario." };
    const start = minutes(block.starts_at);
    const end = minutes(block.ends_at);
    if (start === null || end === null)
      return {
        error: `Hay una hora no válida en el ${dayName(block.weekday)}.`,
      };
    if (start >= end)
      return {
        error: `El ${dayName(block.weekday)} tiene un tramo que termina antes de empezar.`,
      };
    const previous = sorted[index - 1];
    if (
      previous &&
      previous.weekday === block.weekday &&
      (minutes(previous.ends_at) ?? 0) > start
    )
      return {
        error: `El ${dayName(block.weekday)} tiene dos tramos que se solapan.`,
      };
  }
  return { ok: true, blocks: sorted };
}

function offsetHours(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    timeZoneName: "shortOffset",
  }).formatToParts(instant);
  const offset =
    parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+1";
  return Number(/GMT([+-]\d+)/.exec(offset)?.[1] ?? 1);
}

function formatOffset(hours: number): string {
  return `${hours >= 0 ? "+" : "-"}${String(Math.abs(hours)).padStart(2, "0")}:00`;
}

function madridOffsetAt(date: string, time: string): string {
  let hours = offsetHours(new Date(`${date}T${time}Z`));
  for (let attempt = 0; attempt < 2; attempt++) {
    const next = offsetHours(new Date(`${date}T${time}${formatOffset(hours)}`));
    if (next === hours) break;
    hours = next;
  }
  return formatOffset(hours);
}

export function madridDayBounds(date: string): { start: string; end: string } {
  return {
    start: `${date}T00:00:00${madridOffsetAt(date, "00:00:00")}`,
    end: `${date}T23:59:59${madridOffsetAt(date, "23:59:59")}`,
  };
}

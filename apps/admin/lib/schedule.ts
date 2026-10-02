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

export type ScheduleSource = {
  id: string;
  name: string;
  blocks: ScheduleBlock[];
};

export function scheduleSources(
  people: { id: string; full_name: string }[],
  blocks: (ScheduleBlock & { profile_id: string })[],
  currentId: string,
): ScheduleSource[] {
  return people
    .filter((person) => person.id !== currentId)
    .map((person) => ({
      id: person.id,
      name: person.full_name,
      blocks: blocks
        .filter((block) => block.profile_id === person.id)
        .map(({ weekday, starts_at, ends_at }) => ({
          weekday,
          starts_at,
          ends_at,
        })),
    }))
    .filter((source) => source.blocks.length > 0);
}

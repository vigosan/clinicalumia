import { addDays, weekStart } from "@clinicalumia/api/madrid-time";

export type Closure = {
  id: string;
  starts_on: string;
  ends_on: string;
  reason: string;
};

export function formatDay(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

export function closureLabel({
  starts_on,
  ends_on,
  reason,
}: Omit<Closure, "id">): string {
  const days =
    starts_on === ends_on
      ? formatDay(starts_on)
      : `${formatDay(starts_on)} – ${formatDay(ends_on)}`;
  return `${days} · ${reason}`;
}

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function longDay(date: string): string {
  return `${Number(date.slice(8, 10))} de ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
}

export function closureDays({
  starts_on,
  ends_on,
}: Pick<Closure, "starts_on" | "ends_on">): string {
  if (starts_on === ends_on) return longDay(starts_on);
  if (starts_on.slice(0, 7) === ends_on.slice(0, 7))
    return `${Number(starts_on.slice(8, 10))}–${longDay(ends_on)}`;
  return `${longDay(starts_on)} – ${longDay(ends_on)}`;
}

export type MonthCell = { date: string; inMonth: boolean; closure?: Closure };

export function monthGrid(month: string, closures: Closure[]): MonthCell[][] {
  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const weeks: MonthCell[][] = [];
  for (let start = weekStart(first); start <= last; start = addDays(start, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, offset) => {
        const date = addDays(start, offset);
        return {
          date,
          inMonth: date.startsWith(month),
          closure: closures.find(
            (closure) => closure.starts_on <= date && date <= closure.ends_on,
          ),
        };
      }),
    );
  }
  return weeks;
}

export function closuresInMonth(closures: Closure[], month: string): Closure[] {
  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  return closures
    .filter((closure) => closure.starts_on <= last && closure.ends_on >= first)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
}

export function monthFromParam(param: string | undefined, today: string) {
  return param && /^\d{4}-(0[1-9]|1[0-2])$/.test(param)
    ? param
    : today.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (monthNumber ?? 1) - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function monthLabel(month: string): string {
  const label = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

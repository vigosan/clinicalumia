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

export function todayInMadrid(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function dateParts(date: string): { year: number; month: number; day: number } {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

function isValidCalendarDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const { year, month, day } = dateParts(date);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

export function madridInstant(date: string, time: string): string {
  if (!isValidCalendarDate(date))
    throw new Error(`madridInstant: invalid date "${date}"`);
  if (!TIME_RE.test(time))
    throw new Error(`madridInstant: invalid time "${time}"`);
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  return `${date}T${normalizedTime}${madridOffsetAt(date, normalizedTime)}`;
}

export function madridDateTime(instant: string | Date): {
  date: string;
  time: string;
} {
  const value = typeof instant === "string" ? new Date(instant) : instant;
  const date = todayInMadrid(value);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(value);
  return { date, time };
}

export function addDays(date: string, days: number): string {
  const { year, month, day } = dateParts(date);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  const { year, month, day } = dateParts(date);
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function weekStart(date: string): string {
  return addDays(date, -(weekdayOf(date) - 1));
}

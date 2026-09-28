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

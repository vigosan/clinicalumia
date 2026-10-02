import { formatDay, madridDateTime } from "@clinicalumia/api/madrid-time";

export function formatHistoryMoment(instant: string): string {
  const { date, time } = madridDateTime(instant);
  return `${date.slice(8, 10)}/${date.slice(5, 7)} a las ${time.slice(0, 5)}`;
}

export function formatMadridDateTime(instant: string): string {
  const { date, time } = madridDateTime(instant);
  return `${formatDay(date)} ${time}`;
}

export function formatShortMadridDay(instant: string): string {
  const parts = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  const weekday = part("weekday");
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${part("day")} ${part("month")}`;
}

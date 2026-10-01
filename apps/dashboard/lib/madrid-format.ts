import { madridDateTime } from "@clinicalumia/api/madrid-time";

export function formatHistoryMoment(instant: string): string {
  const { date, time } = madridDateTime(instant);
  return `${date.slice(8, 10)}/${date.slice(5, 7)} a las ${time.slice(0, 5)}`;
}

export function formatDay(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

export function formatMadridDate(instant: string): string {
  return formatDay(madridDateTime(instant).date);
}

export function formatMadridDateTime(instant: string): string {
  const { date, time } = madridDateTime(instant);
  return `${formatDay(date)} ${time}`;
}

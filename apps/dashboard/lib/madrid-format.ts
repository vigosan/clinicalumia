import { madridDateTime } from "@clinicalumia/api/madrid-time";

export function formatHistoryMoment(instant: string): string {
  const { date, time } = madridDateTime(instant);
  return `${date.slice(8, 10)}/${date.slice(5, 7)} a las ${time.slice(0, 5)}`;
}

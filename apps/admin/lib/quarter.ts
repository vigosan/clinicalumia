import { madridInstant, todayInMadrid } from "@clinicalumia/api/madrid-time";

export type Quarter = 1 | 2 | 3 | 4;

const QUARTER_START_MONTH: Record<Quarter, number> = {
  1: 1,
  2: 4,
  3: 7,
  4: 10,
};

export function quarterRange(
  year: number,
  q: Quarter,
): { from: string; to: string } {
  const startMonth = QUARTER_START_MONTH[q];
  const from = madridInstant(
    `${year}-${String(startMonth).padStart(2, "0")}-01`,
    "00:00",
  );
  const nextMonth = startMonth + 3;
  const to =
    nextMonth > 12
      ? madridInstant(`${year + 1}-01-01`, "00:00")
      : madridInstant(
          `${year}-${String(nextMonth).padStart(2, "0")}-01`,
          "00:00",
        );
  return { from, to };
}

function quarterOf(now: Date): { year: number; q: Quarter } {
  const today = todayInMadrid(now);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const q = (Math.floor((month - 1) / 3) + 1) as Quarter;
  return { year, q };
}

export function lastClosedQuarter(now: Date): { year: number; q: Quarter } {
  const current = quarterOf(now);
  if (current.q === 1) return { year: current.year - 1, q: 4 };
  return { year: current.year, q: (current.q - 1) as Quarter };
}

export function isCurrentQuarter(year: number, q: Quarter, now: Date): boolean {
  const current = quarterOf(now);
  return current.year === year && current.q === q;
}

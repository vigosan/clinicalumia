const USUAL_MINUTES = [15, 30, 45, 60, 90, 120];

export const OTHER_DURATION = "other";

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function isUsualDuration(value: string): boolean {
  return USUAL_MINUTES.includes(Number(value));
}

export function durationOptions(
  value: string,
): { value: string; label: string }[] {
  const minutes = Number(value);
  const all =
    value !== "" &&
    Number.isInteger(minutes) &&
    minutes > 0 &&
    !isUsualDuration(value)
      ? [...USUAL_MINUTES, minutes].sort((a, b) => a - b)
      : USUAL_MINUTES;
  return [
    ...all.map((m) => ({ value: String(m), label: formatMinutes(m) })),
    { value: OTHER_DURATION, label: "Otra…" },
  ];
}

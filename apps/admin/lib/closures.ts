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

export function splitClosures(
  closures: Closure[],
  today: string,
): { upcoming: Closure[]; past: Closure[] } {
  const sorted = [...closures].sort((a, b) =>
    a.starts_on.localeCompare(b.starts_on),
  );
  return {
    upcoming: sorted.filter((closure) => closure.ends_on >= today),
    past: sorted.filter((closure) => closure.ends_on < today).reverse(),
  };
}

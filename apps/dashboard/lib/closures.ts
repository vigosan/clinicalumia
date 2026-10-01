import type { createClient } from "@clinicalumia/api/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type Closure = {
  id: string;
  startsOn: string;
  endsOn: string;
  reason: string;
};

export function closureOn(date: string, closures: Closure[]): Closure | null {
  return (
    closures.find(
      (closure) => closure.startsOn <= date && closure.endsOn >= date,
    ) ?? null
  );
}

export async function loadClosures(
  supabase: Client,
  from: string,
  to?: string,
): Promise<Closure[] | null> {
  let query = supabase
    .from("clinic_closures")
    .select("id, starts_on, ends_on, reason")
    .gte("ends_on", from);
  if (to) query = query.lte("starts_on", to);
  const { data, error } = await query.order("starts_on");
  if (error || !data) return null;
  return data.map((row) => ({
    id: row.id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    reason: row.reason,
  }));
}

import type { createClient } from "@clinicalumia/api/server";
import { pendingSince } from "./pending-payments";

type Client = Awaited<ReturnType<typeof createClient>>;

export type NavCounts = {
  consentimientos?: number;
  cobros?: number;
};

async function consentimientosPendingCount(
  supabase: Client,
): Promise<number | undefined> {
  const { count, error } = await supabase
    .from("consents")
    .select("id", { count: "exact", head: true })
    .is("person_id", null);
  return error || !count ? undefined : count;
}

async function cobrosPendingCount(
  supabase: Client,
  now: Date,
): Promise<number | undefined> {
  const { data, error } = await supabase.rpc("pending_payments", {
    p_since: pendingSince(now),
  });
  return error || !data?.length ? undefined : data.length;
}

export async function loadNavCounts(
  supabase: Client,
  now: Date,
): Promise<NavCounts> {
  const [consentimientos, cobros] = await Promise.all([
    consentimientosPendingCount(supabase),
    cobrosPendingCount(supabase, now),
  ]);
  return { consentimientos, cobros };
}

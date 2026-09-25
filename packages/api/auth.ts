import type { Database } from "@clinicalumia/db";
import type { SupabaseClient } from "@supabase/supabase-js";

const denied = {
  ok: false,
  error: "No tienes permiso para hacer esto.",
} as const;

export async function requireOwner(
  supabase: SupabaseClient<Database>,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return denied;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "owner" || !profile.is_active) return denied;
  return { ok: true, userId: user.id };
}

import type { Database } from "@clinicalumia/db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MfaStep = "enroll" | "challenge" | "done";

export async function getMfaStep(
  supabase: SupabaseClient<Database>,
): Promise<MfaStep> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel === "aal2") return "done";
  if (data?.nextLevel === "aal2") return "challenge";
  return "enroll";
}

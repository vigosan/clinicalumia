"use server";

import { createClient } from "@clinicalumia/api/server";

export type RecoverState = { sent: true } | { error: string } | undefined;

export async function requestRecovery(
  _prev: RecoverState,
  formData: FormData,
): Promise<RecoverState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Escribe tu email." };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email);
  return { sent: true };
}

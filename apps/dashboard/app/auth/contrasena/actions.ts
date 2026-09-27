"use server";

import { getMfaStep } from "@clinicalumia/api/mfa";
import { createClient } from "@clinicalumia/api/server";
import { redirect } from "next/navigation";
import { validateNewPassword } from "@/lib/password";

export type PasswordState = { error: string } | undefined;

export async function setPassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  const invalid = validateNewPassword(password, confirmation);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error)
    return {
      error: "No se ha podido guardar la contraseña. Pide un enlace nuevo.",
    };

  const step = await getMfaStep(supabase);
  if (step === "enroll") redirect("/auth/dos-pasos/activar");
  if (step === "challenge") redirect("/auth/dos-pasos");
  redirect("/");
}

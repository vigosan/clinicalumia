"use server";

import { getMfaStep } from "@clinicalumia/api/mfa";
import { createClient } from "@clinicalumia/api/server";
import { redirect } from "next/navigation";
import { validateNewPassword } from "@/lib/password";

export type PasswordState = { error: string } | undefined;

const TWO_FACTOR_PENDING =
  "Termina la verificación en dos pasos antes de cambiar la contraseña.";

export async function setPassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  const invalid = validateNewPassword(password, confirmation);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const step = await getMfaStep(supabase);
  if (step === "challenge") return { error: TWO_FACTOR_PENDING };

  const { error } = await supabase.auth.updateUser({ password });
  if (error)
    return {
      error: "No se ha podido guardar la contraseña. Pide un enlace nuevo.",
    };

  if (step === "enroll") redirect("/auth/dos-pasos/activar");
  redirect("/");
}

"use server";

import { getMfaStep } from "@clinicalumia/api/mfa";
import { createClient } from "@clinicalumia/api/server";
import { redirect } from "next/navigation";

export type LoginState = { error: string } | undefined;

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email y contraseña son obligatorios." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Credenciales incorrectas." };
  }

  const step = await getMfaStep(supabase);
  if (step === "enroll") redirect("/auth/dos-pasos/activar");
  if (step === "challenge") redirect("/auth/dos-pasos");
  redirect("/");
}

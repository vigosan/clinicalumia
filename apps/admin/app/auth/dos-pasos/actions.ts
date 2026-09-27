"use server";

import {
  confirmTotpEnrollment,
  parseTotpCode,
  verifyTotp,
} from "@clinicalumia/api/mfa";
import { safeNext } from "@clinicalumia/api/route";
import { createClient } from "@clinicalumia/api/server";
import { redirect } from "next/navigation";

export type TotpFormState = { error: string } | undefined;

const CODE_REQUIRED = "Escribe los 6 dígitos que muestra tu app.";

export async function confirmEnrollment(
  _prev: TotpFormState,
  formData: FormData,
): Promise<TotpFormState> {
  const code = parseTotpCode(String(formData.get("code") ?? ""));
  if (!code) return { error: CODE_REQUIRED };

  const factorId = String(formData.get("factorId") ?? "");
  const supabase = await createClient();
  const result = await confirmTotpEnrollment(supabase, factorId, code);
  if ("error" in result) return result;

  redirect("/");
}

export async function verifyChallenge(
  _prev: TotpFormState,
  formData: FormData,
): Promise<TotpFormState> {
  const code = parseTotpCode(String(formData.get("code") ?? ""));
  if (!code) return { error: CODE_REQUIRED };

  const supabase = await createClient();
  const result = await verifyTotp(supabase, code);
  if ("error" in result) return result;

  const next = formData.get("next");
  redirect(safeNext(typeof next === "string" ? next : null));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

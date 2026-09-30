"use server";

import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";

function consentError(error: { code?: string; message?: string }): string {
  if (error.code === "42501") return "No tienes permiso para hacer esto.";
  if (error.message === "person_not_found")
    return "Esa ficha ya no existe o está archivada.";
  if (error.message === "consent_not_found")
    return "Ese consentimiento ya no existe.";
  if (error.message === "consent_already_linked")
    return "Este consentimiento ya está asociado.";
  return "No se ha podido guardar.";
}

function revalidateConsent(consentId: string) {
  revalidatePath("/consentimientos");
  revalidatePath(`/consentimientos/${consentId}`);
}

export async function linkConsent(
  consentId: string,
  personId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("link_consent", {
    p_consent_id: consentId,
    p_person_id: personId,
  });
  if (error) {
    if (error.message === "consent_already_linked")
      revalidateConsent(consentId);
    return { error: consentError(error) };
  }
  revalidateConsent(consentId);
  return { ok: true };
}

export async function unlinkConsent(consentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unlink_consent", {
    p_consent_id: consentId,
  });
  if (error) return { error: consentError(error) };
  revalidateConsent(consentId);
  return { ok: true };
}

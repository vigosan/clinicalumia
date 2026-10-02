"use server";

import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { isUuid } from "@/lib/agenda";
import {
  CONSENT_LINK_ERROR_MESSAGES,
  type ConsentLinkErrorCode,
} from "@/lib/consent-link-error";
import {
  CONSENT_FILL_FIELDS,
  type ConsentFillField,
  type ConsentFillOffer,
  consentFillOffers,
} from "@/lib/consents";

function consentError(error: {
  code?: string;
  message?: string;
}): ConsentLinkErrorCode {
  if (error.code === "42501") return "permission";
  if (error.message === "person_not_found") return "person-not-found";
  if (error.message === "consent_not_found") return "consent-not-found";
  if (error.message === "consent_already_linked") return "already-linked";
  if (error.message === "tax_id_taken") return "tax-id-taken";
  return "unknown";
}

function revalidateConsent(consentId: string) {
  revalidatePath("/consentimientos");
  revalidatePath(`/consentimientos/${consentId}`);
}

export async function consentFillOptions(
  consentId: string,
  personId: string,
): Promise<ConsentFillOffer[]> {
  if (!isUuid(consentId) || !isUuid(personId)) return [];
  const supabase = await createClient();
  const [{ data: consent }, { data: person }] = await Promise.all([
    supabase
      .from("consents")
      .select("tax_id, guardian_tax_id, guardian_name, email, birth_date")
      .eq("id", consentId)
      .maybeSingle(),
    supabase
      .from("people")
      .select("tax_id, email, birth_date")
      .eq("id", personId)
      .maybeSingle(),
  ]);
  if (!consent || !person) return [];
  return consentFillOffers(consent, person);
}

export async function linkConsent(
  consentId: string,
  personId: string,
  fill: ConsentFillField[] = [],
): Promise<ActionResult> {
  if (
    !isUuid(consentId) ||
    !isUuid(personId) ||
    !fill.every((field) => CONSENT_FILL_FIELDS.includes(field))
  )
    return { error: CONSENT_LINK_ERROR_MESSAGES.unknown };
  const supabase = await createClient();
  const { error } = await supabase.rpc("link_consent", {
    p_consent_id: consentId,
    p_person_id: personId,
    ...(fill.length > 0 && { p_fill: fill }),
  });
  if (error) {
    if (error.message === "consent_already_linked")
      revalidateConsent(consentId);
    return { error: CONSENT_LINK_ERROR_MESSAGES[consentError(error)] };
  }
  revalidateConsent(consentId);
  if (fill.length > 0) revalidatePath(`/patients/${personId}`);
  return { ok: true };
}

export async function unlinkConsent(consentId: string): Promise<ActionResult> {
  if (!isUuid(consentId)) return { error: CONSENT_LINK_ERROR_MESSAGES.unknown };
  const supabase = await createClient();
  const { error } = await supabase.rpc("unlink_consent", {
    p_consent_id: consentId,
  });
  if (error) return { error: CONSENT_LINK_ERROR_MESSAGES[consentError(error)] };
  revalidateConsent(consentId);
  return { ok: true };
}

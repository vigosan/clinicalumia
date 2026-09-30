"use server";

import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { isUuid } from "@/lib/agenda";
import {
  CONSENT_LINK_ERROR_MESSAGES,
  type ConsentLinkErrorCode,
} from "@/lib/consent-link-error";

function consentError(error: {
  code?: string;
  message?: string;
}): ConsentLinkErrorCode {
  if (error.code === "42501") return "permission";
  if (error.message === "person_not_found") return "person-not-found";
  if (error.message === "consent_not_found") return "consent-not-found";
  if (error.message === "consent_already_linked") return "already-linked";
  return "unknown";
}

function revalidateConsent(consentId: string) {
  revalidatePath("/consentimientos");
  revalidatePath(`/consentimientos/${consentId}`);
}

export async function linkConsent(
  consentId: string,
  personId: string,
): Promise<ActionResult> {
  if (!isUuid(consentId) || !isUuid(personId))
    return { error: CONSENT_LINK_ERROR_MESSAGES.unknown };
  const supabase = await createClient();
  const { error } = await supabase.rpc("link_consent", {
    p_consent_id: consentId,
    p_person_id: personId,
  });
  if (error) {
    if (error.message === "consent_already_linked")
      revalidateConsent(consentId);
    return { error: CONSENT_LINK_ERROR_MESSAGES[consentError(error)] };
  }
  revalidateConsent(consentId);
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

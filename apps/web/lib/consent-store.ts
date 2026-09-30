import type { createAdminClient } from "@clinicalumia/api/admin";
import type { Consent } from "./consent";

type AdminClient = ReturnType<typeof createAdminClient>;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export async function storeConsent({
  admin,
  consent,
  signedAt,
  pdf,
}: {
  admin: AdminClient;
  consent: Consent;
  signedAt: Date;
  pdf: Uint8Array;
}): Promise<{ id: string; personId: string | null }> {
  const id = crypto.randomUUID();
  const path = `${signedAt.getUTCFullYear()}/${pad(signedAt.getUTCMonth() + 1)}/${id}.pdf`;

  const { error: uploadError } = await admin.storage
    .from("consents")
    .upload(path, pdf, { contentType: "application/pdf" });
  if (uploadError) throw new Error(uploadError.message);

  try {
    const { data: matches, error: matchError } = await admin.rpc(
      "match_consent_person",
      {
        p_tax_id: consent.dni,
        p_email: consent.email,
        p_birth_date: consent.birthDate,
        p_first_name: consent.firstName,
      },
    );
    if (matchError) throw new Error(matchError.message);
    const match = matches[0] ?? null;

    const { error: insertError } = await admin.from("consents").insert({
      id,
      signed_at: signedAt.toISOString(),
      first_name: consent.firstName,
      last_name: consent.lastName,
      birth_date: consent.birthDate,
      tax_id: consent.dni,
      email: consent.email ? consent.email.toLowerCase() : null,
      guardian_name: consent.guardian,
      sources: consent.sources,
      marketing: consent.marketing,
      media_for_training: consent.mediaForTraining,
      pdf_path: path,
      person_id: match?.person_id ?? null,
      linked_at: match ? signedAt.toISOString() : null,
      link_method: match?.method ?? null,
    });
    if (insertError) throw new Error(insertError.message);

    return { id, personId: match?.person_id ?? null };
  } catch (error) {
    await admin.storage.from("consents").remove([path]);
    throw error;
  }
}

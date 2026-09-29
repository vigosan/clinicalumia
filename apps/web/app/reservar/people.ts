import type { createClient } from "@clinicalumia/api/server";
import {
  isMinorOn,
  type NewPersonInput,
  PRIVACY_VERSION,
  parseNewPersonForm,
  personError,
  personWarning,
} from "@/lib/booking";

const RELATIONSHIPS = ["madre", "padre", "tutor_legal", "otro"] as const;

type Relationship = (typeof RELATIONSHIPS)[number];
type Client = Awaited<ReturnType<typeof createClient>>;

export const PHONE_REQUIRED = "El teléfono es obligatorio.";

function prefixed(formData: FormData, prefix: string) {
  const fields = new FormData();
  for (const key of ["first_name", "last_name", "birth_date", "phone"]) {
    fields.set(key, String(formData.get(`${prefix}${key}`) ?? ""));
  }
  return fields;
}

export async function addPerson(
  supabase: Client,
  person: NewPersonInput,
  options: {
    guardianId: string | null;
    relationship: Relationship | null;
    isPatient: boolean;
    acceptPrivacy: boolean;
  },
) {
  return supabase.rpc("add_my_person", {
    p_first_name: person.first_name,
    p_last_name: person.last_name,
    p_birth_date: person.birth_date,
    p_phone: person.phone as string,
    p_guardian_id: options.guardianId as string,
    p_relationship: options.relationship as Relationship,
    p_is_patient: options.isPatient,
    p_accept_privacy: options.acceptPrivacy,
    p_privacy_version: (options.acceptPrivacy
      ? PRIVACY_VERSION
      : null) as string,
  });
}

export async function saveMinor(
  supabase: Client,
  formData: FormData,
  today: string,
): Promise<{ error: string } | { warning: string } | { minorId: string }> {
  const acceptPrivacy = formData.get("privacy") === "on";
  const parsed = parseNewPersonForm(formData, today);
  const relationship = RELATIONSHIPS.find(
    (value) => value === formData.get("relationship"),
  );
  if (!relationship)
    return { error: personError({ message: "relationship_required" }) };
  const existingGuardian = String(formData.get("guardian_id") ?? "");
  const guardian = existingGuardian
    ? null
    : parseNewPersonForm(prefixed(formData, "guardian_"), today);
  if (guardian && "error" in guardian) return { error: guardian.error };
  if (guardian && !guardian.person.phone) return { error: PHONE_REQUIRED };
  if ("error" in parsed) return { error: parsed.error };
  if (!isMinorOn(parsed.person.birth_date, today))
    return { error: personError({ message: "person_not_minor" }) };

  let guardianId = existingGuardian;
  if (guardian) {
    const { data, error } = await addPerson(supabase, guardian.person, {
      guardianId: null,
      relationship: null,
      isPatient: false,
      acceptPrivacy,
    });
    if (error) return { error: personError(error) };
    guardianId = data;
  }

  const { data, error } = await addPerson(supabase, parsed.person, {
    guardianId,
    relationship,
    isPatient: true,
    acceptPrivacy: acceptPrivacy && !guardian,
  });
  if (error && guardian) return { warning: personWarning(error) };
  if (error) return { error: personError(error) };
  return { minorId: data };
}

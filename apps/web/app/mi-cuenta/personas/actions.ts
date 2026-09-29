"use server";

import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { redirect } from "next/navigation";
import { accountError, parseContactForm } from "@/lib/account";
import { saveMinor } from "../../reservar/people";
import type { AccountFormState } from "../citas/actions";

export async function addMinor(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const supabase = await createClient();
  const minor = await saveMinor(supabase, formData, todayInMadrid());
  if ("error" in minor) return minor;
  if ("warning" in minor)
    redirect(`/mi-cuenta/menores/nuevo?aviso=${minor.warning}`);
  redirect("/mi-cuenta?aviso=menor");
}

export async function updateContact(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const personId = String(formData.get("persona") ?? "");
  const supabase = await createClient();
  const { data: people, error: peopleError } = await supabase.rpc("my_people");
  if (peopleError) return { error: accountError(peopleError) };
  const person = people.find((candidate) => candidate.id === personId);
  if (!person)
    return { error: accountError({ message: "person_not_in_account" }) };

  const parsed = parseContactForm(formData, person.is_minor);
  if ("error" in parsed) return parsed;

  const { error } = await supabase.rpc("update_my_contact", {
    p_person_id: personId,
    p_phone: parsed.phone as string,
    p_address: parsed.address,
  });
  if (error) return { error: accountError(error) };
  redirect("/mi-cuenta?aviso=contacto");
}

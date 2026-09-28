"use server";

import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import {
  isMinor,
  normalizeSearch,
  parsePersonForm,
  todayInMadrid,
  toIlikePattern,
} from "@/lib/person";
import type { Ward } from "@/lib/ward-label";

export type PersonFormState = { error: string } | undefined;

export type Duplicate = {
  id: string;
  first_name: string;
  last_name: string;
  matched: string[];
  wards: Ward[];
};

function mapPersonError(
  error: { code?: string; message?: string; details?: string } | null,
): string | null {
  if (!error) return null;
  if (error.code === "23505") {
    const text = `${error.message ?? ""} ${error.details ?? ""}`;
    if (text.includes("people_tax_id_key"))
      return "Ya existe una persona con ese DNI/NIE.";
    return "No se ha podido guardar.";
  }
  if (error.code === "23514")
    return "Revisa los datos: hay un campo no válido.";
  if (error.code === "42501") return "No tienes permiso para hacer esto.";
  return "No se ha podido guardar.";
}

export async function savePerson(
  _prev: PersonFormState,
  formData: FormData,
): Promise<PersonFormState> {
  const parsed = parsePersonForm(formData, todayInMadrid());
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");

  if (id) {
    const { data, error } = await supabase
      .from("people")
      .update(parsed.person)
      .eq("id", id)
      .select("id");
    const mapped = mapPersonError(error);
    if (mapped) return { error: mapped };
    if (!data || data.length === 0)
      return { error: "No tienes permiso para hacer esto." };

    revalidatePath("/patients");
    redirect(`/patients/${id}`);
  }

  const { data, error } = await supabase
    .from("people")
    .insert(parsed.person)
    .select("id")
    .single();
  const mapped = mapPersonError(error);
  if (mapped) return { error: mapped };
  if (!data) return { error: "No tienes permiso para hacer esto." };

  revalidatePath("/patients");

  const guardianOf = String(formData.get("guardian_of") ?? "");
  if (guardianOf) {
    const relationship = String(
      formData.get("relationship") ?? "otro",
    ) as Ward["relationship"];
    const isPrimary = formData.get("is_primary") === "on";
    const guardianResult = await addGuardian(
      guardianOf,
      data.id,
      relationship,
      isPrimary,
    );
    if ("error" in guardianResult) {
      redirect(
        `/patients/${guardianOf}?guardianError=${encodeURIComponent(guardianResult.error)}`,
      );
    }
    redirect(`/patients/${guardianOf}`);
  }

  redirect(`/patients/${data.id}`);
}

export async function checkDuplicates(input: {
  tax_id: string;
  email: string;
  phone: string;
  exclude?: string;
}): Promise<Duplicate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_possible_duplicates", {
    p_tax_id: input.tax_id,
    p_email: input.email,
    p_phone: input.phone,
    p_exclude: input.exclude,
  });
  if (error) return [];
  return (data as Duplicate[] | null) ?? [];
}

export type GuardianCandidate = {
  id: string;
  first_name: string;
  last_name: string;
};

export async function searchGuardianCandidates(
  query: string,
): Promise<GuardianCandidate[]> {
  const normalized = normalizeSearch(query);
  if (!normalized) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .select("id, first_name, last_name")
    .is("archived_at", null)
    .ilike("search_text", toIlikePattern(normalized))
    .order("last_name", { ascending: true })
    .limit(10);
  if (error) return [];
  return data ?? [];
}

function mapGuardianshipError(
  error: { code?: string; message?: string; details?: string } | null,
): string | null {
  if (!error) return null;
  if (error.code === "23505") {
    const text = `${error.message ?? ""} ${error.details ?? ""}`;
    if (text.includes("guardianships_one_primary"))
      return "Ya tiene un tutor principal.";
    if (text.includes("guardianships_pkey"))
      return "Ya es tutor de este menor.";
    return "No se ha podido guardar.";
  }
  return "No se ha podido guardar.";
}

export async function addGuardian(
  minorId: string,
  guardianId: string,
  relationship: Ward["relationship"],
  isPrimary: boolean,
): Promise<ActionResult> {
  if (guardianId === minorId)
    return { error: "Una persona no puede ser su propio tutor." };

  const supabase = await createClient();
  const { data: guardian } = await supabase
    .from("people")
    .select("birth_date")
    .eq("id", guardianId)
    .maybeSingle();
  if (guardian?.birth_date && isMinor(guardian.birth_date, todayInMadrid()))
    return { error: "Un tutor tiene que ser mayor de edad." };

  const { error } = await supabase.from("guardianships").insert({
    minor_id: minorId,
    guardian_id: guardianId,
    relationship,
    is_primary: isPrimary,
  });
  const mapped = mapGuardianshipError(error);
  if (mapped) return { error: mapped };

  revalidatePath(`/patients/${minorId}`);
  revalidatePath(`/patients/${guardianId}`);
  return { ok: true };
}

export async function removeGuardian(
  minorId: string,
  guardianId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("guardianships")
    .delete()
    .eq("minor_id", minorId)
    .eq("guardian_id", guardianId);
  if (error) return { error: "No se ha podido quitar el tutor." };

  revalidatePath(`/patients/${minorId}`);
  revalidatePath(`/patients/${guardianId}`);
  return { ok: true };
}

export async function setArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("people")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: "No se ha podido actualizar." };

  revalidatePath("/patients");
  revalidatePath(`/patients/${id}`);
  return { ok: true };
}

export async function deletePerson(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23503")
      return { error: "No se puede eliminar: tiene menores a su cargo." };
    return { error: "No se ha podido eliminar." };
  }
  if (!data || data.length === 0)
    return { error: "Solo la propietaria puede eliminar personas." };

  revalidatePath("/patients");
  redirect("/patients");
}

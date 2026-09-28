"use server";

import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parsePersonForm, todayInMadrid } from "@/lib/person";
import type { Ward } from "@/lib/ward-label";

export type PersonFormState = { error: string } | undefined;

export type Duplicate = {
  id: string;
  first_name: string;
  last_name: string;
  matched: string[];
  wards: Ward[];
};

function mapPersonError(error: { code?: string } | null): string | null {
  if (!error) return null;
  if (error.code === "23505") return "Ya existe una persona con ese DNI/NIE.";
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

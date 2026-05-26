"use server";

import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type SpecialtyFormState = { error: string } | { ok: true } | undefined;

export async function createSpecialty(
  _prev: SpecialtyFormState,
  formData: FormData,
): Promise<SpecialtyFormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "El nombre es obligatorio." };

  const slug = slugify(name);
  if (!slug) return { error: "El nombre no es válido." };

  const supabase = await createClient();
  const { error } = await supabase.from("specialties").insert({ name, slug });

  if (error) {
    if (error.code === "23505")
      return { error: "Ya existe una especialidad con ese nombre." };
    return { error: "No se ha podido crear la especialidad." };
  }

  revalidatePath("/specialties");
  return { ok: true };
}

export async function renameSpecialty(id: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  await supabase
    .from("specialties")
    .update({ name, slug: slugify(name) })
    .eq("id", id);

  revalidatePath("/specialties");
}

export async function deleteSpecialty(id: string) {
  const supabase = await createClient();
  await supabase.from("specialties").delete().eq("id", id);
  revalidatePath("/specialties");
}

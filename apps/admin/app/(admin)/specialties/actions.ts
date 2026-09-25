"use server";

import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";

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

export async function renameSpecialty(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "El nombre es obligatorio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("specialties")
    .update({ name, slug: slugify(name) })
    .eq("id", id);

  if (error?.code === "23505")
    return { error: "Ya existe una especialidad con ese nombre." };
  if (error) return { error: "No se ha podido renombrar la especialidad." };

  revalidatePath("/specialties");
  return { ok: true };
}

export async function deleteSpecialty(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("specialties").delete().eq("id", id);

  if (error?.code === "23503")
    return {
      error: "No se puede eliminar: hay servicios que usan esta especialidad.",
    };
  if (error) return { error: "No se ha podido eliminar la especialidad." };

  revalidatePath("/specialties");
  return { ok: true };
}

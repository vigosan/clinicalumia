"use server";

import { requireOwner } from "@clinicalumia/api/auth";
import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { parseServiceForm } from "@/lib/service-form";

export type ServiceFormState = { error: string } | undefined;

export async function saveService(
  _prev: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };

  const parsed = parseServiceForm(formData);
  if ("error" in parsed) return parsed;

  const id = String(formData.get("id") ?? "");
  const { error } = id
    ? await supabase.from("services").update(parsed.service).eq("id", id)
    : await supabase.from("services").insert(parsed.service);

  if (error?.code === "23505")
    return {
      error: "Ya existe un servicio con ese nombre en esa especialidad.",
    };
  if (error) return { error: "No se ha podido guardar el servicio." };

  revalidatePath("/services");
  redirect("/services");
}

export async function setServiceActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };

  const { error } = await supabase
    .from("services")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error)
    return { error: "No se ha podido cambiar el estado del servicio." };

  revalidatePath("/services");
  return { ok: true };
}

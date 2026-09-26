"use server";

import { requireOwner } from "@clinicalumia/api/auth";
import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import { parseClinicSettings } from "@/lib/clinic-settings";
import { LOGO_EXTENSIONS, validateLogoFile } from "@/lib/logo";

export type SaveClinicSettingsState =
  | { error: string }
  | { ok: true }
  | undefined;
export type UploadLogoState = { error: string } | { ok: true } | undefined;

export async function saveClinicSettings(
  _prev: SaveClinicSettingsState,
  formData: FormData,
): Promise<SaveClinicSettingsState> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };

  const parsed = parseClinicSettings(formData);
  if ("error" in parsed) return parsed;

  const { error } = await supabase
    .from("clinic_settings")
    .update(parsed.settings)
    .eq("id", true);
  if (error) return { error: "No se han podido guardar los datos." };

  revalidatePath("/clinic");
  return { ok: true };
}

export async function uploadLogo(
  _prev: UploadLogoState,
  formData: FormData,
): Promise<UploadLogoState> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Elige una imagen." };

  const validation = validateLogoFile(file);
  if ("error" in validation) return validation;
  const extension = LOGO_EXTENSIONS[file.type];

  const { data: current } = await supabase
    .from("clinic_settings")
    .select("logo_path")
    .eq("id", true)
    .single();
  const previousPath = current?.logo_path ?? null;

  const path = `logo-${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("branding")
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: "No se ha podido subir el logo." };

  const { error: updateError } = await supabase
    .from("clinic_settings")
    .update({ logo_path: path })
    .eq("id", true);
  if (updateError) {
    await supabase.storage.from("branding").remove([path]);
    return { error: "No se ha podido guardar el logo." };
  }

  if (previousPath) {
    await supabase.storage.from("branding").remove([previousPath]);
  }

  revalidatePath("/clinic");
  return { ok: true };
}

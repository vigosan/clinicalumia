"use server";

import { requireOwner } from "@clinicalumia/api/auth";
import { createClient } from "@clinicalumia/api/server";
import { shrinkLogo } from "@clinicalumia/invoices/logo";
import { revalidatePath } from "next/cache";
import {
  type ClinicSettingsFieldErrors,
  parseClinicSettings,
} from "@/lib/clinic-settings";
import { invoiceSeriesError, parseInvoiceSeries } from "@/lib/invoice-series";
import { LOGO_EXTENSIONS, validateLogoFile } from "@/lib/logo";

export type SaveClinicSettingsState =
  | { error: string }
  | { fieldErrors: ClinicSettingsFieldErrors }
  | { ok: true }
  | undefined;
export type UploadLogoState = { error: string } | { ok: true } | undefined;
export type SaveInvoiceSeriesState =
  | { error: string }
  | { ok: true }
  | undefined;

export async function saveClinicSettings(
  _prev: SaveClinicSettingsState,
  formData: FormData,
): Promise<SaveClinicSettingsState> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };

  const parsed = parseClinicSettings(formData);
  if ("fieldErrors" in parsed) return parsed;

  const { error } = await supabase
    .from("clinic_settings")
    .update(parsed.settings)
    .eq("id", true);
  if (error) return { error: "No se han podido guardar los datos." };

  revalidatePath("/clinic");
  return { ok: true };
}

export async function saveInvoiceSeries(
  _prev: SaveInvoiceSeriesState,
  formData: FormData,
): Promise<SaveInvoiceSeriesState> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };

  const parsed = parseInvoiceSeries(formData);
  if ("error" in parsed) return parsed;

  const { error } = await supabase.rpc("set_invoice_series", {
    p_code: parsed.series.code,
    p_format: parsed.series.format,
    p_year: parsed.series.year,
    p_next_number: parsed.series.next_number,
  });
  if (error) return { error: invoiceSeriesError(error, parsed.series.year) };

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
  const image = await shrinkLogo(
    new Uint8Array(await file.arrayBuffer()),
    file.type,
  ).catch(() => null);
  if (!image) return { error: "No se ha podido leer la imagen del logo." };

  const { data: current } = await supabase
    .from("clinic_settings")
    .select("logo_path")
    .eq("id", true)
    .single();
  const previousPath = current?.logo_path ?? null;

  const path = `logo-${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("branding")
    .upload(path, image, { contentType: file.type });
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

"use server";

import { requireOwner } from "@clinicalumia/api/auth";
import {
  addDays,
  isValidDate,
  madridInstant,
} from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import {
  AFFECTED_APPOINTMENTS_SELECT,
  type AffectedAppointment,
  toAffectedAppointments,
} from "@/lib/affected-appointments";

export type ClosureState =
  | { error: string }
  | { ok: true; affected: AffectedAppointment[] | null }
  | undefined;

function closureInsertError(error: { code: string; message: string }) {
  if (error.code === "23P01") return "Ya hay un cierre en esas fechas.";
  if (error.code === "23514" && error.message.includes("reason"))
    return "Indica un motivo de hasta 80 caracteres.";
  if (error.code === "23514")
    return "La fecha final no puede ser anterior a la inicial.";
  return "No se ha podido guardar el cierre.";
}

type ClosureFields = { starts_on: string; ends_on: string; reason: string };

function readClosure(formData: FormData): ClosureFields | { error: string } {
  const from = String(formData.get("starts_on") ?? "");
  const to = String(formData.get("ends_on") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!isValidDate(from) || !isValidDate(to))
    return { error: "Indica las fechas del cierre." };
  if (to < from)
    return { error: "La fecha final no puede ser anterior a la inicial." };
  if (!reason) return { error: "Indica el motivo del cierre." };
  if (reason.length > 80)
    return { error: "El motivo no puede tener más de 80 caracteres." };
  return { starts_on: from, ends_on: to, reason };
}

async function saveClosure(
  formData: FormData,
  write: (
    supabase: Awaited<ReturnType<typeof createClient>>,
    fields: ClosureFields,
  ) => PromiseLike<{ error: { code: string; message: string } | null }>,
): Promise<ClosureState> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };

  const fields = readClosure(formData);
  if ("error" in fields) return fields;

  const { error } = await write(supabase, fields);
  if (error) return { error: closureInsertError(error) };

  revalidatePath("/closures");

  const { data: appointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select(AFFECTED_APPOINTMENTS_SELECT)
    .neq("status", "cancelled")
    .lt("starts_at", madridInstant(addDays(fields.ends_on, 1), "00:00"))
    .gt("ends_at", madridInstant(fields.starts_on, "00:00"))
    .order("starts_at", { ascending: true });
  if (appointmentsError) return { ok: true, affected: null };

  return { ok: true, affected: toAffectedAppointments(appointments) };
}

export async function addClosure(
  _prev: ClosureState,
  formData: FormData,
): Promise<ClosureState> {
  return saveClosure(formData, (supabase, fields) =>
    supabase.from("clinic_closures").insert(fields),
  );
}

export async function updateClosure(
  _prev: ClosureState,
  formData: FormData,
): Promise<ClosureState> {
  const id = String(formData.get("id") ?? "");
  return saveClosure(formData, (supabase, fields) =>
    supabase.from("clinic_closures").update(fields).eq("id", id),
  );
}

export async function deleteClosure(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };
  const { error } = await supabase
    .from("clinic_closures")
    .delete()
    .eq("id", id);
  if (error) return { error: "No se ha podido eliminar el cierre." };
  revalidatePath("/closures");
  return { ok: true };
}

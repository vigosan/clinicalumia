"use server";

import { requireOwner } from "@clinicalumia/api/auth";
import {
  addDays,
  isValidDate,
  madridDayBounds,
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
import { type ScheduleBlock, validateSchedule } from "@/lib/schedule";

export type TimeOffState =
  | { error: string }
  | { ok: true; affected: AffectedAppointment[] | null }
  | undefined;

export type ClosureState =
  | { error: string }
  | { ok: true; affected: AffectedAppointment[] | null }
  | undefined;

export async function saveSchedule(
  profileId: string,
  blocks: ScheduleBlock[],
): Promise<ActionResult> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };

  const valid = validateSchedule(blocks);
  if ("error" in valid) return valid;

  const { error } = await supabase.rpc("set_employee_schedule", {
    target: profileId,
    blocks: valid.blocks,
  });
  if (error?.code === "23P01")
    return { error: "Hay tramos que se solapan el mismo día." };
  if (error) return { error: "No se ha podido guardar el horario." };

  revalidatePath("/schedules");
  return { ok: true };
}

export async function addTimeOff(
  _prev: TimeOffState,
  formData: FormData,
): Promise<TimeOffState> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };

  const profileId = String(formData.get("profile_id") ?? "");
  const from = String(formData.get("starts_on") ?? "");
  const to = String(formData.get("ends_on") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!profileId || !from || !to)
    return { error: "Indica desde y hasta cuándo." };
  if (to < from)
    return { error: "La fecha final no puede ser anterior a la inicial." };

  const { error } = await supabase.from("employee_time_off").insert({
    profile_id: profileId,
    starts_at: madridDayBounds(from).start,
    ends_at: madridDayBounds(to).end,
    reason,
  });
  if (error) return { error: "No se ha podido guardar la ausencia." };

  revalidatePath("/schedules");

  const { data: appointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select(AFFECTED_APPOINTMENTS_SELECT)
    .eq("professional_id", profileId)
    .neq("status", "cancelled")
    .lt("starts_at", madridInstant(addDays(to, 1), "00:00"))
    .gt("ends_at", madridInstant(from, "00:00"))
    .order("starts_at", { ascending: true });
  if (appointmentsError) return { ok: true, affected: null };

  return { ok: true, affected: toAffectedAppointments(appointments) };
}

export async function deleteTimeOff(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };
  const { error } = await supabase
    .from("employee_time_off")
    .delete()
    .eq("id", id);
  if (error) return { error: "No se ha podido eliminar la ausencia." };
  revalidatePath("/schedules");
  return { ok: true };
}

function closureInsertError(error: { code: string; message: string }) {
  if (error.code === "23P01") return "Ya hay un cierre en esas fechas.";
  if (error.code === "23514" && error.message.includes("reason"))
    return "Indica un motivo de hasta 80 caracteres.";
  if (error.code === "23514")
    return "La fecha final no puede ser anterior a la inicial.";
  return "No se ha podido guardar el cierre.";
}

export async function addClosure(
  _prev: ClosureState,
  formData: FormData,
): Promise<ClosureState> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };

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

  const { error } = await supabase
    .from("clinic_closures")
    .insert({ starts_on: from, ends_on: to, reason });
  if (error) return { error: closureInsertError(error) };

  revalidatePath("/schedules");

  const { data: appointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select(AFFECTED_APPOINTMENTS_SELECT)
    .neq("status", "cancelled")
    .lt("starts_at", madridInstant(addDays(to, 1), "00:00"))
    .gt("ends_at", madridInstant(from, "00:00"))
    .order("starts_at", { ascending: true });
  if (appointmentsError) return { ok: true, affected: null };

  return { ok: true, affected: toAffectedAppointments(appointments) };
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
  revalidatePath("/schedules");
  return { ok: true };
}

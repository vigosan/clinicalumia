"use server";

import { requireOwner } from "@clinicalumia/api/auth";
import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import {
  madridDayBounds,
  type ScheduleBlock,
  validateSchedule,
} from "@/lib/schedule";

export type TimeOffState = { error: string } | { ok: true } | undefined;

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
  return { ok: true };
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

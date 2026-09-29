"use server";

import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";

export async function regenerateCalendarLink(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_my_calendar_token");
  if (error)
    return { error: "No se ha podido crear el enlace. Inténtalo de nuevo." };

  revalidatePath("/mi-calendario");
  return { ok: true };
}

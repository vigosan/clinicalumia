"use server";

import { madridDateTime } from "@clinicalumia/api/madrid-time";
import { normalizeSearch, toIlikePattern } from "@clinicalumia/api/person";
import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import {
  type AppointmentInput,
  appointmentError,
  parseAppointmentForm,
  scheduleWarnings,
} from "@/lib/agenda";

export type AppointmentFormState =
  | { error: string }
  | { warnings: string[] }
  | undefined;

export type PatientOption = {
  id: string;
  first_name: string;
  last_name: string;
};

export async function searchPatients(query: string): Promise<PatientOption[]> {
  const normalized = normalizeSearch(query);
  if (!normalized) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .select("id, first_name, last_name")
    .eq("is_patient", true)
    .is("archived_at", null)
    .ilike("search_text", toIlikePattern(normalized))
    .order("last_name", { ascending: true })
    .limit(10);
  if (error) throw new Error("No se ha podido buscar.");
  return data ?? [];
}

async function resolveProfessional(
  supabase: Awaited<ReturnType<typeof createClient>>,
  professionalId: string,
): Promise<{ name: string } | { error: string }> {
  const { data: directory, error } = await supabase.rpc("staff_directory");
  if (error || !directory) return { error: "No se ha podido guardar." };
  const professional = directory.find(
    (profile) => profile.id === professionalId,
  );
  if (!professional) return { error: "Ese profesional no está activo." };
  return { name: professional.full_name };
}

async function computeWarnings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  professionalName: string,
  appointment: AppointmentInput,
): Promise<{ warnings: string[] } | { error: string }> {
  const [
    { data: schedules, error: schedulesError },
    { data: timeOff, error: timeOffError },
  ] = await Promise.all([
    supabase
      .from("employee_schedules")
      .select("weekday, starts_at, ends_at")
      .eq("profile_id", appointment.professional_id),
    supabase
      .from("employee_time_off")
      .select("starts_at, ends_at, reason")
      .eq("profile_id", appointment.professional_id)
      .lt("starts_at", appointment.ends_at)
      .gt("ends_at", appointment.starts_at),
  ]);
  if (schedulesError || !schedules)
    return { error: "No se ha podido guardar." };
  if (timeOffError || !timeOff) return { error: "No se ha podido guardar." };

  return {
    warnings: scheduleWarnings({
      professionalName,
      start: appointment.starts_at,
      end: appointment.ends_at,
      schedules,
      timeOff,
    }),
  };
}

async function findOverlapTimes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  appointment: { professional_id: string; starts_at: string; ends_at: string },
  excludeId?: string,
): Promise<{ start: string; end: string } | null> {
  let query = supabase
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("professional_id", appointment.professional_id)
    .neq("status", "cancelled")
    .lt("starts_at", appointment.ends_at)
    .gt("ends_at", appointment.starts_at);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query.limit(1).maybeSingle();
  if (!data) return null;
  return {
    start: madridDateTime(data.starts_at).time.slice(0, 5),
    end: madridDateTime(data.ends_at).time.slice(0, 5),
  };
}

export async function createAppointment(
  _prev: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  const parsed = parseAppointmentForm(formData);
  if ("error" in parsed) return parsed;
  const { appointment } = parsed;

  const supabase = await createClient();

  const professional = await resolveProfessional(
    supabase,
    appointment.professional_id,
  );
  if ("error" in professional) return professional;
  const professionalName = professional.name;

  const confirmed = String(formData.get("confirm") ?? "") === "1";

  if (!confirmed) {
    const result = await computeWarnings(
      supabase,
      professionalName,
      appointment,
    );
    if ("error" in result) return result;
    if (result.warnings.length > 0) return { warnings: result.warnings };
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert(appointment)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23P01") {
      const clash = await findOverlapTimes(supabase, appointment);
      if (clash) {
        return {
          error: `${professionalName} ya tiene una cita de ${clash.start} a ${clash.end}.`,
        };
      }
    }
    return { error: appointmentError(error) };
  }
  if (!data) return { error: "No se ha podido guardar." };

  revalidatePath("/");
  redirect(
    `/?date=${madridDateTime(appointment.starts_at).date}&appointment=${data.id}`,
  );
}

export async function moveAppointment(
  _prev: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "No se ha podido mover la cita." };

  const parsed = parseAppointmentForm(formData);
  if ("error" in parsed) return parsed;
  const { appointment } = parsed;

  if (new Date(appointment.starts_at).getTime() <= Date.now())
    return { error: "No se puede mover una cita a una hora que ya ha pasado." };

  const supabase = await createClient();

  const professional = await resolveProfessional(
    supabase,
    appointment.professional_id,
  );
  if ("error" in professional) return professional;
  const professionalName = professional.name;

  const confirmed = String(formData.get("confirm") ?? "") === "1";

  if (!confirmed) {
    const result = await computeWarnings(
      supabase,
      professionalName,
      appointment,
    );
    if ("error" in result) return result;
    if (result.warnings.length > 0) return { warnings: result.warnings };
  }

  const { data, error } = await supabase
    .from("appointments")
    .update({ starts_at: appointment.starts_at, ends_at: appointment.ends_at })
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23P01") {
      const clash = await findOverlapTimes(supabase, appointment, id);
      if (clash) {
        return {
          error: `${professionalName} ya tiene una cita de ${clash.start} a ${clash.end}.`,
        };
      }
    }
    return { error: appointmentError(error) };
  }
  if (!data || data.length === 0)
    return { error: "No se ha podido mover la cita." };

  revalidatePath("/");
  redirect(
    `/?date=${madridDateTime(appointment.starts_at).date}&appointment=${id}`,
  );
}

export async function cancelAppointment(
  id: string,
  by: "patient" | "clinic",
  reason: string,
): Promise<ActionResult> {
  if (reason.length > 2000)
    return { error: "El motivo no puede superar los 2000 caracteres." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "cancelled", cancelled_by: by, cancel_reason: reason })
    .eq("id", id)
    .select("id");
  if (error) return { error: appointmentError(error) };
  if (!data || data.length === 0)
    return { error: "No se ha podido cancelar la cita." };

  revalidatePath("/");
  return { ok: true };
}

export async function markNoShow(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "no_show" })
    .eq("id", id)
    .select("id");
  if (error) return { error: appointmentError(error) };
  if (!data || data.length === 0)
    return { error: "No se ha podido marcar como no presentada." };

  revalidatePath("/");
  return { ok: true };
}

export async function restoreFromNoShow(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "scheduled" })
    .eq("id", id)
    .select("id");
  if (error) return { error: appointmentError(error) };
  if (!data || data.length === 0)
    return { error: "No se ha podido restaurar la cita." };

  revalidatePath("/");
  return { ok: true };
}

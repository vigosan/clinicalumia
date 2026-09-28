"use server";

import { madridDateTime, madridDayBounds } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  appointmentError,
  parseAppointmentForm,
  scheduleWarnings,
} from "@/lib/agenda";
import { normalizeSearch, toIlikePattern } from "@/lib/person";

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

async function findOverlapTimes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  appointment: { professional_id: string; starts_at: string; ends_at: string },
): Promise<{ start: string; end: string } | null> {
  const { data } = await supabase
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("professional_id", appointment.professional_id)
    .neq("status", "cancelled")
    .lt("starts_at", appointment.ends_at)
    .gt("ends_at", appointment.starts_at)
    .limit(1)
    .maybeSingle();
  if (data) {
    return {
      start: madridDateTime(data.starts_at).time.slice(0, 5),
      end: madridDateTime(data.ends_at).time.slice(0, 5),
    };
  }

  const bounds = madridDayBounds(madridDateTime(appointment.starts_at).date);
  const { data: busy } = await supabase.rpc("agenda_busy", {
    p_from: bounds.start,
    p_to: bounds.end,
  });
  const clash = (busy ?? []).find(
    (row) =>
      row.professional_id === appointment.professional_id &&
      new Date(row.starts_at).getTime() <
        new Date(appointment.ends_at).getTime() &&
      new Date(row.ends_at).getTime() >
        new Date(appointment.starts_at).getTime(),
  );
  if (!clash) return null;
  return {
    start: madridDateTime(clash.starts_at).time.slice(0, 5),
    end: madridDateTime(clash.ends_at).time.slice(0, 5),
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

  const { data: directory, error: directoryError } =
    await supabase.rpc("staff_directory");
  if (directoryError || !directory)
    return { error: "No se ha podido guardar." };
  const professionalName =
    directory.find((profile) => profile.id === appointment.professional_id)
      ?.full_name ?? "";

  const confirmed = String(formData.get("confirm") ?? "") === "1";

  if (!confirmed) {
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

    const warnings = scheduleWarnings({
      professionalName,
      start: appointment.starts_at,
      end: appointment.ends_at,
      schedules,
      timeOff,
    });
    if (warnings.length > 0) return { warnings };
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

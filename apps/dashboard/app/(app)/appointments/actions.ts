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
  isPatientOverlap,
  parseAppointmentForm,
  pastTimeWarnings,
  scheduleWarnings,
} from "@/lib/agenda";
import {
  loadAppointmentTimes,
  loadNoticeRecipients,
  notifyPatient,
} from "@/lib/appointment-notice";
import { closureOn, loadClosures } from "@/lib/closures";
import { NOTICE_FAILED_PARAM } from "@/lib/notice-toast";
import { failureFor } from "@/lib/payment-failure";
import type { PaymentFailure } from "@/lib/payments";

export type AppointmentFormState =
  | { error: string }
  | { warnings: string[] }
  | undefined;

function wantsNotice(formData: FormData): boolean {
  return formData.get("notify") === "on";
}

function sameInstant(a: string, b: string): boolean {
  return new Date(a).getTime() === new Date(b).getTime();
}

function withNoticeWarning(url: string, notified: boolean): string {
  return notified ? url : `${url}&${NOTICE_FAILED_PARAM}`;
}

export type PatientOption = {
  id: string;
  first_name: string;
  last_name: string;
};

export type PatientSearchResult = PatientOption & {
  birth_date: string | null;
  phone: string | null;
};

export async function searchPatients(
  query: string,
): Promise<PatientSearchResult[]> {
  const normalized = normalizeSearch(query);
  if (!normalized) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .select("id, first_name, last_name, birth_date, phone")
    .eq("is_patient", true)
    .is("archived_at", null)
    .ilike("search_text", toIlikePattern(normalized))
    .order("last_name", { ascending: true })
    .limit(10);
  if (error) throw new Error("No se ha podido buscar.");
  return data ?? [];
}

export async function canNotifyPatient(personId: string): Promise<boolean> {
  const supabase = await createClient();
  try {
    return (await loadNoticeRecipients(supabase, personId)).length > 0;
  } catch (error) {
    console.error("No se ha podido saber a quién avisar", error);
    return false;
  }
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
    supabase.rpc("time_off_between", {
      p_profile_ids: [appointment.professional_id],
      p_from: appointment.starts_at,
      p_to: appointment.ends_at,
    }),
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
    .eq("status", "scheduled")
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
    const warnings = [
      ...pastTimeWarnings(appointment.starts_at, new Date()),
      ...result.warnings,
    ];
    if (warnings.length > 0) return { warnings };
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert(appointment)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23P01" && !isPatientOverlap(error)) {
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

  const notified =
    !wantsNotice(formData) ||
    (await notifyPatient(supabase, data.id, { kind: "confirmed" }));

  revalidatePath("/");
  redirect(
    withNoticeWarning(
      `/?date=${madridDateTime(appointment.starts_at).date}&appointment=${data.id}`,
      notified,
    ),
  );
}

async function closureWarnings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  appointment: AppointmentInput,
): Promise<{ warnings: string[] } | { error: string }> {
  const { date } = madridDateTime(appointment.starts_at);
  const closures = await loadClosures(supabase, date, date);
  if (!closures) return { error: "No se ha podido guardar." };
  const closure = closureOn(date, closures);
  return {
    warnings: closure
      ? [`La clínica está cerrada ese día (${closure.reason}).`]
      : [],
  };
}

async function notifyMove(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  previous: {
    starts_at: string;
    ends_at: string;
    professional_id: string;
    professional_name: string;
  } | null,
  appointment: AppointmentInput,
): Promise<boolean> {
  if (!previous) return false;
  if (
    sameInstant(previous.starts_at, appointment.starts_at) &&
    sameInstant(previous.ends_at, appointment.ends_at) &&
    previous.professional_id === appointment.professional_id
  )
    return true;
  return notifyPatient(supabase, id, {
    kind: "changed",
    previousStartsAt: previous.starts_at,
    ...(previous.professional_id !== appointment.professional_id && {
      previousProfessionalName: previous.professional_name,
    }),
  });
}

export async function moveAppointment(
  _prev: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "No se ha podido cambiar la fecha u hora." };

  const parsed = parseAppointmentForm(formData);
  if ("error" in parsed) return parsed;
  const { appointment } = parsed;

  if (new Date(appointment.starts_at).getTime() <= Date.now())
    return { error: "No se puede pasar una cita a una hora que ya ha pasado." };

  const supabase = await createClient();

  const professional = await resolveProfessional(
    supabase,
    appointment.professional_id,
  );
  if ("error" in professional) return professional;
  const professionalName = professional.name;

  const confirmed = String(formData.get("confirm") ?? "") === "1";

  if (!confirmed) {
    const [closed, result] = await Promise.all([
      closureWarnings(supabase, appointment),
      computeWarnings(supabase, professionalName, appointment),
    ]);
    if ("error" in closed) return closed;
    if ("error" in result) return result;
    const warnings = [...closed.warnings, ...result.warnings];
    if (warnings.length > 0) return { warnings };
  }

  const previous = wantsNotice(formData)
    ? await loadAppointmentTimes(supabase, id)
    : null;

  const { data, error } = await supabase
    .from("appointments")
    .update({
      professional_id: appointment.professional_id,
      starts_at: appointment.starts_at,
      ends_at: appointment.ends_at,
    })
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23P01" && !isPatientOverlap(error)) {
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
    return { error: "No se ha podido cambiar la fecha u hora." };

  const notified =
    !wantsNotice(formData) ||
    (await notifyMove(supabase, id, previous, appointment));

  revalidatePath("/");
  redirect(
    withNoticeWarning(
      `/?date=${madridDateTime(appointment.starts_at).date}&appointment=${id}`,
      notified,
    ),
  );
}

export async function cancelAppointment(
  id: string,
  by: "patient" | "clinic",
  reason: string,
  notify: boolean,
  rectify = false,
): Promise<{ ok: true; noticeFailed: boolean } | PaymentFailure> {
  if (reason.length > 2000)
    return { error: "El motivo no puede superar los 2000 caracteres." };

  const supabase = await createClient();
  if (rectify) {
    const { error } = await supabase.rpc(
      "cancel_appointment_with_rectification",
      { p_appointment_id: id, p_cancelled_by: by, p_reason: reason },
    );
    if (error?.code === "23514") return { error: appointmentError(error) };
    if (error?.message === "appointment_not_found")
      return { error: "No se ha podido cancelar la cita." };
    if (error) return failureFor(supabase, error);
    revalidatePath("/facturas");
  } else {
    const { data, error } = await supabase
      .from("appointments")
      .update({ status: "cancelled", cancelled_by: by, cancel_reason: reason })
      .eq("id", id)
      .select("id");
    if (error) return { error: appointmentError(error) };
    if (!data || data.length === 0)
      return { error: "No se ha podido cancelar la cita." };
  }

  const notified =
    !notify || (await notifyPatient(supabase, id, { kind: "cancelled" }));

  revalidatePath("/");
  return { ok: true, noticeFailed: !notified };
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
  if (error?.code === "23P01" && !isPatientOverlap(error))
    return { error: "Esa franja ya está ocupada por otra cita." };
  if (error) return { error: appointmentError(error) };
  if (!data || data.length === 0)
    return { error: "No se ha podido restaurar la cita." };

  revalidatePath("/");
  return { ok: true };
}

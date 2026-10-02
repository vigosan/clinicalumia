"use server";

import { sendAppointmentNotice } from "@clinicalumia/api/appointment-notice";
import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { redirect } from "next/navigation";
import {
  ANY_PROFESSIONAL,
  type BookingState,
  bookingError,
  bookingState,
  NEW_PERSON,
  parseNewPersonForm,
  personError,
  SLOT_TAKEN,
} from "@/lib/booking";
import { addPerson, PHONE_REQUIRED, saveMinor } from "./people";

export type BookingFormState = { error: string } | undefined;

type Client = Awaited<ReturnType<typeof createClient>>;

function stateFrom(formData: FormData): BookingState {
  const params = new URLSearchParams(String(formData.get("estado") ?? ""));
  return bookingState.decode(Object.fromEntries(params));
}

function reservar(state: BookingState) {
  return `/reservar?${bookingState.encode(state)}`;
}

function confirmed(appointmentId: string) {
  return `/reservar/confirmada?cita=${appointmentId}`;
}

export async function savePerson(
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const state = stateFrom(formData);
  const today = todayInMadrid();
  const supabase = await createClient();

  if (formData.get("para") !== "menor") {
    const parsed = parseNewPersonForm(formData, today);
    if ("error" in parsed) return { error: parsed.error };
    if (!parsed.person.phone) return { error: PHONE_REQUIRED };
    const { data, error } = await addPerson(supabase, parsed.person, {
      guardianId: null,
      relationship: null,
      isPatient: true,
      acceptPrivacy: formData.get("privacy") === "on",
    });
    if (error) return { error: personError(error) };
    redirect(reservar({ ...state, persona: data }));
  }

  const minor = await saveMinor(supabase, formData, today);
  if ("error" in minor) return minor;
  if ("warning" in minor)
    redirect(
      reservar({
        ...state,
        persona: NEW_PERSON,
        aviso: minor.warning,
      }),
    );
  redirect(reservar({ ...state, persona: minor.minorId }));
}

export async function completeBirthDate(
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const state = stateFrom(formData);
  const birthDate = String(formData.get("birth_date") ?? "").trim();
  if (!birthDate) return { error: "La fecha de nacimiento es obligatoria." };
  if (birthDate > todayInMadrid())
    return { error: "La fecha de nacimiento no puede ser futura." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_my_birth_date", {
    p_person_id: state.persona as string,
    p_birth_date: birthDate,
  });
  if (error) return { error: personError(error) };
  redirect(reservar(state));
}

async function findAppointment(
  supabase: Client,
  match: (appointment: {
    id: string;
    person_id: string;
    starts_at: string;
    status: string;
  }) => boolean,
) {
  const { data, error } = await supabase.rpc("my_appointments");
  if (error) throw new Error(error.message);
  return data.find(match);
}

async function emailConfirmation(supabase: Client, appointmentId: string) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const appointment = await findAppointment(
      supabase,
      (candidate) => candidate.id === appointmentId,
    );
    if (!user?.email || !appointment)
      throw new Error(`No se encuentra la cita ${appointmentId} o el email`);
    await sendAppointmentNotice({
      recipients: [user.email],
      notice: { kind: "confirmed" },
      appointment: {
        id: appointment.id,
        startsAt: appointment.starts_at,
        endsAt: appointment.ends_at,
        updatedAt: appointment.updated_at,
        serviceName: appointment.service_name,
        professionalName: appointment.professional_name,
        personName: appointment.person_name,
      },
    });
  } catch (error) {
    console.error("No se ha podido enviar el email de la cita", error);
  }
}

export async function confirmBooking(
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const state = stateFrom(formData);
  const { persona, servicio, profesional, inicio } = state;
  if (!persona || !servicio || !profesional || !inicio)
    return { error: bookingError({}) };

  const supabase = await createClient();
  const previous = await findAppointment(
    supabase,
    (appointment) =>
      appointment.person_id === persona &&
      appointment.status !== "cancelled" &&
      Date.parse(appointment.starts_at) === Date.parse(inicio),
  );
  if (previous) redirect(confirmed(previous.id));

  const { data, error } = await supabase.rpc("book_appointment", {
    p_person_id: persona,
    p_service_id: servicio,
    p_professional_id: (profesional === ANY_PROFESSIONAL
      ? null
      : profesional) as string,
    p_starts_at: inicio,
  });

  if (error?.message === "slot_not_available")
    redirect(
      reservar({
        ...state,
        inicio: undefined,
        persona: undefined,
        aviso: SLOT_TAKEN,
      }),
    );
  if (error) return { error: bookingError(error) };

  await emailConfirmation(supabase, data);
  redirect(confirmed(data));
}

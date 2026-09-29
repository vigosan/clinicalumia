"use server";

import { sendEmail } from "@clinicalumia/api/email";
import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { redirect } from "next/navigation";
import {
  ANY_PROFESSIONAL,
  type BookingState,
  bookingConfirmationEmail,
  bookingError,
  bookingState,
  NEW_PERSON,
  type NewPersonInput,
  PRIVACY_VERSION,
  parseNewPersonForm,
  personError,
  SLOT_TAKEN,
} from "@/lib/booking";

export type BookingFormState = { error: string } | undefined;

const RELATIONSHIPS = ["madre", "padre", "tutor_legal", "otro"] as const;

type Relationship = (typeof RELATIONSHIPS)[number];
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

function prefixed(formData: FormData, prefix: string) {
  const fields = new FormData();
  for (const key of ["first_name", "last_name", "birth_date", "phone"]) {
    fields.set(key, String(formData.get(`${prefix}${key}`) ?? ""));
  }
  return fields;
}

const PHONE_REQUIRED = "El teléfono es obligatorio.";

function isMinorOn(birthDate: string, today: string) {
  const adultOn = `${Number(birthDate.slice(0, 4)) + 18}${birthDate.slice(4)}`;
  return adultOn > today;
}

async function addPerson(
  supabase: Client,
  person: NewPersonInput,
  options: {
    guardianId: string | null;
    relationship: Relationship | null;
    isPatient: boolean;
    acceptPrivacy: boolean;
  },
) {
  return supabase.rpc("add_my_person", {
    p_first_name: person.first_name,
    p_last_name: person.last_name,
    p_birth_date: person.birth_date,
    p_phone: person.phone as string,
    p_guardian_id: options.guardianId as string,
    p_relationship: options.relationship as Relationship,
    p_is_patient: options.isPatient,
    p_accept_privacy: options.acceptPrivacy,
    p_privacy_version: (options.acceptPrivacy
      ? PRIVACY_VERSION
      : null) as string,
  });
}

export async function savePerson(
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const state = stateFrom(formData);
  const today = todayInMadrid();
  const acceptPrivacy = formData.get("privacy") === "on";
  const parsed = parseNewPersonForm(formData, today);
  const supabase = await createClient();

  if (formData.get("para") !== "menor") {
    if ("error" in parsed) return { error: parsed.error };
    if (!parsed.person.phone) return { error: PHONE_REQUIRED };
    const { data, error } = await addPerson(supabase, parsed.person, {
      guardianId: null,
      relationship: null,
      isPatient: true,
      acceptPrivacy,
    });
    if (error) return { error: personError(error) };
    redirect(reservar({ ...state, persona: data }));
  }

  const relationship = RELATIONSHIPS.find(
    (value) => value === formData.get("relationship"),
  );
  if (!relationship)
    return { error: personError({ message: "relationship_required" }) };
  const existingGuardian = String(formData.get("guardian_id") ?? "");
  const guardian = existingGuardian
    ? null
    : parseNewPersonForm(prefixed(formData, "guardian_"), today);
  if (guardian && "error" in guardian) return { error: guardian.error };
  if (guardian && !guardian.person.phone) return { error: PHONE_REQUIRED };
  if ("error" in parsed) return { error: parsed.error };
  if (!isMinorOn(parsed.person.birth_date, today))
    return { error: personError({ message: "person_not_minor" }) };

  let guardianId = existingGuardian;
  if (guardian) {
    const { data, error } = await addPerson(supabase, guardian.person, {
      guardianId: null,
      relationship: null,
      isPatient: false,
      acceptPrivacy,
    });
    if (error) return { error: personError(error) };
    guardianId = data;
  }

  const { data, error } = await addPerson(supabase, parsed.person, {
    guardianId,
    relationship,
    isPatient: true,
    acceptPrivacy: acceptPrivacy && !guardian,
  });
  if (error && guardian) redirect(reservar({ ...state, persona: NEW_PERSON }));
  if (error) return { error: personError(error) };
  redirect(reservar({ ...state, persona: data }));
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
    await sendEmail({
      to: user.email,
      ...bookingConfirmationEmail({
        startsAt: appointment.starts_at,
        serviceName: appointment.service_name,
        professionalName: appointment.professional_name,
        personName: appointment.person_name,
      }),
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
  const { data, error } = await supabase.rpc("book_appointment", {
    p_person_id: persona,
    p_service_id: servicio,
    p_professional_id: (profesional === ANY_PROFESSIONAL
      ? null
      : profesional) as string,
    p_starts_at: inicio,
  });

  if (error?.message === "slot_not_available") {
    const previous = await findAppointment(
      supabase,
      (appointment) =>
        appointment.person_id === persona &&
        appointment.status !== "cancelled" &&
        Date.parse(appointment.starts_at) === Date.parse(inicio),
    );
    if (previous) redirect(confirmed(previous.id));
    redirect(
      reservar({
        ...state,
        inicio: undefined,
        persona: undefined,
        aviso: SLOT_TAKEN,
      }),
    );
  }
  if (error) return { error: bookingError(error) };

  await emailConfirmation(supabase, data);
  redirect(confirmed(data));
}

"use server";

import { sendEmail } from "@clinicalumia/api/email";
import { createClient } from "@clinicalumia/api/server";
import { redirect } from "next/navigation";
import { accountError, cancelledEmail, rescheduledEmail } from "@/lib/account";
import {
  bookingState,
  type ConfirmedAppointment,
  SLOT_TAKEN,
} from "@/lib/booking";

export type AccountFormState = { error: string } | undefined;

type Client = Awaited<ReturnType<typeof createClient>>;

type AppointmentEmail = (appointment: ConfirmedAppointment) => {
  subject: string;
  html: string;
};

async function emailAccount(
  supabase: Client,
  appointmentId: string,
  email: AppointmentEmail,
) {
  try {
    const [
      {
        data: { user },
      },
      { data, error },
    ] = await Promise.all([
      supabase.auth.getUser(),
      supabase.rpc("my_appointments"),
    ]);
    if (error) throw new Error(error.message);
    const appointment = data.find(
      (candidate) => candidate.id === appointmentId,
    );
    if (!user?.email || !appointment)
      throw new Error(`No se encuentra la cita ${appointmentId} o el email`);
    await sendEmail({
      to: user.email,
      ...email({
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

async function myAppointment(supabase: Client, appointmentId: string) {
  const { data } = await supabase.rpc("my_appointments");
  return data?.find((candidate) => candidate.id === appointmentId);
}

export async function cancelAppointment(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const appointmentId = String(formData.get("cita") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_my_appointment", {
    p_appointment_id: appointmentId,
  });
  if (
    error?.message === "outside_change_window" &&
    (await myAppointment(supabase, appointmentId))?.status === "cancelled"
  )
    redirect("/mi-cuenta?aviso=cancelada");
  if (error) return { error: accountError(error) };

  await emailAccount(supabase, appointmentId, cancelledEmail);
  redirect("/mi-cuenta?aviso=cancelada");
}

export async function rescheduleAppointment(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const appointmentId = String(formData.get("cita") ?? "");
  const { inicio, fecha } = bookingState.decode({
    inicio: String(formData.get("inicio") ?? ""),
    fecha: String(formData.get("fecha") ?? ""),
  });
  if (!inicio) return { error: accountError({}) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reschedule_my_appointment", {
    p_appointment_id: appointmentId,
    p_starts_at: inicio,
  });
  if (
    error?.message === "slot_not_available" ||
    (error?.message === "outside_change_window" &&
      (await myAppointment(supabase, appointmentId))?.can_change)
  )
    redirect(
      `/mi-cuenta/citas/${appointmentId}/cambiar?${bookingState.encode({ fecha, aviso: SLOT_TAKEN })}`,
    );
  if (error) return { error: accountError(error) };

  await emailAccount(supabase, appointmentId, rescheduledEmail);
  redirect("/mi-cuenta?aviso=cambiada");
}

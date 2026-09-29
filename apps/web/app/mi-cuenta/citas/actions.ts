"use server";

import { sendEmail } from "@clinicalumia/api/email";
import { createClient } from "@clinicalumia/api/server";
import { redirect } from "next/navigation";
import { accountError, cancelledEmail } from "@/lib/account";

export type AccountFormState = { error: string } | undefined;

type Client = Awaited<ReturnType<typeof createClient>>;

async function emailCancellation(supabase: Client, appointmentId: string) {
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
      ...cancelledEmail({
        startsAt: appointment.starts_at,
        serviceName: appointment.service_name,
        professionalName: appointment.professional_name,
        personName: appointment.person_name,
      }),
    });
  } catch (error) {
    console.error("No se ha podido enviar el email de la cancelación", error);
  }
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
  if (error) return { error: accountError(error) };

  await emailCancellation(supabase, appointmentId);
  redirect("/mi-cuenta?aviso=cancelada");
}

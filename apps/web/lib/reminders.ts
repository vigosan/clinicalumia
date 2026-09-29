import type { createAdminClient } from "@clinicalumia/api/admin";
import { sendEmail } from "@clinicalumia/api/email";
import { icsCalendar } from "@clinicalumia/api/ics";
import { addDays, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { changeWindowText } from "./account";
import { escapeHtml, formatWhen } from "./booking";
import { site } from "./site";

type AdminClient = ReturnType<typeof createAdminClient>;

export type ReminderCandidate = {
  appointment_id: string;
  starts_at: string;
  ends_at: string;
  person_name: string;
  service_name: string;
  professional_name: string;
  change_deadline: string;
  can_change: boolean;
  recipients: string[];
};

const address = `${site.address.street}, ${site.address.postalCode} ${site.address.locality}`;

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export function reminderEmail(candidate: ReminderCandidate): {
  subject: string;
  html: string;
} {
  const when = lowerFirst(formatWhen(candidate.starts_at));
  return {
    subject: "Recordatorio de tu cita",
    html: `
      <h2>Recordatorio de tu cita</h2>
      <p>Te recordamos la cita de ${escapeHtml(candidate.person_name)} mañana, ${escapeHtml(when)}.</p>
      <p><strong>Servicio:</strong> ${escapeHtml(candidate.service_name)}</p>
      <p><strong>Profesional:</strong> ${escapeHtml(candidate.professional_name)}</p>
      <p><strong>Dónde:</strong> ${escapeHtml(address)}</p>
      <p>${escapeHtml(changeWindowText(candidate))}</p>
      <p><a href="${site.url}/mi-cuenta">Ver Mi cuenta</a></p>
      <p>Clínica LUMIA</p>
    `,
  };
}

export function patientIcs(candidate: ReminderCandidate): string {
  return icsCalendar({
    name: "Clínica LUMIA",
    events: [
      {
        uid: `${candidate.appointment_id}@clinicalumia.es`,
        startsAt: candidate.starts_at,
        endsAt: candidate.ends_at,
        stamp: new Date().toISOString(),
        summary: `Cita en Clínica LUMIA · ${candidate.service_name}`,
        location: address,
      },
    ],
  });
}

async function logMissingEmail(admin: AdminClient, appointmentId: string) {
  const { data, error } = await admin
    .from("appointment_reminders")
    .select("id")
    .eq("appointment_id", appointmentId)
    .eq("error", "sin_email")
    .limit(1);
  if (error) throw error;
  if (data.length > 0) return;
  const { error: insertError } = await admin
    .from("appointment_reminders")
    .insert({
      appointment_id: appointmentId,
      channel: "email",
      recipient: "",
      error: "sin_email",
    });
  if (insertError) throw insertError;
}

export async function sendDailyReminders({
  admin,
  now,
}: {
  admin: AdminClient;
  now: Date;
}): Promise<{ sent: number; failed: number; skipped: number }> {
  const result = { sent: 0, failed: 0, skipped: 0 };
  const { data: candidates, error } = await admin.rpc("reminder_candidates", {
    p_day: addDays(todayInMadrid(now), 1),
  });
  if (error) throw error;

  for (const candidate of candidates) {
    if (candidate.recipients.length === 0) {
      await logMissingEmail(admin, candidate.appointment_id);
      result.skipped++;
      continue;
    }

    const recipient = candidate.recipients.join(", ");
    try {
      await sendEmail({
        to: candidate.recipients,
        ...reminderEmail(candidate),
        attachments: [
          {
            filename: "cita.ics",
            content: patientIcs(candidate),
            contentType: "text/calendar",
          },
        ],
      });
    } catch (sendError) {
      const { error: logError } = await admin
        .from("appointment_reminders")
        .insert({
          appointment_id: candidate.appointment_id,
          channel: "email",
          recipient,
          error:
            sendError instanceof Error ? sendError.message : String(sendError),
        });
      if (logError) throw logError;
      result.failed++;
      continue;
    }

    const { error: logError } = await admin
      .from("appointment_reminders")
      .insert({
        appointment_id: candidate.appointment_id,
        channel: "email",
        recipient,
        sent_at: now.toISOString(),
      });
    if (logError?.code === "23505") {
      result.skipped++;
    } else if (logError) {
      throw logError;
    } else {
      result.sent++;
    }
  }

  return result;
}

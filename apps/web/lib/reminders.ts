import type { createAdminClient } from "@clinicalumia/api/admin";
import { sendEmail } from "@clinicalumia/api/email";
import { addDays, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { changeWindowText } from "./account";
import { appointmentIcs } from "./appointment-ics";
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

export function patientIcs(candidate: ReminderCandidate, now: Date): string {
  return appointmentIcs({
    id: candidate.appointment_id,
    startsAt: candidate.starts_at,
    endsAt: candidate.ends_at,
    serviceName: candidate.service_name,
    now,
  });
}

const STALE_CLAIM_MS = 60 * 60 * 1000;

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
      status: "failed",
      error: "sin_email",
    });
  if (insertError) throw insertError;
}

async function releaseStaleClaims(admin: AdminClient, now: Date) {
  const { error } = await admin
    .from("appointment_reminders")
    .update({ status: "failed", error: "sin_confirmar" })
    .lt("created_at", new Date(now.getTime() - STALE_CLAIM_MS).toISOString())
    .eq("status", "pending");
  if (error) throw error;
}

async function claim(
  admin: AdminClient,
  appointmentId: string,
  recipient: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("appointment_reminders")
    .insert({
      appointment_id: appointmentId,
      channel: "email",
      recipient,
      status: "pending",
    })
    .select("id")
    .single();
  if (error?.code === "23505") return null;
  if (error) throw error;
  return data.id;
}

async function settle(
  admin: AdminClient,
  claimId: string,
  outcome:
    | { status: "sent"; sent_at: string }
    | { status: "failed"; error: string },
) {
  const { error } = await admin
    .from("appointment_reminders")
    .update(outcome)
    .eq("id", claimId);
  if (error) throw error;
}

export async function sendDailyReminders({
  admin,
  now,
}: {
  admin: AdminClient;
  now: Date;
}): Promise<{ sent: number; failed: number; skipped: number }> {
  const result = { sent: 0, failed: 0, skipped: 0 };
  await releaseStaleClaims(admin, now);
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

    const claimId = await claim(
      admin,
      candidate.appointment_id,
      candidate.recipients.join(", "),
    );
    if (!claimId) {
      result.skipped++;
      continue;
    }

    try {
      await sendEmail({
        to: candidate.recipients,
        ...reminderEmail(candidate),
        attachments: [
          {
            filename: "cita.ics",
            content: patientIcs(candidate, now),
            contentType: "text/calendar",
          },
        ],
      });
    } catch (sendError) {
      await settle(admin, claimId, {
        status: "failed",
        error:
          sendError instanceof Error ? sendError.message : String(sendError),
      });
      result.failed++;
      continue;
    }

    await settle(admin, claimId, {
      status: "sent",
      sent_at: now.toISOString(),
    });
    result.sent++;
  }

  return result;
}

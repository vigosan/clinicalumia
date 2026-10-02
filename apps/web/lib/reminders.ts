import type { createAdminClient } from "@clinicalumia/api/admin";
import {
  appointmentIcs,
  escapeHtml,
  formatWhen,
} from "@clinicalumia/api/appointment-notice";
import { EmailRateLimitError, sendEmail } from "@clinicalumia/api/email";
import { addDays, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { changeWindowText } from "./account";
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
const PAUSE_BETWEEN_EMAILS_MS = 600;
const RATE_LIMIT_RETRY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWithRetry(
  email: Parameters<typeof sendEmail>[0],
  wait: (ms: number) => Promise<void>,
) {
  try {
    await sendEmail(email);
  } catch (error) {
    if (!(error instanceof EmailRateLimitError)) throw error;
    await wait(RATE_LIMIT_RETRY_MS);
    await sendEmail(email);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  wait = sleep,
}: {
  admin: AdminClient;
  now: Date;
  wait?: (ms: number) => Promise<void>;
}): Promise<{ sent: number; failed: number; skipped: number }> {
  const result = { sent: 0, failed: 0, skipped: 0 };
  let emailed = false;
  await releaseStaleClaims(admin, now);
  const { data: candidates, error } = await admin.rpc("reminder_candidates", {
    p_day: addDays(todayInMadrid(now), 1),
  });
  if (error) throw error;

  for (const candidate of candidates) {
    let claimId: string | null = null;
    try {
      if (candidate.recipients.length === 0) {
        await logMissingEmail(admin, candidate.appointment_id);
        result.skipped++;
        continue;
      }

      claimId = await claim(
        admin,
        candidate.appointment_id,
        candidate.recipients.join(", "),
      );
      if (!claimId) {
        result.skipped++;
        continue;
      }

      const message = {
        ...reminderEmail(candidate),
        attachments: [
          {
            filename: "cita.ics",
            content: patientIcs(candidate, now),
            contentType: "text/calendar",
          },
        ],
      };
      const errors: string[] = [];
      for (const recipient of candidate.recipients) {
        if (emailed) await wait(PAUSE_BETWEEN_EMAILS_MS);
        emailed = true;
        try {
          await sendWithRetry({ to: recipient, ...message }, wait);
        } catch (sendError) {
          errors.push(`${recipient}: ${errorMessage(sendError)}`);
        }
      }

      if (errors.length > 0) {
        await settle(admin, claimId, {
          status: "failed",
          error: errors.join("; "),
        });
        result.failed++;
        continue;
      }

      await settle(admin, claimId, {
        status: "sent",
        sent_at: now.toISOString(),
      });
      result.sent++;
    } catch (unexpected) {
      console.error("No se ha podido enviar el recordatorio", unexpected);
      result.failed++;
      if (claimId) {
        await settle(admin, claimId, {
          status: "failed",
          error: errorMessage(unexpected),
        }).catch(() => {});
      }
    }
  }

  return result;
}

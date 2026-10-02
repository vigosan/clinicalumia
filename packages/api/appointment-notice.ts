import { sendEmail } from "./email";
import { icsCalendar } from "./ics";
import { madridDateTime } from "./madrid-time";

const CLINIC_ADDRESS = "Calle Montesa 7, 46800 Xàtiva";

export type NoticeAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  updatedAt: string;
  serviceName: string;
  professionalName: string;
  personName: string;
};

export type AppointmentNotice =
  | { kind: "confirmed" }
  | { kind: "changed"; previousStartsAt: string }
  | { kind: "cancelled" };

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.clinicalumia.es";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatWhen(instant: string): string {
  const formatted = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(instant));
  return `${capitalize(formatted)} a las ${madridDateTime(instant).time}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function appointmentIcs({
  id,
  startsAt,
  endsAt,
  serviceName,
  now,
  updatedAt,
  method = "PUBLISH",
}: {
  id: string;
  startsAt: string;
  endsAt: string;
  serviceName: string;
  now: Date;
  updatedAt?: string;
  method?: "PUBLISH" | "REQUEST" | "CANCEL";
}): string {
  return icsCalendar({
    name: "Clínica LUMIA",
    method,
    events: [
      {
        uid: `${id}@clinicalumia.es`,
        startsAt,
        endsAt,
        stamp: now.toISOString(),
        summary: `Cita en Clínica LUMIA · ${serviceName}`,
        location: CLINIC_ADDRESS,
        ...(updatedAt && {
          sequence: Math.floor(new Date(updatedAt).getTime() / 1000),
        }),
        ...(method === "CANCEL" && { status: "CANCELLED" as const }),
      },
    ],
  });
}

const HEADINGS: Record<AppointmentNotice["kind"], string> = {
  confirmed: "Cita confirmada",
  changed: "Cita cambiada",
  cancelled: "Cita cancelada",
};

function noticeHtml(
  notice: AppointmentNotice,
  appointment: NoticeAppointment,
): string {
  const when =
    notice.kind === "changed"
      ? `<p><strong>Ahora:</strong> ${escapeHtml(formatWhen(appointment.startsAt))}</p>
      <p><strong>Antes:</strong> ${escapeHtml(formatWhen(notice.previousStartsAt))}</p>`
      : `<p><strong>Cuándo:</strong> ${escapeHtml(formatWhen(appointment.startsAt))}</p>`;
  const footer =
    notice.kind === "confirmed"
      ? `<p>Puedes verla o cambiarla en <a href="${siteUrl()}/mi-cuenta">Mi cuenta</a>.</p>`
      : `<p><a href="${siteUrl()}/mi-cuenta">Ver Mi cuenta</a></p>`;
  return `
      <h2>${HEADINGS[notice.kind]}</h2>
      ${when}
      <p><strong>Servicio:</strong> ${escapeHtml(appointment.serviceName)}</p>
      <p><strong>Profesional:</strong> ${escapeHtml(appointment.professionalName)}</p>
      <p><strong>Para:</strong> ${escapeHtml(appointment.personName)}</p>
      ${footer}
      <p>Clínica LUMIA</p>
    `;
}

export function appointmentNoticeEmail(
  notice: AppointmentNotice,
  appointment: NoticeAppointment,
  now: Date,
) {
  return {
    subject: HEADINGS[notice.kind],
    html: noticeHtml(notice, appointment),
    attachments: [
      {
        filename: "cita.ics",
        content: appointmentIcs({
          id: appointment.id,
          startsAt: appointment.startsAt,
          endsAt: appointment.endsAt,
          serviceName: appointment.serviceName,
          now,
          updatedAt: appointment.updatedAt,
          method: notice.kind === "cancelled" ? "CANCEL" : "REQUEST",
        }),
        contentType: "text/calendar",
      },
    ],
  };
}

export async function sendAppointmentNotice({
  recipients,
  notice,
  appointment,
  now = new Date(),
}: {
  recipients: string[];
  notice: AppointmentNotice;
  appointment: NoticeAppointment;
  now?: Date;
}): Promise<void> {
  const email = appointmentNoticeEmail(notice, appointment, now);
  const failures: unknown[] = [];
  for (const to of recipients) {
    try {
      await sendEmail({ to, ...email });
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) throw failures[0];
}

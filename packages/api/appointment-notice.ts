import { withDeadline } from "./deadline";
import { emailSender, sendEmail } from "./email";
import { icsCalendar } from "./ics";
import { madridDateTime } from "./madrid-time";

const CLINIC_ADDRESS = "Calle Montesa 7, 46800 Xàtiva";
const CLINIC_PHONE = "614 552 808";
const NOTICE_TIMEOUT_MS = 12_000;

export type NoticeAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  updatedAt: string;
  serviceName: string;
  professionalName: string;
  personName: string;
  changeWindow?: string;
};

export type AppointmentNotice =
  | { kind: "confirmed" }
  | {
      kind: "changed";
      previousStartsAt: string;
      previousProfessionalName?: string;
    }
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
  recipient,
}: {
  id: string;
  startsAt: string;
  endsAt: string;
  serviceName: string;
  now: Date;
  updatedAt?: string;
  method?: "PUBLISH" | "REQUEST" | "CANCEL";
  recipient?: string;
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
        ...(method !== "PUBLISH" && { organizer: emailSender() }),
        ...(method !== "PUBLISH" && recipient && { attendee: recipient }),
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
  const withWhom = (name: string | undefined) =>
    name ? ` con ${escapeHtml(name)}` : "";
  const when =
    notice.kind === "changed"
      ? `<p><strong>Ahora:</strong> ${escapeHtml(formatWhen(appointment.startsAt))}${withWhom(notice.previousProfessionalName && appointment.professionalName)}</p>
      <p><strong>Antes:</strong> ${escapeHtml(formatWhen(notice.previousStartsAt))}${withWhom(notice.previousProfessionalName)}</p>`
      : `<p><strong>Cuándo:</strong> ${escapeHtml(formatWhen(appointment.startsAt))}</p>`;
  const footer =
    notice.kind === "confirmed"
      ? `<p><strong>Dónde:</strong> ${escapeHtml(CLINIC_ADDRESS)}</p>
      <p><strong>Teléfono:</strong> ${CLINIC_PHONE}</p>
      ${appointment.changeWindow ? `<p>${escapeHtml(appointment.changeWindow)}</p>` : ""}
      <p>Puedes verla o cambiarla en <a href="${siteUrl()}/mi-cuenta">Mi cuenta</a>.</p>`
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
  recipient: string,
) {
  const method = notice.kind === "cancelled" ? "CANCEL" : "REQUEST";
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
          method,
          recipient,
        }),
        contentType: `text/calendar; method=${method}`,
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
  const results = await withDeadline(
    () =>
      Promise.allSettled(
        recipients.map((to) =>
          sendEmail({
            to,
            ...appointmentNoticeEmail(notice, appointment, now, to),
          }),
        ),
      ),
    NOTICE_TIMEOUT_MS,
    "El aviso al paciente ha tardado demasiado.",
  );
  const failure = results.find((result) => result.status === "rejected");
  if (failure) throw failure.reason;
}

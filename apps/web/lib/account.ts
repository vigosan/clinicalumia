import { madridDateTime } from "@clinicalumia/api/madrid-time";
import { isValidPhone, normalizePhone } from "@clinicalumia/api/person";
import type { DbError } from "./booking";
import { site } from "./site";

export type AppointmentRow = {
  id: string;
  person_id: string;
  person_name: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "cancelled" | "no_show";
  service_id: string;
  service_name: string;
  professional_id: string;
  professional_name: string;
  origin: "staff" | "web";
  cancelled_by: "patient" | "clinic" | null;
  change_deadline: string;
  can_change: boolean;
  can_reschedule: boolean;
  invoiced: boolean;
  updated_at: string;
};

export function splitAppointments(
  rows: AppointmentRow[],
  now: Date,
): { upcoming: AppointmentRow[]; history: AppointmentRow[] } {
  const upcoming: AppointmentRow[] = [];
  const history: AppointmentRow[] = [];
  for (const row of rows) {
    if (row.status === "scheduled" && new Date(row.starts_at) >= now) {
      upcoming.push(row);
    } else {
      history.push(row);
    }
  }
  upcoming.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  history.sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
  return { upcoming, history };
}

function changeDeadlineText(instant: string): string {
  const weekday = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
  }).format(new Date(instant));
  const { date, time } = madridDateTime(instant);
  const day = Number(date.slice(8, 10));
  return `el ${weekday} ${day} a las ${time}`;
}

const PAID_APPOINTMENT_TEXT = `Esta cita ya está pagada. Para cambiarla o cancelarla, llama a la clínica al ${site.phone.display}.`;

export function changeWindowText(
  row: Pick<AppointmentRow, "can_change" | "change_deadline"> &
    Partial<Pick<AppointmentRow, "invoiced">>,
): string {
  if (row.invoiced) return PAID_APPOINTMENT_TEXT;
  if (!row.can_change) return `Fuera de plazo: llama al ${site.phone.display}`;
  return `Puedes cambiarla o cancelarla hasta ${changeDeadlineText(row.change_deadline)}`;
}

export function canMoveTo(
  row: Pick<AppointmentRow, "starts_at" | "change_deadline">,
  startsAt: string,
  now: Date,
): boolean {
  const current = Date.parse(row.starts_at);
  const notice = current - Date.parse(row.change_deadline);
  const start = Date.parse(startsAt);
  return start !== current && start - notice > now.getTime();
}

export function statusLabel(row: AppointmentRow, now: Date): string {
  if (row.status === "cancelled" && row.cancelled_by === "patient")
    return "Cancelada por ti";
  if (row.status === "cancelled" && row.cancelled_by === "clinic")
    return "Cancelada por la clínica";
  if (row.status === "no_show") return "No asististe";
  if (row.status === "scheduled" && new Date(row.starts_at) < now)
    return "Realizada";
  return "Próxima";
}

export function parseContactForm(
  formData: FormData,
  isMinor: boolean,
): { phone: string | null; address: string } | { error: string } {
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;

  if (phone ? !isValidPhone(phone) : phoneRaw || !isMinor)
    return { error: "Escribe un teléfono válido." };

  if (address.length > 300)
    return { error: "La dirección es demasiado larga." };

  return { phone, address };
}

const ACCOUNT_MESSAGE_BY_CODE: Record<string, string> = {
  appointment_not_in_account: "Esa cita no está en tu cuenta.",
  outside_change_window: `Ya no se puede cambiar desde la web. Llama al ${site.phone.display}.`,
  slot_not_available: "Ese hueco ya no está libre. Elige otro.",
  person_has_appointment: "Esta persona ya tiene otra cita a esa hora.",
  appointment_invoiced: PAID_APPOINTMENT_TEXT,
  person_not_in_account: "Esa persona no está en tu cuenta.",
  invalid_phone: "Escribe un teléfono válido.",
  address_too_long: "La dirección es demasiado larga.",
};

export function accountError(error: DbError): string {
  const mapped = error.message && ACCOUNT_MESSAGE_BY_CODE[error.message];
  return mapped || "No se ha podido guardar. Inténtalo de nuevo.";
}

const ACCOUNT_NOTICES: Record<string, string> = {
  cancelada: "Cita cancelada",
  cambiada: "Cita cambiada",
  menor: "Menor añadido",
  contacto: "Datos guardados",
};

export function accountNotice(code: string | undefined): string | undefined {
  return code && Object.hasOwn(ACCOUNT_NOTICES, code)
    ? ACCOUNT_NOTICES[code]
    : undefined;
}

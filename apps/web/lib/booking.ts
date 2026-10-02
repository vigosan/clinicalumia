import {
  addDays,
  isValidDate,
  madridDateTime,
  monthName,
} from "@clinicalumia/api/madrid-time";
import { isValidPhone, normalizePhone } from "@clinicalumia/api/person";
import { site } from "./site";

export { formatWhen } from "@clinicalumia/api/appointment-notice";

export type Slot = { starts_at: string; professional_id: string };

export type DayGroup = {
  date: string;
  label: string;
  morning: Slot[];
  afternoon: Slot[];
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function weekdayName(date: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    weekday: "long",
  }).format(new Date(`${date}T00:00:00Z`));
}

function dayLabel(date: string, today: string): string {
  if (date === today) return "Hoy";
  if (date === addDays(today, 1)) return "Mañana";
  const day = Number(date.slice(8, 10));
  return `${capitalize(weekdayName(date))} ${day} de ${monthName(date)}`;
}

export function groupSlotsByDay(slots: Slot[], today: string): DayGroup[] {
  const byDate = new Map<string, Slot[]>();
  for (const slot of slots) {
    const { date } = madridDateTime(slot.starts_at);
    const daySlots = byDate.get(date) ?? [];
    daySlots.push(slot);
    byDate.set(date, daySlots);
  }
  return [...byDate.keys()].sort().map((date) => {
    const daySlots = byDate.get(date) as Slot[];
    const morning = daySlots.filter(
      (slot) => madridDateTime(slot.starts_at).time < "14:00",
    );
    const afternoon = daySlots.filter(
      (slot) => madridDateTime(slot.starts_at).time >= "14:00",
    );
    return { date, label: dayLabel(date, today), morning, afternoon };
  });
}

export function firstFreeSlots(slots: Slot[]): Slot[] {
  const seen = new Set<string>();
  return slots.filter((slot) => {
    if (seen.has(slot.starts_at)) return false;
    seen.add(slot.starts_at);
    return true;
  });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmail(
  input: string,
): { email: string } | { error: string } {
  const email = input.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) return { error: "Escribe un email válido." };
  return { email };
}

export type NewPersonInput = {
  first_name: string;
  last_name: string;
  birth_date: string;
  phone: string | null;
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function parseNewPersonForm(
  formData: FormData,
  today: string,
): { ok: true; person: NewPersonInput } | { error: string } {
  const firstName = text(formData, "first_name");
  const lastName = text(formData, "last_name");
  const birthDateRaw = text(formData, "birth_date");
  const phoneRaw = text(formData, "phone");

  if (!firstName) return { error: "El nombre es obligatorio." };
  if (!lastName) return { error: "Los apellidos son obligatorios." };
  if (!birthDateRaw) return { error: "La fecha de nacimiento es obligatoria." };
  if (birthDateRaw > today)
    return { error: "La fecha de nacimiento no puede ser futura." };

  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phoneRaw && !isValidPhone(phone))
    return { error: "El teléfono no es válido." };

  return {
    ok: true,
    person: {
      first_name: firstName,
      last_name: lastName,
      birth_date: birthDateRaw,
      phone,
    },
  };
}

export function isMinorOn(birthDate: string, today: string) {
  const adultOn = `${Number(birthDate.slice(0, 4)) + 18}${birthDate.slice(4)}`;
  return adultOn > today;
}

export type DbError = { message?: string };

const BOOKING_MESSAGE_BY_CODE: Record<string, string> = {
  person_not_in_account: "Esa persona no está en tu cuenta.",
  slot_not_available: "Ese hueco ya no está libre. Elige otro.",
  slot_too_soon: "Ese hueco ya no se puede reservar con tan poca antelación.",
  person_has_appointment: "Esta persona ya tiene una cita a esa hora.",
  service_not_bookable: "Este servicio se reserva por teléfono.",
  minor_needs_guardian: `Para pedir cita a un menor tiene que hacerlo su madre, padre o tutor/a desde su propia cuenta. Si necesitas ayuda, llama al ${site.phone.display}.`,
};

export function bookingError(error: DbError): string {
  const mapped = error.message && BOOKING_MESSAGE_BY_CODE[error.message];
  return mapped || "No se ha podido reservar. Inténtalo de nuevo.";
}

const PERSON_MESSAGE_BY_CODE: Record<string, string> = {
  privacy_required: "Tienes que aceptar la política de privacidad.",
  relationship_required: "Indica la relación con el menor.",
  guardian_not_in_account: "Esa persona no está en tu cuenta.",
  person_not_in_account: "Esa persona no está en tu cuenta.",
  guardian_not_adult: "La persona responsable tiene que ser mayor de edad.",
  person_not_minor: "Solo puedes añadir a un menor a tu cargo.",
  person_not_adult: "Para pedir cita para ti tienes que ser mayor de edad.",
  name_too_long:
    "El nombre y los apellidos pueden tener como mucho 100 caracteres.",
  phone_too_long: "El teléfono es demasiado largo.",
  privacy_version_too_long: "Tienes que aceptar la política de privacidad.",
  too_many_people_today: `Hoy ya has añadido muchas personas. Si necesitas añadir más, llama al ${site.phone.display}.`,
};

export function personError(error: DbError): string {
  const mapped = error.message && PERSON_MESSAGE_BY_CODE[error.message];
  return mapped || "No se han podido guardar los datos. Inténtalo de nuevo.";
}

export const PERSON_NOT_SAVED = "no_guardada";

function isPersonCode(value: string): boolean {
  return Object.hasOwn(PERSON_MESSAGE_BY_CODE, value);
}

export function personWarning(error: DbError): string {
  return error.message && isPersonCode(error.message)
    ? error.message
    : PERSON_NOT_SAVED;
}

export const STAFF_EMAIL =
  "Esta dirección es del equipo de la clínica; entra desde el panel.";

export function isTeamSession(error: unknown): boolean {
  const { code, message } = (error ?? {}) as DbError & { code?: string };
  return code === "42501" && message === "patient_account_required";
}

export const ANY_PROFESSIONAL = "cualquiera";
export const NEW_PERSON = "nueva";
export const SLOT_TAKEN = "ocupado";
export const SLOT_TOO_SOON = "antelacion";
export const PRIVACY_VERSION = "2026-09";

export type BookingState = {
  especialidad?: string;
  servicio?: string;
  profesional?: string;
  fecha?: string;
  inicio?: string;
  persona?: string;
  aviso?: string;
};

type BookingSearchParams = Record<string, string | string[] | undefined>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INSTANT_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function isProfessional(value: string): boolean {
  return value === ANY_PROFESSIONAL || isUuid(value);
}

function isPersona(value: string): boolean {
  return value === NEW_PERSON || isUuid(value);
}

function isWarning(value: string): boolean {
  return (
    value === SLOT_TAKEN ||
    value === SLOT_TOO_SOON ||
    value === PERSON_NOT_SAVED ||
    isPersonCode(value)
  );
}

function isInstant(value: string): boolean {
  return INSTANT_RE.test(value) && !Number.isNaN(Date.parse(value));
}

function validated(
  value: string | string[] | undefined,
  isValid: (value: string) => boolean,
): string | undefined {
  return typeof value === "string" && isValid(value) ? value : undefined;
}

export const bookingState = {
  encode(state: BookingState): string {
    const params = new URLSearchParams();
    if (state.especialidad) params.set("especialidad", state.especialidad);
    if (state.servicio) params.set("servicio", state.servicio);
    if (state.profesional) params.set("profesional", state.profesional);
    if (state.fecha) params.set("fecha", state.fecha);
    if (state.inicio) params.set("inicio", state.inicio);
    if (state.persona) params.set("persona", state.persona);
    if (state.aviso) params.set("aviso", state.aviso);
    return params.toString();
  },
  decode(searchParams: BookingSearchParams): BookingState {
    return {
      especialidad: validated(searchParams.especialidad, isUuid),
      servicio: validated(searchParams.servicio, isUuid),
      profesional: validated(searchParams.profesional, isProfessional),
      fecha: validated(searchParams.fecha, isValidDate),
      inicio: validated(searchParams.inicio, isInstant),
      persona: validated(searchParams.persona, isPersona),
      aviso: validated(searchParams.aviso, isWarning),
    };
  },
};

import { isValidPersonalId, normalizeTaxId } from "@clinicalumia/api/tax-id";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PersonInput = {
  first_name: string;
  last_name: string;
  birth_date: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  address: string;
  admin_notes: string;
  is_patient: boolean;
};

export function normalizePhone(input: string): string | null {
  const stripped = input.replace(/[^0-9+]/g, "");
  const cleaned = stripped.replace(/(?!^)\+/g, "");
  if (!/[0-9]/.test(cleaned)) return null;
  if (/^(\+34|0034)[0-9]{9}$/.test(cleaned)) return cleaned.slice(-9);
  return cleaned;
}

function isValidPhone(phone: string | null): boolean {
  if (!phone) return false;
  const isInternational = phone.startsWith("+");
  const digits = isInternational ? phone.slice(1) : phone;
  const minDigits = isInternational ? 8 : 9;
  return digits.length >= minDigits;
}

export function normalizeSearch(input: string): string {
  const base = input.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  if (/^[0-9\s+-]*$/.test(base)) return normalizePhone(base) ?? "";
  return base;
}

export function toIlikePattern(query: string): string {
  const escaped = query.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&");
  return `%${escaped}%`;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function ageOn(birthDate: string, today: string): number {
  const birthYear = Number(birthDate.slice(0, 4));
  const birthMonth = Number(birthDate.slice(5, 7));
  const birthDay = Number(birthDate.slice(8, 10));
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));
  const isFeb29 = birthMonth === 2 && birthDay === 29;
  const anniversaryMonth = isFeb29 && !isLeapYear(year) ? 3 : birthMonth;
  const anniversaryDay = isFeb29 && !isLeapYear(year) ? 1 : birthDay;
  let age = year - birthYear;
  if (
    month < anniversaryMonth ||
    (month === anniversaryMonth && day < anniversaryDay)
  ) {
    age -= 1;
  }
  return age;
}

export function isMinor(birthDate: string, today: string): boolean {
  return ageOn(birthDate, today) < 18;
}

export function todayInMadrid(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function parsePersonForm(
  formData: FormData,
  today: string,
): { ok: true; person: PersonInput } | { error: string } {
  const firstName = text(formData, "first_name");
  const lastName = text(formData, "last_name");
  const birthDateRaw = text(formData, "birth_date");
  const taxIdRaw = text(formData, "tax_id");
  const emailRaw = text(formData, "email");
  const phoneRaw = text(formData, "phone");
  const address = text(formData, "address");
  const adminNotes = text(formData, "admin_notes");
  const isPatient = formData.get("is_patient") === "on";

  if (!firstName) return { error: "El nombre es obligatorio." };
  if (!lastName) return { error: "Los apellidos son obligatorios." };
  if (isPatient && !birthDateRaw)
    return {
      error: "La fecha de nacimiento es obligatoria para un paciente.",
    };
  if (birthDateRaw && birthDateRaw > today)
    return { error: "La fecha de nacimiento no puede ser futura." };

  const taxId = taxIdRaw ? normalizeTaxId(taxIdRaw) || null : null;
  if (taxId && !isValidPersonalId(taxId))
    return { error: "El DNI/NIE no es válido. Revisa la letra." };

  const email = emailRaw ? emailRaw.toLowerCase() : null;
  if (email && !EMAIL_REGEX.test(email))
    return { error: "El email no es válido." };

  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phoneRaw && !isValidPhone(phone))
    return { error: "El teléfono no es válido." };

  return {
    ok: true,
    person: {
      first_name: firstName,
      last_name: lastName,
      birth_date: birthDateRaw || null,
      tax_id: taxId,
      email,
      phone,
      address,
      admin_notes: adminNotes,
      is_patient: isPatient,
    },
  };
}

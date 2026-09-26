import { parseEurosToCents } from "./money";

const VATS = ["exempt", "standard_21"] as const;
const PAYMENTS = ["none", "fixed", "percent", "full"] as const;

export type ServiceInput = {
  specialty_id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  vat: (typeof VATS)[number];
  bookable_online: boolean;
  booking_payment: (typeof PAYMENTS)[number];
  booking_payment_value: number;
  cancellation_hours: number | null;
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function isOneOf<T extends string>(
  value: string,
  options: readonly T[],
): value is T {
  return (options as readonly string[]).includes(value);
}

export function parseServiceForm(
  formData: FormData,
): { ok: true; service: ServiceInput } | { error: string } {
  const specialtyId = text(formData, "specialty_id");
  const name = text(formData, "name");
  const duration = Number(text(formData, "duration_minutes"));
  const price = parseEurosToCents(text(formData, "price"));
  const vat = text(formData, "vat");
  const payment = text(formData, "booking_payment");
  const rawValue = text(formData, "booking_payment_value");
  const rawCancellation = text(formData, "cancellation_hours");

  if (!specialtyId) return { error: "Elige una especialidad." };
  if (!name) return { error: "El nombre es obligatorio." };
  if (!Number.isInteger(duration) || duration < 5 || duration > 480)
    return { error: "La duración debe estar entre 5 y 480 minutos." };
  if (price === null)
    return { error: "El precio no es válido. Escríbelo como 45 o 45,50." };
  if (!isOneOf(vat, VATS)) return { error: "Elige el tratamiento de IVA." };
  if (!isOneOf(payment, PAYMENTS))
    return { error: "Elige qué se paga al reservar." };

  let paymentValue = 0;
  if (payment === "fixed") {
    const deposit = parseEurosToCents(rawValue);
    if (deposit === null || deposit === 0)
      return { error: "Indica el importe de la señal." };
    if (deposit > price)
      return { error: "La señal no puede ser mayor que el precio." };
    paymentValue = deposit;
  }
  if (payment === "percent") {
    const percent = Number(rawValue);
    if (!Number.isInteger(percent) || percent < 1 || percent > 100)
      return { error: "El porcentaje debe estar entre 1 y 100." };
    paymentValue = percent;
  }

  let cancellation: number | null = null;
  if (rawCancellation) {
    const hours = Number(rawCancellation);
    if (!Number.isInteger(hours) || hours < 0 || hours > 720)
      return {
        error: "El plazo de cancelación debe estar entre 0 y 720 horas.",
      };
    cancellation = hours;
  }

  return {
    ok: true,
    service: {
      specialty_id: specialtyId,
      name,
      duration_minutes: duration,
      price_cents: price,
      vat,
      bookable_online: formData.get("bookable_online") === "on",
      booking_payment: payment,
      booking_payment_value: paymentValue,
      cancellation_hours: cancellation,
    },
  };
}

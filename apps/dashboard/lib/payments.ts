import { madridDateTime, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { formatHistoryMoment } from "./madrid-format";

export type PaymentMethod = "cash" | "card" | "bizum" | "transfer";

export const METHOD_ORDER: PaymentMethod[] = [
  "cash",
  "card",
  "bizum",
  "transfer",
];

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  bizum: "Bizum",
  transfer: "Transferencia",
};

export function methodLabel(method: PaymentMethod): string {
  return METHOD_LABELS[method];
}

export type ParsedAmount = { cents: number } | { error: string };

const INVALID_AMOUNT: ParsedAmount = { error: "Escribe un importe válido." };
const MAX_CENTS = 100_000 * 100;

const THOUSANDS_DECIMAL = /^\d{1,3}(\.\d{3})+,\d{1,2}$/;
const THOUSANDS_ONLY = /^\d{1,3}(\.\d{3})+$/;
const COMMA_DECIMAL = /^\d+,\d{1,2}$/;
const DOT_DECIMAL = /^\d+\.\d{1,2}$/;
const INTEGER_ONLY = /^\d+$/;

function toCents(integerPart: string, decimalPart: string): number {
  return Number(integerPart) * 100 + Number(decimalPart.padEnd(2, "0"));
}

export function parseAmount(input: string): ParsedAmount {
  const cleaned = input.replace(/€/g, "").trim();
  let cents: number;
  if (THOUSANDS_DECIMAL.test(cleaned)) {
    const [integerPart = "", decimalPart = ""] = cleaned.split(",");
    cents = toCents(integerPart.replace(/\./g, ""), decimalPart);
  } else if (THOUSANDS_ONLY.test(cleaned)) {
    cents = toCents(cleaned.replace(/\./g, ""), "");
  } else if (COMMA_DECIMAL.test(cleaned)) {
    const [integerPart = "", decimalPart = ""] = cleaned.split(",");
    cents = toCents(integerPart, decimalPart);
  } else if (DOT_DECIMAL.test(cleaned)) {
    const [integerPart = "", decimalPart = ""] = cleaned.split(".");
    cents = toCents(integerPart, decimalPart);
  } else if (INTEGER_ONLY.test(cleaned)) {
    cents = toCents(cleaned, "");
  } else {
    return INVALID_AMOUNT;
  }
  if (cents > MAX_CENTS) return INVALID_AMOUNT;
  return { cents };
}

export function formatEuros(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

export type PaymentStatusAppointment = {
  starts_at: string;
  status: "scheduled" | "cancelled" | "no_show";
};

export type ActivePayment = {
  amount_cents: number;
  method: PaymentMethod;
  note: string;
};

export type PaymentStatus = {
  kind: "paid" | "free" | "pending" | "future" | "none";
  label: string;
};

export function paymentStatus({
  appointment,
  payment,
  now,
}: {
  appointment: PaymentStatusAppointment;
  payment: ActivePayment | null;
  now: Date;
}): PaymentStatus {
  if (payment) {
    if (payment.amount_cents === 0) {
      return {
        kind: "free",
        label: payment.note ? `Sin cargo · ${payment.note}` : "Sin cargo",
      };
    }
    return {
      kind: "paid",
      label: `Cobrada · ${formatEuros(payment.amount_cents)} · ${methodLabel(payment.method)}`,
    };
  }
  if (appointment.status !== "scheduled") return { kind: "none", label: "" };
  if (new Date(appointment.starts_at).getTime() > now.getTime())
    return { kind: "future", label: "" };
  return { kind: "pending", label: "Pendiente de cobro" };
}

export type PaymentPill = {
  label: string;
  tone: "success" | "warning";
};

export function paymentPill(
  input: Parameters<typeof paymentStatus>[0],
): PaymentPill | null {
  const { kind, label } = paymentStatus(input);
  if (kind === "paid" && input.payment)
    return {
      label: `Cobrada · ${methodLabel(input.payment.method)}`,
      tone: "success",
    };
  if (kind === "free") return { label, tone: "success" };
  if (kind === "pending") return { label: "Pendiente", tone: "warning" };
  return null;
}

export type AgendaPaymentState = "paid" | "pending" | "no_show";

export type AgendaPaymentIcon = { state: AgendaPaymentState; label: string };

export function agendaPaymentIcon({
  status,
  startsAt,
  paid,
  now,
}: {
  status: "scheduled" | "no_show";
  startsAt: string;
  paid: boolean;
  now: Date;
}): AgendaPaymentIcon | null {
  if (paid) return { state: "paid", label: "Cobrada" };
  if (status === "no_show") return { state: "no_show", label: "No presentada" };
  if (new Date(startsAt).getTime() > now.getTime()) return null;
  return { state: "pending", label: "Pendiente de cobro" };
}

export type MethodTotal = { method: PaymentMethod; cents: number };

export type PaymentHistoryRow = {
  amount_cents: number;
  method: PaymentMethod;
  collected_at: string;
  collected_by: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string;
};

export function paymentHistoryLines(
  payment: PaymentHistoryRow,
  nameById: Map<string, string>,
): string[] {
  const collectorName = nameById.get(payment.collected_by) ?? "el sistema";
  const lines = [
    `Cobrada · ${formatEuros(payment.amount_cents)} · ${methodLabel(payment.method)} por ${collectorName} el ${formatHistoryMoment(payment.collected_at)}`,
  ];
  if (payment.voided_at && payment.voided_by) {
    const voidedByName = nameById.get(payment.voided_by) ?? "el sistema";
    lines.push(
      `Cobro anulado · ${payment.void_reason} por ${voidedByName} el ${formatHistoryMoment(payment.voided_at)}`,
    );
  }
  return lines;
}

export type DbError = { code?: string; message?: string; details?: string };

const ERROR_MESSAGE_BY_CODE: Record<string, string> = {
  already_paid: "Esta cita ya está cobrada.",
  note_required: "Indica el motivo del cambio de importe.",
  appointment_cancelled_needs_note:
    "Indica por qué se cobra una cita cancelada.",
  invalid_amount: "Escribe un importe válido.",
  invalid_method: "Elige la forma de pago.",
  reason_required: "Indica el motivo de la anulación.",
  not_allowed:
    "Solo puede anular este cobro quien lo registró hoy o la propietaria.",
  already_voided: "Este cobro ya está anulado.",
  appointment_not_found:
    "Solo la profesional de la cita o la propietaria pueden cobrarla.",
  payment_not_found: "Este cobro ya no está disponible.",
  full_invoice_required:
    "Este importe supera los 400 € de una factura simplificada: completa los datos del destinatario para emitir la factura completa.",
  invoice_already_rectified: "Esta factura ya está rectificada.",
  invoice_already_replaced: "Esta factura ya tiene factura completa.",
  invoice_not_simplified: "Esta factura ya no es simplificada.",
  invoice_not_full:
    "Solo se puede corregir el destinatario de una factura completa.",
  recipient_unchanged: "Los datos del destinatario no han cambiado.",
  recipient_tax_id_invalid:
    "Escribe un DNI, NIE o CIF válido. Otros documentos (pasaporte, NIF extranjero) no se admiten todavía.",
  recipient_invalid: "Completa nombre, NIF, dirección, código postal y ciudad.",
  clinic_tax_id_changed:
    "El NIF de la clínica ha cambiado desde la factura original. Consulta con la gestoría.",
  invoice_not_found: "Esta factura ya no está disponible.",
};

export function paymentError(error: DbError): string {
  if (error.code === "42501") return "No tienes permiso para hacer esto.";
  if (error.code === "P0001" && error.message) {
    const mapped = ERROR_MESSAGE_BY_CODE[error.message];
    if (mapped) return mapped;
  }
  return "No se ha podido guardar. Inténtalo de nuevo.";
}

export type ErrorLink = { href: string; label: string };

export type PaymentFailure = { error: string; link?: ErrorLink };

export type Viewer = { isOwner: boolean; adminUrl: string };

const UNCONFIGURED_SERIES: Record<string, { name: string; blocked: string }> = {
  invoice_series_not_configured: {
    name: "las facturas",
    blocked: "no se pueden emitir facturas ni registrar cobros",
  },
  rectifying_series_not_configured: {
    name: "las rectificativas",
    blocked: "no se pueden anular cobros facturados",
  },
};

const CLINIC_FIELD_LABELS: Record<string, string> = {
  legal_name: "razón social",
  tax_id: "NIF",
  address_line: "dirección",
  postal_code: "código postal",
  city: "ciudad",
};

function listInSpanish(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`;
}

export function needsViewer(error: DbError): boolean {
  return (
    error.code === "P0001" &&
    (error.message === "clinic_fiscal_data_missing" ||
      Object.hasOwn(UNCONFIGURED_SERIES, error.message ?? ""))
  );
}

export function paymentFailure(error: DbError, viewer: Viewer): PaymentFailure {
  if (!needsViewer(error)) return { error: paymentError(error) };
  const series = UNCONFIGURED_SERIES[error.message ?? ""];
  if (series) {
    if (!viewer.isOwner)
      return {
        error: `Falta configurar la numeración de ${series.name}. Avisa a la propietaria para que la confirme en el admin.`,
      };
    return {
      error: `Falta configurar la numeración de ${series.name}: hasta que la confirmes ${series.blocked}.`,
      link: {
        href: `${viewer.adminUrl}/clinic`,
        label: "Configurar la numeración",
      },
    };
  }
  const missing = (error.details ?? "")
    .split(",")
    .flatMap((field) => CLINIC_FIELD_LABELS[field] ?? []);
  const fields = listInSpanish(
    missing.length > 0 ? missing : ["razón social", "NIF"],
  );
  const action = viewer.isOwner
    ? "Complétalos en el admin, en Datos de la clínica."
    : "Avisa a la propietaria para que los complete en el admin.";
  return {
    error: `Faltan datos de la clínica para la factura: ${fields}. ${action}`,
  };
}

export function needsPaymentNote({
  cancelled,
  amount,
  suggestedAmountCents,
  error,
}: {
  cancelled: boolean;
  amount: string;
  suggestedAmountCents: number;
  error: string | null;
}): boolean {
  const parsed = parseAmount(amount);
  return (
    cancelled ||
    !("cents" in parsed) ||
    parsed.cents !== suggestedAmountCents ||
    error === paymentError({ code: "P0001", message: "note_required" })
  );
}

const SIMPLIFIED_INVOICE_LIMIT_CENTS = 40_000;

export function recipientRequested(previous: boolean, error: string): boolean {
  return (
    previous ||
    error === paymentError({ code: "P0001", message: "full_invoice_required" })
  );
}

export function needsRecipient({
  amount,
  requested,
}: {
  amount: string;
  requested: boolean;
}): boolean {
  const parsed = parseAmount(amount);
  return (
    requested ||
    ("cents" in parsed && parsed.cents > SIMPLIFIED_INVOICE_LIMIT_CENTS)
  );
}

export function canVoidPayment({
  payment,
  userId,
  isOwner,
  now,
}: {
  payment: { collected_by: string; collected_at: string };
  userId: string;
  isOwner: boolean;
  now: Date;
}): boolean {
  if (isOwner) return true;
  return (
    payment.collected_by === userId &&
    madridDateTime(payment.collected_at).date === todayInMadrid(now)
  );
}

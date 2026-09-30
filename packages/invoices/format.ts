import type { InvoicePayment } from "./types";

const METHOD_PHRASES: Record<string, string> = {
  card: "Pagado con tarjeta",
  cash: "Pagado en efectivo",
  bizum: "Pagado por Bizum",
  transfer: "Pagado por transferencia",
};

const METHOD_NAMES: Record<string, string> = {
  online: "señal online",
  card: "tarjeta",
  cash: "efectivo",
  bizum: "Bizum",
  transfer: "transferencia",
};

export function formatEuros(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

export function madridDateParts(instant: string): {
  day: string;
  month: string;
  year: string;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return { day: part("day")!, month: part("month")!, year: part("year")! };
}

export function formatMadridDate(instant: string): string {
  const { day, month, year } = madridDateParts(instant);
  return `${day}/${month}/${year}`;
}

export function formatSessionDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

export function paymentSummary(payments: InvoicePayment[] | null): string {
  if (!payments || payments.length === 0) return "";
  const [only] = payments;
  if (payments.length === 1 && only && METHOD_PHRASES[only.method]) {
    return METHOD_PHRASES[only.method]!;
  }
  const detail = payments
    .map(
      (p) =>
        `${METHOD_NAMES[p.method] ?? p.method} ${formatEuros(p.amount_cents)}`,
    )
    .join(" · ");
  return `Pagado: ${detail}`;
}

export function invoiceFileName(code: string): string {
  const safe = code.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `factura-${safe}.pdf`;
}

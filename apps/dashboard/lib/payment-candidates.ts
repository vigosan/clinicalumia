import { madridDateTime, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { formatEuros, type PaymentMethod } from "./payments";
import { formatPaymentMoment } from "./payments-load";

export type PaymentCandidate = {
  id: string;
  startsAt: string;
  patientName: string;
  serviceName: string;
  professionalName: string;
  suggestedAmountCents: number;
};

function byStart(a: PaymentCandidate, b: PaymentCandidate): number {
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

export function groupPaymentCandidates(
  candidates: PaymentCandidate[],
  now: Date,
): { today: PaymentCandidate[]; earlier: PaymentCandidate[] } {
  const today = todayInMadrid(now);
  const unique = [
    ...new Map(
      candidates.map((candidate) => [candidate.id, candidate]),
    ).values(),
  ];
  const isToday = (candidate: PaymentCandidate) =>
    madridDateTime(candidate.startsAt).date === today;
  return {
    today: unique.filter(isToday).sort(byStart),
    earlier: unique
      .filter((candidate) => !isToday(candidate))
      .sort((a, b) => byStart(b, a)),
  };
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function filterPaymentCandidates(
  candidates: PaymentCandidate[],
  query: string,
): PaymentCandidate[] {
  const needle = normalize(query);
  if (!needle) return candidates;
  return candidates.filter((candidate) =>
    normalize(candidate.patientName).includes(needle),
  );
}

export function candidateMoment(startsAt: string, now: Date): string {
  const { date, time } = madridDateTime(startsAt);
  return date === todayInMadrid(now)
    ? `Hoy ${time.slice(0, 5)}`
    : formatPaymentMoment(startsAt, true);
}

export function pendingTabLabel(count: number | null): string {
  return count === null ? "Pendientes" : `Pendientes (${count})`;
}

const METHOD_PHRASES: Record<PaymentMethod, string> = {
  cash: "en efectivo",
  card: "con tarjeta",
  bizum: "por Bizum",
  transfer: "por transferencia",
};

export function paymentToastMessage(
  amountCents: number,
  method: PaymentMethod,
): string {
  if (amountCents === 0) return "Cobro registrado · Sin cargo";
  return `Cobro registrado · ${formatEuros(amountCents)} ${METHOD_PHRASES[method]}`;
}

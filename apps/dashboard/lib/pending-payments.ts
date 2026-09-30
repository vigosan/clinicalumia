import {
  addDays,
  madridDateTime,
  madridDayBounds,
  todayInMadrid,
} from "@clinicalumia/api/madrid-time";
import type { createClient } from "@clinicalumia/api/server";
import { formatPaymentMoment } from "./payments-load";

type Client = Awaited<ReturnType<typeof createClient>>;

export const PENDING_WINDOW_DAYS = 60;

export function pendingWindow(now: Date): { start: string; end: string } {
  return {
    start: madridDayBounds(addDays(todayInMadrid(now), -PENDING_WINDOW_DAYS))
      .start,
    end: now.toISOString(),
  };
}

export function computeSuggestedAmountCents(appointment: {
  price_cents: number;
  payment_status: string;
  payment_amount_cents: number;
}): number {
  const deposit =
    appointment.payment_status === "paid"
      ? appointment.payment_amount_cents
      : 0;
  return Math.max(appointment.price_cents - deposit, 0);
}

export function hasActivePayment(
  payments: { voided_at: string | null }[],
): boolean {
  return payments.some((payment) => payment.voided_at === null);
}

export type PendingAppointmentRow = {
  id: string;
  moment: string;
  patientName: string;
  serviceName: string;
  professionalName: string;
  suggestedAmountCents: number;
  href: string;
};

type PendingAppointmentSource = {
  id: string;
  starts_at: string;
  price_cents: number;
  payment_status: string;
  payment_amount_cents: number;
  professional_id: string;
  patient: { first_name: string; last_name: string } | null;
  service: { name: string } | null;
  payments: { voided_at: string | null }[] | null;
};

function toRow(
  appointment: PendingAppointmentSource,
  nameById: Map<string, string>,
): PendingAppointmentRow {
  const { date } = madridDateTime(appointment.starts_at);
  return {
    id: appointment.id,
    moment: formatPaymentMoment(appointment.starts_at, true),
    patientName: appointment.patient
      ? `${appointment.patient.first_name} ${appointment.patient.last_name}`
      : "—",
    serviceName: appointment.service?.name ?? "—",
    professionalName:
      nameById.get(appointment.professional_id) ?? "Profesional",
    suggestedAmountCents: computeSuggestedAmountCents(appointment),
    href: `/?date=${date}&appointment=${appointment.id}`,
  };
}

export type LoadPendingPaymentsResult =
  | { ok: true; data: PendingAppointmentRow[] }
  | { ok: false };

export async function loadPendingPayments(
  supabase: Client,
  now: Date,
): Promise<LoadPendingPaymentsResult> {
  const { start, end } = pendingWindow(now);

  const [{ data: rows, error }, { data: directory, error: directoryError }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select(
          "id, starts_at, price_cents, payment_status, payment_amount_cents, professional_id, patient:people(first_name, last_name), service:services(name), payments(voided_at)",
        )
        .gte("starts_at", start)
        .lte("starts_at", end)
        .neq("status", "cancelled")
        .order("starts_at", { ascending: true }),
      supabase.rpc("staff_directory"),
    ]);

  if (error || directoryError) return { ok: false };

  const nameById = new Map(
    (directory ?? []).map((profile) => [profile.id, profile.full_name]),
  );

  const data = (rows ?? [])
    .filter((row) => !hasActivePayment(row.payments ?? []))
    .map((row) => toRow(row, nameById));

  return { ok: true, data };
}

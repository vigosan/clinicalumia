import {
  addDays,
  madridDateTime,
  madridDayBounds,
  todayInMadrid,
} from "@clinicalumia/api/madrid-time";
import type { createClient } from "@clinicalumia/api/server";
import type { PaymentCandidate } from "./payment-candidates";
import { formatPaymentMoment } from "./payments-load";

type Client = Awaited<ReturnType<typeof createClient>>;

export const PENDING_WINDOW_DAYS = 60;

export function pendingSince(now: Date): string {
  return madridDayBounds(addDays(todayInMadrid(now), -PENDING_WINDOW_DAYS))
    .start;
}

export type PendingAppointmentRow = {
  id: string;
  startsAt: string;
  moment: string;
  patientName: string;
  serviceName: string;
  professionalName: string;
  suggestedAmountCents: number;
  href: string;
};

type PendingAppointmentSource = {
  appointment_id: string;
  starts_at: string;
  patient_name: string;
  service_name: string;
  professional_id: string;
  suggested_cents: number;
};

function toRow(
  appointment: PendingAppointmentSource,
  nameById: Map<string, string>,
): PendingAppointmentRow {
  const { date } = madridDateTime(appointment.starts_at);
  return {
    id: appointment.appointment_id,
    startsAt: appointment.starts_at,
    moment: formatPaymentMoment(appointment.starts_at, true),
    patientName: appointment.patient_name,
    serviceName: appointment.service_name,
    professionalName:
      nameById.get(appointment.professional_id) ?? "Profesional",
    suggestedAmountCents: appointment.suggested_cents,
    href: `/?date=${date}&appointment=${appointment.appointment_id}`,
  };
}

export type LoadPendingPaymentsResult =
  | { ok: true; data: PendingAppointmentRow[] }
  | { ok: false };

export async function loadPendingPayments(
  supabase: Client,
  now: Date,
): Promise<LoadPendingPaymentsResult> {
  const [{ data: rows, error }, { data: directory, error: directoryError }] =
    await Promise.all([
      supabase.rpc("pending_payments", { p_since: pendingSince(now) }),
      supabase.rpc("staff_directory"),
    ]);

  if (error || directoryError) return { ok: false };

  const nameById = new Map(
    (directory ?? []).map((profile) => [profile.id, profile.full_name]),
  );

  const data = (rows ?? []).map((row) => toRow(row, nameById));

  return { ok: true, data };
}

export type LoadLaterTodayResult =
  | { ok: true; data: PaymentCandidate[] }
  | { ok: false };

export async function loadLaterTodayCandidates(
  supabase: Client,
  now: Date,
): Promise<LoadLaterTodayResult> {
  const [{ data: rows, error }, { data: directory, error: directoryError }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select(
          "id, starts_at, professional_id, patient:people(first_name, last_name), service:services(name), payments(voided_at)",
        )
        .gt("starts_at", now.toISOString())
        .lt("starts_at", madridDayBounds(addDays(todayInMadrid(now), 1)).start)
        .neq("status", "cancelled")
        .order("starts_at"),
      supabase.rpc("staff_directory"),
    ]);
  if (error || directoryError) return { ok: false };

  const nameById = new Map(
    (directory ?? []).map((profile) => [profile.id, profile.full_name]),
  );
  const unpaid = (rows ?? []).filter(
    (row) => !row.payments.some((payment) => payment.voided_at === null),
  );
  const suggested = await Promise.all(
    unpaid.map((row) =>
      supabase.rpc("suggested_amount", { p_appointment_id: row.id }),
    ),
  );
  if (suggested.some((result) => result.error || result.data === null))
    return { ok: false };

  return {
    ok: true,
    data: unpaid.map((row, index) => ({
      id: row.id,
      startsAt: row.starts_at,
      patientName: row.patient
        ? `${row.patient.first_name} ${row.patient.last_name}`
        : "—",
      serviceName: row.service?.name ?? "—",
      professionalName: nameById.get(row.professional_id) ?? "Profesional",
      suggestedAmountCents: suggested[index]?.data ?? 0,
    })),
  };
}

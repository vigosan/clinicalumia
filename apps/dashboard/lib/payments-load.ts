import {
  addDays,
  isValidDate,
  madridDateTime,
  madridDayBounds,
} from "@clinicalumia/api/madrid-time";
import type { createClient } from "@clinicalumia/api/server";
import { isUuid } from "./agenda";
import type { MethodTotal, PaymentMethod } from "./payments";

type Client = Awaited<ReturnType<typeof createClient>>;

export const MAX_RANGE_DAYS = 92;
export const MAX_LIST_ROWS = 1000;

export type CobrosParams = {
  desde: string;
  hasta: string;
  profesionalId: string | null;
};

function rangeDays(desde: string, hasta: string): number {
  const start = new Date(`${desde}T00:00:00Z`).getTime();
  const end = new Date(`${hasta}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000) + 1;
}

export function cobrosListParams(
  search: { desde?: string; hasta?: string; profesional?: string },
  today: string,
): CobrosParams {
  const desde = search.desde ?? today;
  const hasta = search.hasta ?? today;
  const profesionalId =
    search.profesional && isUuid(search.profesional)
      ? search.profesional
      : null;
  const valid =
    isValidDate(desde) &&
    isValidDate(hasta) &&
    desde <= hasta &&
    rangeDays(desde, hasta) <= MAX_RANGE_DAYS;
  if (!valid) return { desde: today, hasta: today, profesionalId };
  return { desde, hasta, profesionalId };
}

export function cobrosListHref({
  desde,
  hasta,
  profesionalId,
}: CobrosParams): string {
  const params = new URLSearchParams({ desde, hasta });
  if (profesionalId) params.set("profesional", profesionalId);
  return `/cobros?${params.toString()}`;
}

export function formatPaymentMoment(
  instant: string,
  includeDate: boolean,
): string {
  const { date, time } = madridDateTime(instant);
  const hhmm = time.slice(0, 5);
  return includeDate
    ? `${date.slice(8, 10)}/${date.slice(5, 7)} ${hhmm}`
    : hhmm;
}

export function momentHeader(includeDate: boolean): string {
  return includeDate ? "Fecha y hora" : "Hora";
}

export function paymentStateLabel({
  entry,
  voidedAt,
  voidReason,
}: {
  entry: PaymentEntry;
  voidedAt: string | null;
  voidReason: string;
}): string {
  if (entry === "voided") return `Anulado · ${voidReason}`;
  if (!voidedAt) return "Válido";
  const { date } = madridDateTime(voidedAt);
  return `Anulado el ${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

export type StaffOption = {
  id: string;
  fullName: string;
  specialtyName: string | null;
};

export type PaymentEntry = "collected" | "voided";

export type PaymentRow = {
  id: string;
  entry: PaymentEntry;
  moment: string;
  amountCents: number;
  method: PaymentMethod;
  collectedAt: string;
  collectedBy: string;
  voidedAt: string | null;
  voidReason: string;
  professionalId: string;
  patientId: string;
  patientName: string;
  serviceName: string;
};

export type CobrosData = {
  payments: PaymentRow[];
  staffOptions: StaffOption[];
  nameById: Map<string, string>;
  isOwner: boolean;
  totals: { methods: MethodTotal[]; total: number };
  truncated: boolean;
};

export type LoadCobrosResult = { ok: true; data: CobrosData } | { ok: false };

export async function loadCobros(
  supabase: Client,
  { desde, hasta, profesionalId }: CobrosParams,
): Promise<LoadCobrosResult> {
  const start = madridDayBounds(desde).start;
  const end = madridDayBounds(addDays(hasta, 1)).start;

  const [
    { data: rows, error: paymentsError },
    { data: totalRows, error: totalsError },
    { data: directory, error: directoryError },
    { data: specialties, error: specialtiesError },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase.rpc("list_payments", {
      p_start: start,
      p_end: end,
      p_professional_id: profesionalId ?? undefined,
    }),
    supabase.rpc("payment_totals", {
      p_start: start,
      p_end: end,
      p_professional_id: profesionalId ?? undefined,
    }),
    supabase.rpc("staff_directory"),
    supabase.from("specialties").select("id, name"),
    supabase.auth.getUser(),
  ]);

  if (
    paymentsError ||
    totalsError ||
    directoryError ||
    specialtiesError ||
    !user
  )
    return { ok: false };

  const specialtyNameById = new Map(
    (specialties ?? []).map((specialty) => [specialty.id, specialty.name]),
  );
  const staffOptions: StaffOption[] = (directory ?? [])
    .map((profile) => ({
      id: profile.id,
      fullName: profile.full_name,
      specialtyName: profile.specialty_id
        ? (specialtyNameById.get(profile.specialty_id) ?? null)
        : null,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));

  const nameById = new Map(
    staffOptions.map((option) => [option.id, option.fullName]),
  );

  const isOwner =
    (directory ?? []).find((profile) => profile.id === user.id)?.role ===
    "owner";

  const payments: PaymentRow[] = (rows ?? []).map((row) => ({
    id: row.id,
    entry: row.entry as PaymentEntry,
    moment: row.moment,
    amountCents: row.amount_cents,
    method: row.method as PaymentMethod,
    collectedAt: row.collected_at,
    collectedBy: row.collected_by,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    professionalId: row.professional_id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    serviceName: row.service_name,
  }));

  const methods = (totalRows ?? [])
    .filter((row) => row.cents !== 0)
    .map((row) => ({ method: row.method as PaymentMethod, cents: row.cents }));
  const totals = {
    methods,
    total: methods.reduce((sum, entry) => sum + entry.cents, 0),
  };

  return {
    ok: true,
    data: {
      payments,
      staffOptions,
      nameById,
      isOwner,
      totals,
      truncated: payments.length >= MAX_LIST_ROWS,
    },
  };
}

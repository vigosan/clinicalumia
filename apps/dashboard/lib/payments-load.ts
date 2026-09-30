import {
  addDays,
  isValidDate,
  madridDayBounds,
} from "@clinicalumia/api/madrid-time";
import type { createClient } from "@clinicalumia/api/server";
import { isUuid } from "./agenda";
import type { PaymentMethod } from "./payments";

type Client = Awaited<ReturnType<typeof createClient>>;

export const MAX_RANGE_DAYS = 92;

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

export type StaffOption = {
  id: string;
  fullName: string;
  specialtyName: string | null;
};

export type PaymentRow = {
  id: string;
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
    supabase.rpc("staff_directory"),
    supabase.from("specialties").select("id, name"),
    supabase.auth.getUser(),
  ]);

  if (paymentsError || directoryError || specialtiesError || !user)
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

  return { ok: true, data: { payments, staffOptions, nameById, isOwner } };
}

import {
  formatMadridDate,
  isValidDate,
  monthEnd,
} from "@clinicalumia/api/madrid-time";
import type { createClient } from "@clinicalumia/api/server";
import { isUuid } from "./agenda";
import type { InvoiceRecipient } from "./invoices";
import type { StaffOption } from "./payments-load";

type Client = Awaited<ReturnType<typeof createClient>>;

export const INVOICES_PAGE_SIZE = 25;

export type InvoiceKindFilter = "" | "simplified" | "full" | "rectifying";

export const INVOICE_KIND_OPTIONS: {
  value: InvoiceKindFilter;
  label: string;
}[] = [
  { value: "", label: "Todas" },
  { value: "simplified", label: "Simplificadas" },
  { value: "full", label: "Completas" },
  { value: "rectifying", label: "Rectificativas" },
];

const KIND_VALUES = new Set(["simplified", "full", "rectifying"]);

export type InvoicesParams = {
  desde: string;
  hasta: string;
  kind: InvoiceKindFilter;
  q: string;
  profesionalId: string | null;
  page: number;
};

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function invoicesListParams(
  search: {
    desde?: string;
    hasta?: string;
    tipo?: string;
    q?: string;
    profesional?: string;
    pagina?: string;
  },
  today: string,
): InvoicesParams {
  const defaultDesde = monthStart(today);
  const defaultHasta = monthEnd(today);
  const desde =
    search.desde && isValidDate(search.desde) ? search.desde : defaultDesde;
  const hastaCandidate =
    search.hasta && isValidDate(search.hasta) ? search.hasta : defaultHasta;
  const rangeValid = hastaCandidate >= desde;
  const kind: InvoiceKindFilter = KIND_VALUES.has(search.tipo ?? "")
    ? (search.tipo as InvoiceKindFilter)
    : "";
  const profesionalId =
    search.profesional && isUuid(search.profesional)
      ? search.profesional
      : null;
  const page = Number(search.pagina);
  return {
    desde: rangeValid ? desde : defaultDesde,
    hasta: rangeValid ? hastaCandidate : defaultHasta,
    kind,
    q: search.q ?? "",
    profesionalId,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function invoicesListHref({
  desde,
  hasta,
  kind,
  q,
  profesionalId,
  page,
}: InvoicesParams): string {
  const params = new URLSearchParams({ desde, hasta });
  if (kind) params.set("tipo", kind);
  if (q) params.set("q", q);
  if (profesionalId) params.set("profesional", profesionalId);
  if (page > 1) params.set("pagina", String(page));
  return `/facturas?${params.toString()}`;
}

export function invoiceKindLabel(
  kind: "simplified" | "full" | "rectifying",
): string {
  if (kind === "simplified") return "Simplificada";
  if (kind === "full") return "Completa";
  return "Rectificativa";
}

export function invoiceStatusLabel(row: {
  status: "issued" | "replaced";
  replacedByCode: string | null;
  rectifiedByCode: string | null;
}): string {
  if (row.status === "replaced" && row.replacedByCode)
    return `Sustituida por ${row.replacedByCode}`;
  if (row.rectifiedByCode) return `Rectificada por ${row.rectifiedByCode}`;
  return "Emitida";
}

export function invoiceRecipientLabel(row: {
  recipientName: string | null;
  patientName: string;
}): string {
  return row.recipientName ?? row.patientName;
}

export function invoicesPageCount(totalCount: number): number {
  return Math.max(1, Math.ceil(totalCount / INVOICES_PAGE_SIZE));
}

export function formatInvoiceDate(instant: string): string {
  return formatMadridDate(instant);
}

export type InvoiceRow = {
  id: string;
  code: string;
  kind: "simplified" | "full" | "rectifying";
  status: "issued" | "replaced";
  issuedAt: string;
  totalCents: number;
  recipientName: string | null;
  patientId: string;
  patientName: string;
  professionalId: string;
  replacedByCode: string | null;
  rectifiedByCode: string | null;
};

export type InvoicesData = {
  rows: InvoiceRow[];
  totalCount: number | null;
  staffOptions: StaffOption[];
  isOwner: boolean;
};

export type LoadInvoicesResult =
  | { ok: true; data: InvoicesData }
  | { ok: false };

export async function loadInvoices(
  supabase: Client,
  params: InvoicesParams,
): Promise<LoadInvoicesResult> {
  const offset = (params.page - 1) * INVOICES_PAGE_SIZE;
  const [
    { data: rows, error },
    { data: directory, error: directoryError },
    { data: specialties, error: specialtiesError },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase.rpc("list_invoices", {
      p_start: params.desde,
      p_end: params.hasta,
      p_kind: params.kind || undefined,
      p_query: params.q || undefined,
      p_professional_id: params.profesionalId ?? undefined,
      p_limit: INVOICES_PAGE_SIZE,
      p_offset: offset,
    }),
    supabase.rpc("staff_directory"),
    supabase.from("specialties").select("id, name"),
    supabase.auth.getUser(),
  ]);

  if (error || directoryError || specialtiesError || !user)
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

  const isOwner =
    (directory ?? []).find((profile) => profile.id === user.id)?.role ===
    "owner";

  return {
    ok: true,
    data: {
      rows: (rows ?? []).map((row) => ({
        id: row.id,
        code: row.code,
        kind: row.kind,
        status: row.status,
        issuedAt: row.issued_at,
        totalCents: row.total_cents,
        recipientName: row.recipient_name,
        patientId: row.patient_id,
        patientName: row.patient_name,
        professionalId: row.professional_id,
        replacedByCode: row.replaced_by_code,
        rectifiedByCode: row.rectified_by_code,
      })),
      totalCount: rows?.[0]?.total_count ?? null,
      staffOptions,
      isOwner,
    },
  };
}

export async function loadLastFullRecipient(
  supabase: Client,
  patientId: string,
): Promise<InvoiceRecipient | null> {
  const { data } = await supabase
    .from("invoices")
    .select(
      "snapshot, rectified:invoices!rectifies_invoice_id(id), payments!inner(appointments!inner(patient_id))",
    )
    .eq("kind", "full")
    .eq("payments.appointments.patient_id", patientId)
    .order("issued_at", { ascending: false })
    .order("number", { ascending: false })
    .limit(10);
  const inForce = (data ?? []).find((row) => row.rectified.length === 0);
  const snapshot = inForce?.snapshot as {
    recipient?: InvoiceRecipient;
  } | null;
  return snapshot?.recipient ?? null;
}

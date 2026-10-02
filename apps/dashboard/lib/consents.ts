import { normalizeSearch, toIlikePattern } from "@clinicalumia/api/person";
import type { createClient } from "@clinicalumia/api/server";
import { formatMadridDateTime } from "./madrid-format";

type Client = Awaited<ReturnType<typeof createClient>>;

export const CONSENTS_PAGE_SIZE = 25;

export type ConsentsListParams = {
  q: string;
  pendingOnly: boolean;
  page: number;
};

export function consentsListParams(
  search: { q?: string; pendientes?: string; pagina?: string },
  hasPending: boolean,
): ConsentsListParams {
  const page = Number(search.pagina);
  return {
    q: search.q ?? "",
    pendingOnly:
      search.pendientes === undefined ? hasPending : search.pendientes === "1",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function consentsListHref({
  q,
  pendingOnly,
  page,
}: ConsentsListParams): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("pendientes", pendingOnly ? "1" : "0");
  if (page > 1) params.set("pagina", String(page));
  return `/consentimientos?${params.toString()}`;
}

export function consentsPageCount(total: number): number {
  return Math.max(1, Math.ceil(total / CONSENTS_PAGE_SIZE));
}

export function consentsListResult<Row>({
  data,
  error,
  count,
}: {
  data: Row[] | null;
  error: { code?: string } | null;
  count: number | null;
}): { consents: Row[]; failed: boolean; total: number } {
  return {
    consents: data ?? [],
    failed: Boolean(error) && error?.code !== "PGRST103",
    total: count ?? 0,
  };
}

export function formatSignedAt(instant: string): string {
  return formatMadridDateTime(instant);
}

export function linkedPersonLabel(person: {
  first_name: string;
  last_name: string;
  archived_at: string | null;
}): string {
  const name = `${person.first_name} ${person.last_name}`;
  return person.archived_at ? `${name} (ficha archivada)` : name;
}

export function listConsents(
  supabase: Client,
  { q, pendingOnly, page }: ConsentsListParams,
) {
  const from = (page - 1) * CONSENTS_PAGE_SIZE;
  let query = supabase
    .from("consents")
    .select(
      "id, signed_at, first_name, last_name, tax_id, person:people(id, first_name, last_name, archived_at)",
      { count: "exact" },
    )
    .order("signed_at", { ascending: false })
    .range(from, from + CONSENTS_PAGE_SIZE - 1);
  if (pendingOnly) query = query.is("person_id", null);
  const normalized = normalizeSearch(q);
  if (normalized)
    query = query.ilike("search_text", toIlikePattern(normalized));
  return query;
}

export async function hasPendingConsents(supabase: Client): Promise<boolean> {
  const { count } = await supabase
    .from("consents")
    .select("id", { count: "exact", head: true })
    .is("person_id", null);
  return (count ?? 0) > 0;
}

export const CONSENT_FILL_FIELDS = ["tax_id", "email", "birth_date"] as const;

export type ConsentFillField = (typeof CONSENT_FILL_FIELDS)[number];

export type ConsentFillOffer = {
  field: ConsentFillField;
  label: string;
  value: string;
};

export function consentOwnTaxId(consent: {
  tax_id: string | null;
  guardian_tax_id: string | null;
  guardian_name: string;
}): string | null {
  if (consent.guardian_name && !consent.guardian_tax_id) return null;
  return consent.tax_id;
}

export function consentFillOffers(
  consent: {
    tax_id: string | null;
    guardian_tax_id: string | null;
    guardian_name: string;
    email: string | null;
    birth_date: string;
  },
  person: {
    tax_id: string | null;
    email: string | null;
    birth_date: string | null;
  },
): ConsentFillOffer[] {
  const offers: ConsentFillOffer[] = [];
  const ownTaxId = consentOwnTaxId(consent);
  if (!person.tax_id && ownTaxId)
    offers.push({ field: "tax_id", label: "DNI/NIE", value: ownTaxId });
  if (!person.email && consent.email && !consent.guardian_name)
    offers.push({ field: "email", label: "Email", value: consent.email });
  if (!person.birth_date)
    offers.push({
      field: "birth_date",
      label: "Fecha de nacimiento",
      value: consent.birth_date.split("-").reverse().join("/"),
    });
  return offers;
}

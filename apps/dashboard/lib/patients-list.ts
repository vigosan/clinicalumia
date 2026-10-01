import { normalizeSearch, toIlikePattern } from "@clinicalumia/api/person";
import type { createClient } from "@clinicalumia/api/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export const PATIENTS_PAGE_SIZE = 25;

export type PatientsListParams = {
  q: string;
  archived: boolean;
  page: number;
};

export function patientsListParams(search: {
  q?: string;
  archived?: string;
  pagina?: string;
}): PatientsListParams {
  const page = Number(search.pagina);
  return {
    q: search.q ?? "",
    archived: search.archived === "1",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function patientsListHref({
  q,
  archived,
  page,
}: PatientsListParams): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (archived) params.set("archived", "1");
  if (page > 1) params.set("pagina", String(page));
  const search = params.toString();
  return search ? `/patients?${search}` : "/patients";
}

export function patientsPageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PATIENTS_PAGE_SIZE));
}

export function listPatients(
  supabase: Client,
  { q, archived, page }: PatientsListParams,
) {
  const from = (page - 1) * PATIENTS_PAGE_SIZE;
  let query = supabase
    .from("people")
    .select("id, first_name, last_name, birth_date, phone, is_patient", {
      count: "exact",
    })
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })
    .order("id", { ascending: true })
    .range(from, from + PATIENTS_PAGE_SIZE - 1);
  query = archived
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);
  const normalized = normalizeSearch(q);
  if (normalized)
    query = query.ilike("search_text", toIlikePattern(normalized));
  return query;
}

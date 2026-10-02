"use server";

import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import {
  isMinor,
  normalizeSearch,
  parsePersonForm,
  toIlikePattern,
} from "@clinicalumia/api/person";
import { safeNext } from "@clinicalumia/api/route";
import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { isUuid } from "@/lib/agenda";
import { consentLinkErrorCode } from "@/lib/consent-link-error";
import type { DuplicateFields } from "@/lib/duplicate-checker";
import { guardianErrorCode } from "@/lib/guardian-error";
import { formatMadridDateTime } from "@/lib/madrid-format";
import type { Ward } from "@/lib/ward-label";
import { linkConsent } from "../consentimientos/actions";

export type PersonFormState =
  | { error: string; existingId?: string }
  | undefined;

export type Duplicate = {
  id: string;
  first_name: string;
  last_name: string;
  matched: string[];
  archived: boolean;
  wards: Ward[];
};

const TAX_ID_TAKEN = "Ya hay una ficha con ese DNI/NIE.";

function mapPersonError(
  error: { code?: string; message?: string; details?: string } | null,
): string | null {
  if (!error) return null;
  if (error.code === "23505") {
    const text = `${error.message ?? ""} ${error.details ?? ""}`;
    if (text.includes("people_tax_id_key")) return TAX_ID_TAKEN;
    return "No se ha podido guardar.";
  }
  if (error.code === "23514")
    return "Revisa los datos: hay un campo no válido.";
  if (error.code === "42501") return "No tienes permiso para hacer esto.";
  return "No se ha podido guardar.";
}

async function personErrorState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  message: string,
  taxId: string | null,
  exclude: string | undefined,
): Promise<PersonFormState> {
  if (message !== TAX_ID_TAKEN || !taxId) return { error: message };
  const { data } = await supabase.rpc("find_possible_duplicates", {
    p_tax_id: taxId,
    p_email: "",
    p_phone: "",
    p_exclude: exclude,
  });
  const existing = (data as Duplicate[] | null)?.find((row) =>
    row.matched.includes("tax_id"),
  );
  return existing
    ? { error: message, existingId: existing.id }
    : { error: message };
}

export async function savePerson(
  _prev: PersonFormState,
  formData: FormData,
): Promise<PersonFormState> {
  const today = todayInMadrid();
  const parsed = parsePersonForm(formData, today);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");

  if (id) {
    const { data, error } = await supabase
      .from("people")
      .update(parsed.person)
      .eq("id", id)
      .select("id");
    const mapped = mapPersonError(error);
    if (mapped)
      return personErrorState(supabase, mapped, parsed.person.tax_id, id);
    if (!data || data.length === 0)
      return { error: "No tienes permiso para hacer esto." };

    revalidatePath("/patients");
    redirect(`/patients/${id}`);
  }

  const returnTo = safeAppointmentReturn(
    String(formData.get("return_to") ?? ""),
  );
  const guardianOf = String(formData.get("guardian_of") ?? "");
  const relationship = String(
    formData.get("relationship") ?? "otro",
  ) as Ward["relationship"];
  const isPrimary = formData.get("is_primary") === "on";
  const consentIdRaw = String(formData.get("consent_id") ?? "");
  const consentId = isUuid(consentIdRaw) ? consentIdRaw : null;

  if (guardianOf) {
    if (parsed.person.birth_date && isMinor(parsed.person.birth_date, today))
      return { error: "El tutor/a tiene que ser mayor de edad." };

    if (isPrimary) {
      const { data: existingPrimary } = await supabase
        .from("guardianships")
        .select("guardian_id")
        .eq("minor_id", guardianOf)
        .eq("is_primary", true)
        .maybeSingle();
      if (existingPrimary) return { error: "Ya tiene tutor/a principal." };
    }
  }

  const { data, error } = await supabase
    .from("people")
    .insert(parsed.person)
    .select("id")
    .single();
  const mapped = mapPersonError(error);
  if (mapped)
    return personErrorState(supabase, mapped, parsed.person.tax_id, undefined);
  if (!data) return { error: "No tienes permiso para hacer esto." };

  revalidatePath("/patients");

  if (consentId) {
    const linkResult = await linkConsent(consentId, data.id);
    if ("error" in linkResult) {
      redirect(
        `/consentimientos/${consentId}?linkError=${consentLinkErrorCode(linkResult.error)}`,
      );
    }
    redirect(`/consentimientos/${consentId}`);
  }

  if (guardianOf) {
    const guardianResult = await addGuardian(
      guardianOf,
      data.id,
      relationship,
      isPrimary,
    );
    if ("error" in guardianResult) {
      redirect(
        `/patients/${guardianOf}?guardianError=${guardianErrorCode(guardianResult.error)}`,
      );
    }
    redirect(`/patients/${guardianOf}`);
  }

  if (returnTo) {
    redirect(
      `${returnTo}${returnTo.includes("?") ? "&" : "?"}patient=${data.id}`,
    );
  }

  redirect(`/patients/${data.id}`);
}

function safeAppointmentReturn(value: string): string | null {
  const target = safeNext(value);
  return target.startsWith("/appointments/new") ? target : null;
}

export async function checkDuplicates(
  input: DuplicateFields & { exclude?: string },
): Promise<Duplicate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_possible_duplicates", {
    p_tax_id: input.tax_id,
    p_email: input.email,
    p_phone: input.phone,
    p_first_name: input.first_name,
    p_last_name: input.last_name,
    p_birth_date: input.birth_date || undefined,
    p_exclude: input.exclude,
  });
  if (error) return [];
  return (data as Duplicate[] | null) ?? [];
}

export type GuardianCandidate = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  phone: string | null;
};

export async function searchGuardianCandidates(
  query: string,
  minorId: string,
): Promise<GuardianCandidate[]> {
  const normalized = normalizeSearch(query);
  if (!normalized) return [];

  const supabase = await createClient();
  const { data: existingGuardians } = await supabase
    .from("guardianships")
    .select("guardian_id")
    .eq("minor_id", minorId);
  const excludeIds = [
    minorId,
    ...(existingGuardians ?? []).map((row) => row.guardian_id),
  ];

  const { data, error } = await supabase
    .from("people")
    .select("id, first_name, last_name, birth_date, phone")
    .is("archived_at", null)
    .not("id", "in", `(${excludeIds.join(",")})`)
    .ilike("search_text", toIlikePattern(normalized))
    .order("last_name", { ascending: true })
    .limit(10);
  if (error) throw new Error("No se ha podido buscar.");
  return data ?? [];
}

function mapGuardianshipError(
  error: { code?: string; message?: string; details?: string } | null,
): string | null {
  if (!error) return null;
  if (error.code === "23505") {
    const text = `${error.message ?? ""} ${error.details ?? ""}`;
    if (text.includes("guardianships_one_primary"))
      return "Ya tiene tutor/a principal.";
    if (text.includes("guardianships_pkey"))
      return "Ya es tutor/a de este menor.";
    return "No se ha podido guardar.";
  }
  return "No se ha podido guardar.";
}

export async function addGuardian(
  minorId: string,
  guardianId: string,
  relationship: Ward["relationship"],
  isPrimary: boolean,
): Promise<ActionResult> {
  if (guardianId === minorId)
    return { error: "Nadie puede ser su propio tutor/a." };

  const supabase = await createClient();
  const { data: guardian } = await supabase
    .from("people")
    .select("birth_date")
    .eq("id", guardianId)
    .maybeSingle();
  if (guardian?.birth_date && isMinor(guardian.birth_date, todayInMadrid()))
    return { error: "El tutor/a tiene que ser mayor de edad." };

  const { error } = await supabase.from("guardianships").insert({
    minor_id: minorId,
    guardian_id: guardianId,
    relationship,
    is_primary: isPrimary,
  });
  const mapped = mapGuardianshipError(error);
  if (mapped) return { error: mapped };

  revalidatePath(`/patients/${minorId}`);
  revalidatePath(`/patients/${guardianId}`);
  return { ok: true };
}

export async function removeGuardian(
  minorId: string,
  guardianId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: isOwner } = await supabase.rpc("is_owner");
  if (isOwner !== true)
    return { error: "Solo la propietaria puede quitar tutores." };
  const { data, error } = await supabase
    .from("guardianships")
    .delete()
    .eq("minor_id", minorId)
    .eq("guardian_id", guardianId)
    .select("minor_id");
  if (error) return { error: "No se ha podido quitar el tutor/a." };
  if (!data || data.length === 0)
    return { error: "No se ha podido quitar el tutor/a." };

  revalidatePath(`/patients/${minorId}`);
  revalidatePath(`/patients/${guardianId}`);
  return { ok: true };
}

export type UpcomingAppointment = {
  id: string;
  when: string;
  professional: string;
};

export async function setArchived(
  id: string,
  archived: boolean,
): Promise<
  { ok: true } | { error: string; appointments?: UpcomingAppointment[] }
> {
  const supabase = await createClient();
  const { data: isOwner } = await supabase.rpc("is_owner");
  if (isOwner !== true)
    return {
      error: "Solo la propietaria puede archivar o desarchivar fichas.",
    };
  if (archived) {
    const { data: upcoming, error: upcomingError } = await supabase.rpc(
      "person_upcoming_appointments",
      { p_person_id: id },
    );
    if (upcomingError || !upcoming)
      return { error: "No se han podido comprobar sus citas pendientes." };
    if (upcoming.length > 0)
      return {
        error: "Cancela o mueve antes estas citas.",
        appointments: upcoming.map((appointment) => ({
          id: appointment.id,
          when: formatMadridDateTime(appointment.starts_at),
          professional: appointment.professional_name,
        })),
      };
  }
  const { data, error } = await supabase
    .from("people")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error?.message === "person_has_upcoming_appointments")
    return { error: "Cancela o mueve antes estas citas." };
  if (error) return { error: "No se ha podido actualizar." };
  if (!data || data.length === 0)
    return { error: "No se ha podido actualizar." };

  revalidatePath("/patients");
  revalidatePath(`/patients/${id}`);
  return { ok: true };
}

export async function deletePerson(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23503") {
      const text = `${error.message ?? ""} ${error.details ?? ""}`;
      if (text.includes("guardianships_guardian_id_fkey"))
        return { error: "No se puede eliminar: tiene menores a su cargo." };
      return {
        error:
          "No se puede eliminar: tiene citas, cobros o consentimientos. Archívala.",
      };
    }
    return { error: "No se ha podido eliminar." };
  }
  if (!data || data.length === 0)
    return { error: "Solo la propietaria puede eliminar fichas." };

  revalidatePath("/patients");
  redirect("/patients");
}

import { addDays } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { ANY_PROFESSIONAL, firstFreeSlots, type Slot } from "@/lib/booking";

export const WINDOW_DAYS = 14;

export type Professional = { id: string; full_name: string };

export type CatalogService = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  phoneOnly: boolean;
};

export type CatalogSpecialty = {
  id: string;
  name: string;
  services: CatalogService[];
  professionals: Professional[];
};

export async function loadCatalog(): Promise<CatalogSpecialty[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("booking_catalog");
  if (error) throw error;

  const specialties = new Map<string, CatalogSpecialty>();
  for (const row of data) {
    const specialty = specialties.get(row.specialty_id) ?? {
      id: row.specialty_id,
      name: row.specialty_name,
      services: [],
      professionals: row.professionals as Professional[],
    };
    specialty.services.push({
      id: row.service_id,
      name: row.service_name,
      durationMinutes: row.duration_minutes,
      priceCents: row.price_cents,
      phoneOnly: row.phone_only,
    });
    specialties.set(row.specialty_id, specialty);
  }

  const collator = new Intl.Collator("es-ES");
  return [...specialties.values()]
    .map((specialty) => ({
      ...specialty,
      services: specialty.services.sort((a, b) =>
        collator.compare(a.name, b.name),
      ),
    }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

export async function loadSlots(
  serviceId: string,
  professional: string,
  from: string,
): Promise<Slot[]> {
  const supabase = await createClient();
  const anyProfessional = professional === ANY_PROFESSIONAL;
  const { data, error } = await supabase.rpc("available_slots", {
    p_service_id: serviceId,
    p_professional_id: (anyProfessional ? null : professional) as string,
    p_from: from,
    p_to: addDays(from, WINDOW_DAYS - 1),
  });
  if (error) throw error;
  return anyProfessional ? firstFreeSlots(data) : data;
}

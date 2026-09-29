import { addDays } from "@clinicalumia/api/madrid-time";
import { ANY_PROFESSIONAL, type BookingState } from "@/lib/booking";

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

type Chosen = { specialty: CatalogSpecialty; service: CatalogService };

export type BookingStep =
  | { kind: "empty" }
  | { kind: "specialty"; catalog: CatalogSpecialty[] }
  | { kind: "service"; specialty: CatalogSpecialty }
  | ({ kind: "phoneOnly" } & Chosen)
  | ({ kind: "professional" } & Chosen)
  | ({
      kind: "slots";
      professional: string;
      from: string;
      nextFrom: string | null;
    } & Chosen)
  | ({
      kind: "chosen";
      professional: string;
      from: string;
      startsAt: string;
    } & Chosen);

export function bookingStep({
  catalog,
  state,
  today,
  horizonDays,
  now,
}: {
  catalog: CatalogSpecialty[];
  state: BookingState;
  today: string;
  horizonDays: number;
  now: Date;
}): BookingStep {
  if (catalog.length === 0) return { kind: "empty" };

  const specialty =
    catalog.find((candidate) =>
      candidate.services.some((service) => service.id === state.servicio),
    ) ?? catalog.find((candidate) => candidate.id === state.especialidad);
  if (!specialty) return { kind: "specialty", catalog };

  const service = specialty.services.find(
    (candidate) => candidate.id === state.servicio,
  );
  if (!service) return { kind: "service", specialty };
  if (service.phoneOnly) return { kind: "phoneOnly", specialty, service };

  const professional = state.profesional;
  const knownProfessional =
    professional === ANY_PROFESSIONAL ||
    specialty.professionals.some((candidate) => candidate.id === professional);
  if (!professional || !knownProfessional)
    return { kind: "professional", specialty, service };

  const lastDay = addDays(today, horizonDays);
  const from =
    state.fecha && state.fecha >= today && state.fecha <= lastDay
      ? state.fecha
      : today;

  if (state.inicio && Date.parse(state.inicio) > now.getTime())
    return {
      kind: "chosen",
      specialty,
      service,
      professional,
      from,
      startsAt: state.inicio,
    };

  const nextFrom = addDays(from, WINDOW_DAYS);
  return {
    kind: "slots",
    specialty,
    service,
    professional,
    from,
    nextFrom: nextFrom <= lastDay ? nextFrom : null,
  };
}

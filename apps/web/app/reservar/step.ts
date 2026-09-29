import { addDays } from "@clinicalumia/api/madrid-time";
import { ANY_PROFESSIONAL, type BookingState, NEW_PERSON } from "@/lib/booking";

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

export type AccountPerson = {
  id: string;
  first_name: string;
  last_name: string;
  is_minor: boolean;
  is_patient: boolean;
  relation: string;
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
    } & Chosen)
  | ({
      kind: "who";
      professional: string;
      from: string;
      startsAt: string;
      people: AccountPerson[];
    } & Chosen)
  | ({
      kind: "details";
      professional: string;
      from: string;
      startsAt: string;
      firstTime: boolean;
      guardians: AccountPerson[];
    } & Chosen)
  | ({
      kind: "summary";
      professional: string;
      from: string;
      startsAt: string;
      person: AccountPerson;
    } & Chosen);

export function bookingStep({
  catalog,
  state,
  today,
  horizonDays,
  now,
  people = null,
}: {
  catalog: CatalogSpecialty[];
  state: BookingState;
  today: string;
  horizonDays: number;
  now: Date;
  people?: AccountPerson[] | null;
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

  if (state.inicio && Date.parse(state.inicio) > now.getTime()) {
    const chosen = {
      specialty,
      service,
      professional,
      from,
      startsAt: state.inicio,
    };
    if (!people) return { kind: "chosen", ...chosen };
    const bookable = people.filter((person) => person.is_patient);
    const person = bookable.find((candidate) => candidate.id === state.persona);
    if (person) return { kind: "summary", ...chosen, person };
    if (state.persona === NEW_PERSON || bookable.length === 0)
      return {
        kind: "details",
        ...chosen,
        firstTime: people.length === 0,
        guardians: people.filter(
          (candidate) => candidate.relation === "self" && !candidate.is_minor,
        ),
      };
    return { kind: "who", ...chosen, people: bookable };
  }

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

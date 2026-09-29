import { addDays, madridDateTime } from "@clinicalumia/api/madrid-time";
import {
  ANY_PROFESSIONAL,
  type BookingState,
  groupSlotsByDay,
  NEW_PERSON,
  personError,
  SLOT_TAKEN,
  type Slot,
} from "@/lib/booking";
import type { PickerDay } from "./SlotPicker";

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
  birth_date: string | null;
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
      needsPrivacy: boolean;
      guardians: AccountPerson[];
      warning: string | null;
    } & Chosen)
  | ({
      kind: "birthDate";
      professional: string;
      from: string;
      startsAt: string;
      person: AccountPerson;
    } & Chosen)
  | ({
      kind: "summary";
      professional: string;
      from: string;
      startsAt: string;
      person: AccountPerson;
    } & Chosen);

export function pickerDays(
  slots: Slot[],
  today: string,
  hrefFor: (slot: Slot) => string,
): PickerDay[] {
  const toPicker = (slot: Slot) => ({
    startsAt: slot.starts_at,
    time: madridDateTime(slot.starts_at).time,
    href: hrefFor(slot),
  });
  return groupSlotsByDay(slots, today).map((day) => ({
    date: day.date,
    label: day.label,
    morning: day.morning.map(toPicker),
    afternoon: day.afternoon.map(toPicker),
  }));
}

export function slotWindow({
  fecha,
  today,
  horizonDays,
}: {
  fecha: string | undefined;
  today: string;
  horizonDays: number;
}): { from: string; nextFrom: string | null } {
  const lastDay = addDays(today, horizonDays);
  const from = fecha && fecha >= today && fecha <= lastDay ? fecha : today;
  const nextFrom = addDays(from, WINDOW_DAYS);
  return { from, nextFrom: nextFrom <= lastDay ? nextFrom : null };
}

export function bookingStep({
  catalog,
  state,
  today,
  horizonDays,
  now,
  people = null,
  privacyAccepted = false,
}: {
  catalog: CatalogSpecialty[];
  state: BookingState;
  today: string;
  horizonDays: number;
  now: Date;
  people?: AccountPerson[] | null;
  privacyAccepted?: boolean;
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

  const { from, nextFrom } = slotWindow({
    fecha: state.fecha,
    today,
    horizonDays,
  });

  if (state.inicio && Date.parse(state.inicio) > now.getTime()) {
    const chosen = {
      specialty,
      service,
      professional,
      from,
      startsAt: state.inicio,
    };
    if (!people) return { kind: "chosen", ...chosen };
    const person = people.find((candidate) => candidate.id === state.persona);
    if (person?.birth_date === null)
      return { kind: "birthDate", ...chosen, person };
    if (person) return { kind: "summary", ...chosen, person };
    if (state.persona === NEW_PERSON || people.length === 0)
      return {
        kind: "details",
        ...chosen,
        firstTime: people.length === 0,
        needsPrivacy: !privacyAccepted,
        guardians: people.filter(
          (candidate) =>
            candidate.relation === "self" &&
            !candidate.is_minor &&
            candidate.birth_date !== null,
        ),
        warning:
          state.aviso && state.aviso !== SLOT_TAKEN
            ? personError({ message: state.aviso })
            : null,
      };
    return { kind: "who", ...chosen, people };
  }

  return {
    kind: "slots",
    specialty,
    service,
    professional,
    from,
    nextFrom,
  };
}

import { describe, expect, it } from "vitest";
import {
  type AccountPerson,
  bookingStep,
  type CatalogSpecialty,
  pickerDays,
  slotWindow,
} from "./step";

const SPECIALTY = "11111111-1111-1111-1111-111111111111";
const SERVICE = "22222222-2222-2222-2222-222222222222";
const PHONE_SERVICE = "33333333-3333-3333-3333-333333333333";
const PROFESSIONAL = "44444444-4444-4444-4444-444444444444";
const UNKNOWN = "99999999-9999-9999-9999-999999999999";
const MOTHER = "55555555-5555-5555-5555-555555555555";
const CHILD = "66666666-6666-6666-6666-666666666666";

const catalog: CatalogSpecialty[] = [
  {
    id: SPECIALTY,
    name: "Logopedia",
    professionals: [{ id: PROFESSIONAL, full_name: "Ana" }],
    services: [
      {
        id: SERVICE,
        name: "Sesión",
        durationMinutes: 45,
        priceCents: 4500,
        phoneOnly: false,
      },
      {
        id: PHONE_SERVICE,
        name: "Valoración",
        durationMinutes: 60,
        priceCents: 6000,
        phoneOnly: true,
      },
    ],
  },
];

const today = "2026-09-29";
const now = new Date("2026-09-29T08:00:00Z");
const base = { catalog, today, horizonDays: 60, now };
const slotState = {
  especialidad: SPECIALTY,
  servicio: SERVICE,
  profesional: PROFESSIONAL,
};

describe("bookingStep", () => {
  it("shows an empty state when nothing can be booked online, so the page still offers the phone", () => {
    expect(bookingStep({ ...base, catalog: [], state: {} }).kind).toBe("empty");
  });

  it("starts at the specialty list without any choice", () => {
    expect(bookingStep({ ...base, state: {} }).kind).toBe("specialty");
  });

  it("falls back to the services of the chosen specialty when the service is unknown or no longer bookable", () => {
    const step = bookingStep({
      ...base,
      state: { especialidad: SPECIALTY, servicio: UNKNOWN },
    });
    expect(step.kind).toBe("service");
  });

  it("stops at the phone for a service that cannot be booked online", () => {
    const step = bookingStep({
      ...base,
      state: { especialidad: SPECIALTY, servicio: PHONE_SERVICE },
    });
    expect(step.kind).toBe("phoneOnly");
  });

  it("asks for the professional when the one in the URL is not of the specialty", () => {
    const step = bookingStep({
      ...base,
      state: { ...slotState, profesional: UNKNOWN },
    });
    expect(step.kind).toBe("professional");
  });

  it("starts the slot window at the requested date inside the horizon", () => {
    const step = bookingStep({
      ...base,
      state: { ...slotState, fecha: "2026-10-13" },
    });
    expect(step).toMatchObject({ kind: "slots", from: "2026-10-13" });
  });

  it("starts the slot window today for a date past the horizon, so a crafted far-future date never breaks the page", () => {
    const step = bookingStep({
      ...base,
      state: { ...slotState, fecha: "9999-12-25" },
    });
    expect(step).toMatchObject({ kind: "slots", from: today });
  });

  it("starts the slot window today for a date in the past", () => {
    const step = bookingStep({
      ...base,
      state: { ...slotState, fecha: "2026-09-01" },
    });
    expect(step).toMatchObject({ kind: "slots", from: today });
  });

  it("offers the next days only while they start within the horizon, because later there can be no slots", () => {
    expect(
      bookingStep({ ...base, state: { ...slotState, fecha: "2026-11-14" } }),
    ).toMatchObject({ kind: "slots", nextFrom: "2026-11-28" });
    expect(
      bookingStep({ ...base, state: { ...slotState, fecha: "2026-11-15" } }),
    ).toMatchObject({ kind: "slots", nextFrom: null });
  });

  it("shows the chosen slot when its start is still ahead", () => {
    const step = bookingStep({
      ...base,
      state: { ...slotState, inicio: "2026-10-02T07:00:00.000Z" },
    });
    expect(step).toMatchObject({
      kind: "chosen",
      startsAt: "2026-10-02T07:00:00.000Z",
    });
  });

  it("goes back to the slots when the chosen start has already passed, so nobody confirms a time in the past", () => {
    const step = bookingStep({
      ...base,
      state: { ...slotState, inicio: "2026-09-28T07:00:00.000Z" },
    });
    expect(step.kind).toBe("slots");
  });

  describe("with a session and a chosen slot", () => {
    const chosenState = { ...slotState, inicio: "2026-10-02T07:00:00.000Z" };
    const mother: AccountPerson = {
      id: MOTHER,
      first_name: "Marta",
      last_name: "Ruiz",
      birth_date: "1985-02-10",
      is_minor: false,
      is_patient: false,
      relation: "self",
    };
    const child: AccountPerson = {
      id: CHILD,
      first_name: "Leo",
      last_name: "Ruiz",
      birth_date: "2019-06-10",
      is_minor: true,
      is_patient: true,
      relation: "ward",
    };

    const companion: AccountPerson = {
      id: UNKNOWN.replace("9", "7"),
      first_name: "Rosa",
      last_name: "Ruiz",
      birth_date: null,
      is_minor: false,
      is_patient: false,
      relation: "self",
    };
    const session = { ...base, privacyAccepted: true };

    it("asks for whom the appointment is, offering every person of the account, the mother too although she is not a patient yet", () => {
      const step = bookingStep({
        ...session,
        state: chosenState,
        people: [mother, child],
      });
      expect(step).toMatchObject({ kind: "who", people: [mother, child] });
    });

    it("offers a companion the clinic saved without birth date, so the account does not create her again as someone new", () => {
      const step = bookingStep({
        ...session,
        state: chosenState,
        people: [mother, companion],
      });
      expect(step).toMatchObject({ kind: "who", people: [mother, companion] });
    });

    it("asks only for the birth date of a chosen companion who has none, because a patient cannot be booked without it", () => {
      const step = bookingStep({
        ...session,
        state: { ...chosenState, persona: companion.id },
        people: [mother, companion],
      });
      expect(step).toMatchObject({ kind: "birthDate", person: companion });
    });

    it("continues to the summary once the companion has a birth date", () => {
      const completed = { ...companion, birth_date: "1960-03-01" };
      const step = bookingStep({
        ...session,
        state: { ...chosenState, persona: companion.id },
        people: [mother, completed],
      });
      expect(step).toMatchObject({ kind: "summary", person: completed });
    });

    it("goes straight to the person's details the first time, because there is nobody to choose and privacy must be accepted", () => {
      const step = bookingStep({
        ...base,
        privacyAccepted: false,
        state: chosenState,
        people: [],
      });
      expect(step).toMatchObject({
        kind: "details",
        firstTime: true,
        needsPrivacy: true,
        guardians: [],
      });
    });

    it("asks for privacy when adding another person to an account the clinic created, because its owner never accepted it on the web", () => {
      const step = bookingStep({
        ...base,
        privacyAccepted: false,
        state: { ...chosenState, persona: "nueva" },
        people: [mother, child],
      });
      expect(step).toMatchObject({
        kind: "details",
        firstTime: false,
        needsPrivacy: true,
      });
    });

    it("opens the details for another person offering the adults of the account as guardians, without asking privacy again", () => {
      const step = bookingStep({
        ...session,
        state: { ...chosenState, persona: "nueva" },
        people: [mother, child],
      });
      expect(step).toMatchObject({
        kind: "details",
        firstTime: false,
        needsPrivacy: false,
        guardians: [mother],
      });
    });

    it("explains on the new-person form why it came back after the adult was saved but the minor was refused", () => {
      const step = bookingStep({
        ...session,
        state: {
          ...chosenState,
          persona: "nueva",
          aviso: "guardian_not_adult",
        },
        people: [mother],
      });
      expect(step).toMatchObject({
        kind: "details",
        warning: "La persona responsable tiene que ser mayor de edad.",
      });
    });

    it("shows no warning on the new-person form when nothing was refused", () => {
      const step = bookingStep({
        ...session,
        state: { ...chosenState, persona: "nueva" },
        people: [mother],
      });
      expect(step).toMatchObject({ kind: "details", warning: null });
    });

    it("does not offer a companion without birth date as guardian, because nobody knows she is an adult", () => {
      const step = bookingStep({
        ...session,
        state: { ...chosenState, persona: "nueva" },
        people: [mother, companion],
      });
      expect(step).toMatchObject({ kind: "details", guardians: [mother] });
    });

    it("shows the summary for a person of the account, also for an adult who is not a patient yet", () => {
      expect(
        bookingStep({
          ...session,
          state: { ...chosenState, persona: CHILD },
          people: [mother, child],
        }),
      ).toMatchObject({ kind: "summary", person: child });
      expect(
        bookingStep({
          ...session,
          state: { ...chosenState, persona: MOTHER },
          people: [mother, child],
        }),
      ).toMatchObject({ kind: "summary", person: mother });
    });

    it("asks again for whom when the person in the URL is not bookable from this account", () => {
      expect(
        bookingStep({
          ...session,
          state: { ...chosenState, persona: UNKNOWN },
          people: [mother, child],
        }).kind,
      ).toBe("who");
    });
  });
});

describe("slotWindow", () => {
  it("keeps a requested date inside the horizon and offers the next days while they start within it", () => {
    expect(slotWindow({ fecha: "2026-11-14", today, horizonDays: 60 })).toEqual(
      { from: "2026-11-14", nextFrom: "2026-11-28" },
    );
  });

  it("starts today for a missing, past or too far date, so a crafted URL never breaks the page", () => {
    for (const fecha of [undefined, "2026-09-01", "9999-12-25"]) {
      expect(slotWindow({ fecha, today, horizonDays: 60 })).toEqual({
        from: today,
        nextFrom: "2026-10-13",
      });
    }
  });
});

describe("pickerDays", () => {
  it("groups the slots by Madrid day with each link built by the caller, so the booking and the change of time share one picker", () => {
    const slots = [
      { starts_at: "2026-09-30T07:00:00+00:00", professional_id: PROFESSIONAL },
      { starts_at: "2026-09-30T13:00:00+00:00", professional_id: PROFESSIONAL },
    ];
    expect(
      pickerDays(slots, today, (slot) => `/x?inicio=${slot.starts_at}`),
    ).toEqual([
      {
        date: "2026-09-30",
        label: "Mañana",
        morning: [
          {
            startsAt: "2026-09-30T07:00:00+00:00",
            time: "09:00",
            href: "/x?inicio=2026-09-30T07:00:00+00:00",
          },
        ],
        afternoon: [
          {
            startsAt: "2026-09-30T13:00:00+00:00",
            time: "15:00",
            href: "/x?inicio=2026-09-30T13:00:00+00:00",
          },
        ],
      },
    ]);
  });
});

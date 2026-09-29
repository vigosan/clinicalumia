import { madridInstant } from "@clinicalumia/api/madrid-time";
import { describe, expect, it } from "vitest";
import {
  bookingConfirmationEmail,
  bookingError,
  bookingState,
  firstFreeSlots,
  groupSlotsByDay,
  parseEmail,
  parseNewPersonForm,
  personError,
} from "./booking";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

describe("groupSlotsByDay", () => {
  const today = "2026-10-25";

  it("labels today's group as Hoy", () => {
    const groups = groupSlotsByDay(
      [
        {
          starts_at: madridInstant("2026-10-25", "09:00"),
          professional_id: "p1",
        },
      ],
      today,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe("Hoy");
  });

  it("labels tomorrow's group as Mañana", () => {
    const groups = groupSlotsByDay(
      [
        {
          starts_at: madridInstant("2026-10-26", "09:00"),
          professional_id: "p1",
        },
      ],
      today,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe("Mañana");
  });

  it("labels a later day with the capitalised weekday and lowercase month", () => {
    const groups = groupSlotsByDay(
      [
        {
          starts_at: madridInstant("2026-10-02", "09:00"),
          professional_id: "p1",
        },
      ],
      "2026-09-29",
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.date).toBe("2026-10-02");
    expect(groups[0]?.label).toBe("Viernes 2 de octubre");
  });

  it("puts a slot before 14:00 Madrid time in the morning bucket", () => {
    const groups = groupSlotsByDay(
      [
        {
          starts_at: madridInstant("2026-10-25", "13:59"),
          professional_id: "p1",
        },
      ],
      today,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.morning).toHaveLength(1);
    expect(groups[0]?.afternoon).toHaveLength(0);
  });

  it("puts a slot at exactly 14:00 Madrid time in the afternoon bucket", () => {
    const groups = groupSlotsByDay(
      [
        {
          starts_at: madridInstant("2026-10-25", "14:00"),
          professional_id: "p1",
        },
      ],
      today,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.morning).toHaveLength(0);
    expect(groups[0]?.afternoon).toHaveLength(1);
  });

  it("groups a slot the evening before the DST change into the next Madrid day, not the UTC day", () => {
    const groups = groupSlotsByDay(
      [{ starts_at: "2026-10-24T23:30:00Z", professional_id: "p1" }],
      "2026-10-24",
    );
    const group = groups.find((g) => g.date === "2026-10-25");
    expect(group).toBeDefined();
    expect(group?.morning).toHaveLength(1);
  });

  it("groups a slot right after the DST change (clocks back) into the Madrid day it actually falls on", () => {
    const groups = groupSlotsByDay(
      [{ starts_at: "2026-10-25T23:30:00Z", professional_id: "p1" }],
      "2026-10-24",
    );
    const group = groups.find((g) => g.date === "2026-10-26");
    expect(group).toBeDefined();
    expect(group?.morning).toHaveLength(1);
  });

  it("keeps slots grouped by day in chronological order", () => {
    const groups = groupSlotsByDay(
      [
        {
          starts_at: madridInstant("2026-10-26", "09:00"),
          professional_id: "p1",
        },
        {
          starts_at: madridInstant("2026-10-25", "09:00"),
          professional_id: "p1",
        },
      ],
      today,
    );
    expect(groups.map((g) => g.date)).toEqual(["2026-10-25", "2026-10-26"]);
  });
});

describe("parseEmail", () => {
  it("trims and lowercases a valid email", () => {
    expect(parseEmail("  Ana@Example.com ")).toEqual({
      email: "ana@example.com",
    });
  });

  it("rejects an email without an at sign", () => {
    expect(parseEmail("ana-arroba-nada.com")).toEqual({
      error: "Escribe un email válido.",
    });
  });
});

describe("parseNewPersonForm", () => {
  const today = "2026-09-29";

  function personForm(values: Record<string, string> = {}) {
    return form({
      first_name: "Ana",
      last_name: "García",
      birth_date: "2000-01-01",
      phone: "",
      ...values,
    });
  }

  it("requires a first name", () => {
    expect(parseNewPersonForm(personForm({ first_name: "" }), today)).toEqual({
      error: "El nombre es obligatorio.",
    });
  });

  it("requires a last name", () => {
    expect(parseNewPersonForm(personForm({ last_name: "" }), today)).toEqual({
      error: "Los apellidos son obligatorios.",
    });
  });

  it("requires a birth date, since it decides whether the person needs a guardian", () => {
    expect(parseNewPersonForm(personForm({ birth_date: "" }), today)).toEqual({
      error: "La fecha de nacimiento es obligatoria.",
    });
  });

  it("rejects a birth date in the future", () => {
    expect(
      parseNewPersonForm(personForm({ birth_date: "2026-09-30" }), today),
    ).toEqual({ error: "La fecha de nacimiento no puede ser futura." });
  });

  it("rejects a phone with fewer than 9 digits, reusing the piece-2 rule", () => {
    expect(parseNewPersonForm(personForm({ phone: "123456" }), today)).toEqual({
      error: "El teléfono no es válido.",
    });
  });

  it("normalizes the phone in the parsed output", () => {
    expect(
      parseNewPersonForm(personForm({ phone: "614 55 28 08" }), today),
    ).toEqual({
      ok: true,
      person: {
        first_name: "Ana",
        last_name: "García",
        birth_date: "2000-01-01",
        phone: "614552808",
      },
    });
  });

  it("accepts a person without a phone", () => {
    expect(parseNewPersonForm(personForm(), today)).toEqual({
      ok: true,
      person: {
        first_name: "Ana",
        last_name: "García",
        birth_date: "2000-01-01",
        phone: null,
      },
    });
  });
});

describe("bookingError", () => {
  it("maps a person outside the account", () => {
    expect(bookingError({ message: "person_not_in_account" })).toBe(
      "Esa persona no está en tu cuenta.",
    );
  });

  it("maps a slot that just got taken", () => {
    expect(bookingError({ message: "slot_not_available" })).toBe(
      "Ese hueco ya no está libre. Elige otro.",
    );
  });

  it("maps a phone-only service", () => {
    expect(bookingError({ message: "service_not_bookable" })).toBe(
      "Este servicio se reserva por teléfono.",
    );
  });

  it("falls back to a generic message for anything else", () => {
    expect(bookingError({ message: "something_else" })).toBe(
      "No se ha podido reservar. Inténtalo de nuevo.",
    );
  });
});

describe("personError", () => {
  it("maps every add_my_person error code from the brief", () => {
    expect(personError({ message: "privacy_required" })).toBe(
      "Tienes que aceptar la política de privacidad.",
    );
    expect(personError({ message: "relationship_required" })).toBe(
      "Indica la relación con el menor.",
    );
    expect(personError({ message: "guardian_not_in_account" })).toBe(
      "Esa persona no está en tu cuenta.",
    );
    expect(personError({ message: "guardian_not_adult" })).toBe(
      "La persona responsable tiene que ser mayor de edad.",
    );
    expect(personError({ message: "person_not_minor" })).toBe(
      "Solo puedes añadir a un menor a tu cargo.",
    );
    expect(personError({ message: "person_not_adult" })).toBe(
      "Para pedir cita para ti tienes que ser mayor de edad.",
    );
  });

  it("falls back to a generic message for anything else", () => {
    expect(personError({ message: "unexpected" })).toBe(
      "No se han podido guardar los datos. Inténtalo de nuevo.",
    );
  });
});

describe("bookingState", () => {
  const servicio = "11111111-1111-1111-1111-111111111111";
  const profesional = "22222222-2222-2222-2222-222222222222";
  const persona = "33333333-3333-3333-3333-333333333333";
  const inicio = "2026-10-02T09:00:00.000Z";

  it("round-trips valid values through encode and decode", () => {
    const encoded = bookingState.encode({
      servicio,
      profesional,
      inicio,
      persona,
    });
    const params = new URLSearchParams(encoded);
    expect(
      bookingState.decode({
        servicio: params.get("servicio") ?? undefined,
        profesional: params.get("profesional") ?? undefined,
        inicio: params.get("inicio") ?? undefined,
        persona: params.get("persona") ?? undefined,
      }),
    ).toEqual({ servicio, profesional, inicio, persona });
  });

  it("decodes an invalid uuid to undefined instead of throwing", () => {
    expect(bookingState.decode({ servicio: "not-a-uuid" })).toEqual({
      servicio: undefined,
      profesional: undefined,
      inicio: undefined,
      persona: undefined,
    });
  });

  it("decodes an invalid instant to undefined instead of throwing", () => {
    expect(bookingState.decode({ inicio: "not-a-date" })).toEqual({
      servicio: undefined,
      profesional: undefined,
      inicio: undefined,
      persona: undefined,
    });
  });

  it("decodes a value given as an array to undefined", () => {
    expect(bookingState.decode({ servicio: [servicio] })).toEqual({
      servicio: undefined,
      profesional: undefined,
      inicio: undefined,
      persona: undefined,
    });
  });

  it("decodes missing values to undefined", () => {
    expect(bookingState.decode({})).toEqual({
      servicio: undefined,
      profesional: undefined,
      inicio: undefined,
      persona: undefined,
    });
  });

  it("keeps the specialty and the 14-day window start so each step can be reloaded from its URL", () => {
    const especialidad = "44444444-4444-4444-4444-444444444444";
    const params = new URLSearchParams(
      bookingState.encode({ especialidad, servicio, fecha: "2026-10-05" }),
    );
    expect(
      bookingState.decode({
        especialidad: params.get("especialidad") ?? undefined,
        servicio: params.get("servicio") ?? undefined,
        fecha: params.get("fecha") ?? undefined,
      }),
    ).toMatchObject({ especialidad, servicio, fecha: "2026-10-05" });
  });

  it("keeps 'cualquiera' as professional because it means the first free slot", () => {
    expect(bookingState.decode({ profesional: "cualquiera" }).profesional).toBe(
      "cualquiera",
    );
  });

  it("keeps 'nueva' as persona because it opens the form for another person", () => {
    expect(bookingState.decode({ persona: "nueva" }).persona).toBe("nueva");
  });

  it("round-trips the taken-slot warning so the slot step can explain why the patient is back", () => {
    const params = new URLSearchParams(
      bookingState.encode({ servicio, aviso: "ocupado" }),
    );
    expect(
      bookingState.decode({ aviso: params.get("aviso") ?? undefined }).aviso,
    ).toBe("ocupado");
    expect(bookingState.decode({ aviso: "otro" }).aviso).toBeUndefined();
  });

  it("drops a window start that is not a real calendar date", () => {
    expect(bookingState.decode({ fecha: "2026-02-30" }).fecha).toBeUndefined();
    expect(bookingState.decode({ fecha: "mañana" }).fecha).toBeUndefined();
  });
});

describe("firstFreeSlots", () => {
  it("offers each start time once when several professionals are free, so 'El primer hueco libre' does not repeat hours", () => {
    const nine = madridInstant("2026-10-02", "09:00");
    const quarter = madridInstant("2026-10-02", "09:15");
    expect(
      firstFreeSlots([
        { starts_at: nine, professional_id: "p1" },
        { starts_at: nine, professional_id: "p2" },
        { starts_at: quarter, professional_id: "p2" },
      ]),
    ).toEqual([
      { starts_at: nine, professional_id: "p1" },
      { starts_at: quarter, professional_id: "p2" },
    ]);
  });
});

describe("bookingConfirmationEmail", () => {
  const appointment = {
    startsAt: madridInstant("2026-10-02", "09:30"),
    serviceName: "Sesión de logopedia",
    professionalName: "Ana García",
    personName: "Lucía Pérez",
  };

  it("tells the date and time in Madrid, what, with whom and for whom, so the patient can check it without opening the web", () => {
    const email = bookingConfirmationEmail(appointment);
    expect(email.subject).toBe("Cita confirmada");
    expect(email.html).toContain("Viernes, 2 de octubre a las 09:30");
    expect(email.html).toContain("Sesión de logopedia");
    expect(email.html).toContain("Ana García");
    expect(email.html).toContain("Lucía Pérez");
    expect(email.html).toContain("Puedes verla o cambiarla en Mi cuenta");
  });

  it("escapes names typed by patients so they cannot inject markup into the email", () => {
    const email = bookingConfirmationEmail({
      ...appointment,
      personName: "<b>Lucía</b>",
    });
    expect(email.html).toContain("&lt;b&gt;Lucía&lt;/b&gt;");
    expect(email.html).not.toContain("<b>Lucía</b>");
  });
});

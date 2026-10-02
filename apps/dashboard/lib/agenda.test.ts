import { describe, expect, it } from "vitest";
import {
  adjacentAppointments,
  appointmentError,
  type Block,
  canMarkNoShow,
  canMove,
  isUuid,
  layoutDay,
  parseAppointmentForm,
  pastTimeWarnings,
  professionalOptions,
  scheduleWarnings,
  specialtyTone,
  visibleHours,
  visibleWeekHours,
  weekTitle,
} from "./agenda";

function form(values: Record<string, string>) {
  const data = new FormData();
  const defaults: Record<string, string> = {
    patient_id: "patient-1",
    service_id: "service-1",
    professional_id: "pro-1",
    date: "2026-07-15",
    time: "10:00",
    duration_minutes: "30",
    notes: "",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...values })) {
    data.set(key, value);
  }
  return data;
}

describe("layoutDay", () => {
  it("places a block in minutes from firstHour", () => {
    const blocks: Block[] = [
      {
        id: "a",
        kind: "own",
        professionalId: "pro-1",
        start: "2026-07-15T16:10:00+02:00",
        end: "2026-07-15T16:55:00+02:00",
      },
    ];
    expect(layoutDay(blocks, "2026-07-15", 15, 20)).toEqual([
      { id: "a", kind: "own", top: 70, height: 45, lane: 0, lanes: 1 },
    ]);
  });

  it("clips a block that starts before the visible window to top 0", () => {
    const blocks: Block[] = [
      {
        id: "a",
        kind: "busy",
        professionalId: "pro-1",
        start: "2026-07-15T13:30:00+02:00",
        end: "2026-07-15T15:30:00+02:00",
      },
    ];
    expect(layoutDay(blocks, "2026-07-15", 15, 20)).toEqual([
      { id: "a", kind: "busy", top: 0, height: 30, lane: 0, lanes: 1 },
    ]);
  });

  it("clips a block that ends after the visible window to lastHour", () => {
    const blocks: Block[] = [
      {
        id: "a",
        kind: "time_off",
        professionalId: "pro-1",
        start: "2026-07-15T19:00:00+02:00",
        end: "2026-07-15T21:00:00+02:00",
      },
    ];
    expect(layoutDay(blocks, "2026-07-15", 15, 20)).toEqual([
      { id: "a", kind: "time_off", top: 240, height: 60, lane: 0, lanes: 1 },
    ]);
  });

  it("drops a block that falls entirely outside the visible window", () => {
    const blocks: Block[] = [
      {
        id: "a",
        kind: "own",
        professionalId: "pro-1",
        start: "2026-07-15T07:00:00+02:00",
        end: "2026-07-15T08:00:00+02:00",
      },
    ];
    expect(layoutDay(blocks, "2026-07-15", 15, 20)).toEqual([]);
  });

  it("puts a no-show and the appointment that took its slot side by side, so neither hides the other", () => {
    const blocks: Block[] = [
      {
        id: "no-show",
        kind: "own",
        professionalId: "pro-1",
        start: "2026-07-15T16:00:00+02:00",
        end: "2026-07-15T16:30:00+02:00",
      },
      {
        id: "taken",
        kind: "own",
        professionalId: "pro-1",
        start: "2026-07-15T16:15:00+02:00",
        end: "2026-07-15T16:45:00+02:00",
      },
      {
        id: "later",
        kind: "own",
        professionalId: "pro-1",
        start: "2026-07-15T17:00:00+02:00",
        end: "2026-07-15T17:30:00+02:00",
      },
      {
        id: "colleague",
        kind: "own",
        professionalId: "pro-2",
        start: "2026-07-15T16:00:00+02:00",
        end: "2026-07-15T16:30:00+02:00",
      },
    ];
    expect(layoutDay(blocks, "2026-07-15", 15, 20)).toEqual([
      { id: "no-show", kind: "own", top: 60, height: 30, lane: 0, lanes: 2 },
      { id: "taken", kind: "own", top: 75, height: 30, lane: 1, lanes: 2 },
      { id: "later", kind: "own", top: 120, height: 30, lane: 0, lanes: 1 },
      { id: "colleague", kind: "own", top: 60, height: 30, lane: 0, lanes: 1 },
    ]);
  });
});

describe("visibleHours", () => {
  it("rounds a mid-hour schedule out to the full hours it touches", () => {
    const schedules = [
      { weekday: 1, starts_at: "09:30:00", ends_at: "13:45:00" },
      { weekday: 1, starts_at: "15:15:00", ends_at: "20:00:00" },
    ];
    expect(visibleHours(schedules, 1)).toEqual({ firstHour: 9, lastHour: 20 });
  });

  it("falls back to 8-20 when nobody visible works that weekday", () => {
    const schedules = [
      { weekday: 1, starts_at: "09:00:00", ends_at: "13:00:00" },
    ];
    expect(visibleHours(schedules, 6)).toEqual({ firstHour: 8, lastHour: 20 });
  });

  it("widens the window to cover an appointment booked outside the schedule, rounded outward", () => {
    const schedules = [
      { weekday: 1, starts_at: "09:00:00", ends_at: "13:00:00" },
    ];
    const blocks = [
      {
        startsAt: "2026-07-13T07:00:00+02:00",
        endsAt: "2026-07-13T07:30:00+02:00",
      },
      {
        startsAt: "2026-07-13T21:00:00+02:00",
        endsAt: "2026-07-13T21:30:00+02:00",
      },
    ];
    expect(visibleHours(schedules, 1, blocks, "2026-07-13")).toEqual({
      firstHour: 7,
      lastHour: 22,
    });
  });

  it("still falls back to 8-20 when neither the schedule nor any block is shown", () => {
    expect(visibleHours([], 1, [], "2026-07-13")).toEqual({
      firstHour: 8,
      lastHour: 20,
    });
  });

  it("widens the window up to midnight for an appointment that crosses into the next day", () => {
    const blocks = [
      {
        startsAt: "2026-07-13T22:30:00+02:00",
        endsAt: "2026-07-14T00:30:00+02:00",
      },
    ];
    expect(visibleHours([], 1, blocks, "2026-07-13")).toEqual({
      firstHour: 22,
      lastHour: 24,
    });
  });

  it("clips a block that starts the day before to midnight, rather than pulling firstHour past midnight", () => {
    const blocks = [
      {
        startsAt: "2026-07-12T22:30:00+02:00",
        endsAt: "2026-07-13T00:30:00+02:00",
      },
    ];
    expect(visibleHours([], 1, blocks, "2026-07-13")).toEqual({
      firstHour: 0,
      lastHour: 1,
    });
  });

  it("ignores a block that doesn't intersect the rendered day at all", () => {
    const blocks = [
      {
        startsAt: "2026-07-10T09:00:00+02:00",
        endsAt: "2026-07-10T10:00:00+02:00",
      },
    ];
    expect(visibleHours([], 1, blocks, "2026-07-13")).toEqual({
      firstHour: 8,
      lastHour: 20,
    });
  });

  it("clips a multi-day span to the rendered day instead of inverting the window (the reported bug: Fri 18:00 -> Mon 09:00)", () => {
    const schedules = [
      { weekday: 5, starts_at: "09:00:00", ends_at: "13:00:00" },
    ];
    const blocks = [
      {
        startsAt: "2026-07-10T18:00:00+02:00",
        endsAt: "2026-07-13T09:00:00+02:00",
      },
    ];
    const result = visibleHours(schedules, 5, blocks, "2026-07-10");
    expect(result.firstHour).toBeLessThanOrEqual(result.lastHour);
    expect(result).toEqual({ firstHour: 9, lastHour: 24 });
  });

  it("clips a whole-day span to exactly 0-24, not beyond", () => {
    const blocks = [
      {
        startsAt: "2026-07-13T00:00:00+02:00",
        endsAt: "2026-07-13T23:59:59+02:00",
      },
    ];
    expect(visibleHours([], 1, blocks, "2026-07-13")).toEqual({
      firstHour: 0,
      lastHour: 24,
    });
  });

  it.each([
    [
      "a normal daytime block",
      "2026-07-13T09:00:00+02:00",
      "2026-07-13T10:00:00+02:00",
    ],
    [
      "a whole-day block",
      "2026-07-13T00:00:00+02:00",
      "2026-07-13T23:59:59+02:00",
    ],
    [
      "a block crossing into the next day",
      "2026-07-13T23:30:00+02:00",
      "2026-07-14T01:00:00+02:00",
    ],
    [
      "a block starting the day before",
      "2026-07-12T20:00:00+02:00",
      "2026-07-13T02:00:00+02:00",
    ],
    [
      "a multi-day block",
      "2026-07-10T18:00:00+02:00",
      "2026-07-16T09:00:00+02:00",
    ],
  ])("never inverts firstHour past lastHour for %s", (_label, startsAt, endsAt) => {
    const result = visibleHours([], 1, [{ startsAt, endsAt }], "2026-07-13");
    expect(result.firstHour).toBeLessThanOrEqual(result.lastHour);
  });
});

describe("visibleWeekHours", () => {
  it("spans the earliest start and latest end across every weekday, not just one", () => {
    const schedules = [
      { weekday: 1, starts_at: "09:00:00", ends_at: "13:00:00" },
      { weekday: 6, starts_at: "10:00:00", ends_at: "14:30:00" },
    ];
    expect(visibleWeekHours(schedules)).toEqual({ firstHour: 9, lastHour: 15 });
  });

  it("falls back to 8-20 when the person has no schedule at all that week", () => {
    expect(visibleWeekHours([])).toEqual({ firstHour: 8, lastHour: 20 });
  });

  it("widens the window to cover an appointment booked outside the week's schedules", () => {
    const schedules = [
      { weekday: 1, starts_at: "09:00:00", ends_at: "13:00:00" },
    ];
    const blocks = [
      {
        startsAt: "2026-07-13T07:00:00+02:00",
        endsAt: "2026-07-13T07:30:00+02:00",
      },
      {
        startsAt: "2026-07-17T21:00:00+02:00",
        endsAt: "2026-07-17T21:30:00+02:00",
      },
    ];
    expect(visibleWeekHours(schedules, blocks)).toEqual({
      firstHour: 7,
      lastHour: 22,
    });
  });

  it("widens a day's window up to midnight for an appointment on that day that crosses into the next", () => {
    const blocks = [
      {
        startsAt: "2026-07-13T22:30:00+02:00",
        endsAt: "2026-07-14T00:30:00+02:00",
      },
    ];
    expect(visibleWeekHours([], blocks)).toEqual({
      firstHour: 22,
      lastHour: 24,
    });
  });

  it("never inverts the window for a multi-day span (clipped to the day it starts on)", () => {
    const blocks = [
      {
        startsAt: "2026-07-10T18:00:00+02:00",
        endsAt: "2026-07-16T09:00:00+02:00",
      },
    ];
    const result = visibleWeekHours([], blocks);
    expect(result.firstHour).toBeLessThanOrEqual(result.lastHour);
    expect(result).toEqual({ firstHour: 18, lastHour: 24 });
  });
});

describe("weekTitle", () => {
  it("uses one month name when the week crosses months, per the brief's exact example", () => {
    expect(weekTitle("2026-09-28", "2026-10-04")).toBe(
      "Semana del 28 de septiembre al 4 de octubre",
    );
  });

  it("does not repeat the month name when the week stays inside one month", () => {
    expect(weekTitle("2026-09-21", "2026-09-27")).toBe(
      "Semana del 21 al 27 de septiembre",
    );
  });

  it("includes both years when the week crosses a year boundary", () => {
    expect(weekTitle("2026-12-28", "2027-01-03")).toBe(
      "Semana del 28 de diciembre de 2026 al 3 de enero de 2027",
    );
  });
});

describe("scheduleWarnings", () => {
  const schedules = [
    { weekday: 3, starts_at: "09:00:00", ends_at: "13:00:00" },
  ];

  it("has no warnings when the appointment fits entirely inside a schedule block", () => {
    expect(
      scheduleWarnings({
        professionalName: "Laura",
        start: "2026-07-15T10:00:00+02:00",
        end: "2026-07-15T10:30:00+02:00",
        schedules,
        timeOff: [],
      }),
    ).toEqual([]);
  });

  it("warns when the appointment crosses the end of the schedule block", () => {
    expect(
      scheduleWarnings({
        professionalName: "Laura",
        start: "2026-07-15T12:30:00+02:00",
        end: "2026-07-15T13:15:00+02:00",
        schedules,
        timeOff: [],
      }),
    ).toEqual(["Queda fuera del horario de Laura."]);
  });

  it("warns on a Saturday with no schedule blocks at all", () => {
    expect(
      scheduleWarnings({
        professionalName: "Laura",
        start: "2026-07-18T10:00:00+02:00",
        end: "2026-07-18T10:30:00+02:00",
        schedules,
        timeOff: [],
      }),
    ).toEqual(["Queda fuera del horario de Laura."]);
  });

  it("warns with the reason when the appointment overlaps a time off", () => {
    expect(
      scheduleWarnings({
        professionalName: "Laura",
        start: "2026-07-15T10:00:00+02:00",
        end: "2026-07-15T10:30:00+02:00",
        schedules,
        timeOff: [
          {
            starts_at: "2026-07-15T09:00:00+02:00",
            ends_at: "2026-07-15T11:00:00+02:00",
            reason: "Formación",
          },
        ],
      }),
    ).toEqual(["Laura tiene una ausencia ese día (Formación)."]);
  });

  it("has no warning on the spring-forward day when the appointment fits Madrid wall time, not a naive UTC offset", () => {
    expect(
      scheduleWarnings({
        professionalName: "Laura",
        start: "2026-03-29T10:00:00+02:00",
        end: "2026-03-29T10:30:00+02:00",
        schedules: [{ weekday: 7, starts_at: "09:30:00", ends_at: "13:30:00" }],
        timeOff: [],
      }),
    ).toEqual([]);
  });
});

describe("parseAppointmentForm", () => {
  it("requires a patient", () => {
    expect(parseAppointmentForm(form({ patient_id: "" }))).toEqual({
      error: "Elige un paciente.",
    });
  });

  it("requires a service", () => {
    expect(parseAppointmentForm(form({ service_id: "" }))).toEqual({
      error: "Elige un servicio.",
    });
  });

  it("requires a professional", () => {
    expect(parseAppointmentForm(form({ professional_id: "" }))).toEqual({
      error: "Elige un profesional.",
    });
  });

  it("requires a date and a time", () => {
    expect(parseAppointmentForm(form({ date: "" }))).toEqual({
      error: "Indica fecha y hora.",
    });
    expect(parseAppointmentForm(form({ time: "" }))).toEqual({
      error: "Indica fecha y hora.",
    });
  });

  it("rejects an invalid time instead of throwing, delegating the rule to isValidTime", () => {
    expect(parseAppointmentForm(form({ time: "25:00" }))).toEqual({
      error: "Indica fecha y hora.",
    });
  });

  it("rejects a date that does not exist on the calendar, delegating the rule to isValidDate", () => {
    expect(parseAppointmentForm(form({ date: "2026-02-30" }))).toEqual({
      error: "Indica fecha y hora.",
    });
  });

  it("rejects a time with seconds, since it would silently drop when ends_at is normalized back to HH:MM", () => {
    expect(parseAppointmentForm(form({ time: "10:00:30" }))).toEqual({
      error: "Indica fecha y hora.",
    });
  });

  it("accepts a valid leap day", () => {
    const result = parseAppointmentForm(
      form({ date: "2028-02-29", time: "09:00", duration_minutes: "30" }),
    );
    expect(result).toHaveProperty(
      "appointment.starts_at",
      "2028-02-29T09:00:00+01:00",
    );
  });

  it("rejects a duration under 5 minutes", () => {
    expect(parseAppointmentForm(form({ duration_minutes: "0" }))).toEqual({
      error: "La duración debe estar entre 5 y 480 minutos, en pasos de 5.",
    });
  });

  it("rejects a duration over 480 minutes", () => {
    expect(parseAppointmentForm(form({ duration_minutes: "485" }))).toEqual({
      error: "La duración debe estar entre 5 y 480 minutos, en pasos de 5.",
    });
  });

  it("rejects a duration that is not a multiple of 5", () => {
    expect(parseAppointmentForm(form({ duration_minutes: "32" }))).toEqual({
      error: "La duración debe estar entre 5 y 480 minutos, en pasos de 5.",
    });
  });

  it("rejects notes longer than 2000 characters, matching the database check constraint", () => {
    expect(parseAppointmentForm(form({ notes: "a".repeat(2001) }))).toEqual({
      error: "Las notas no pueden superar los 2000 caracteres.",
    });
  });

  it("computes starts_at with the summer offset", () => {
    const result = parseAppointmentForm(
      form({ date: "2026-07-15", time: "10:00", duration_minutes: "30" }),
    );
    expect(result).toHaveProperty(
      "appointment.starts_at",
      "2026-07-15T10:00:00+02:00",
    );
  });

  it("computes starts_at with the winter offset", () => {
    const result = parseAppointmentForm(
      form({ date: "2026-01-15", time: "10:00", duration_minutes: "30" }),
    );
    expect(result).toHaveProperty(
      "appointment.starts_at",
      "2026-01-15T10:00:00+01:00",
    );
  });

  it("computes ends_at as starts_at plus the duration in real elapsed minutes", () => {
    const result = parseAppointmentForm(
      form({ date: "2026-07-15", time: "10:00", duration_minutes: "45" }),
    );
    expect(result).toHaveProperty("ok", true);
    if ("appointment" in result) {
      const starts = new Date(result.appointment.starts_at).getTime();
      const ends = new Date(result.appointment.ends_at).getTime();
      expect(ends - starts).toBe(45 * 60_000);
    }
  });

  it("emits ends_at in the same Madrid-offset form as starts_at", () => {
    const result = parseAppointmentForm(
      form({ date: "2026-07-15", time: "10:00", duration_minutes: "45" }),
    );
    expect(result).toHaveProperty(
      "appointment.ends_at",
      "2026-07-15T10:45:00+02:00",
    );
  });

  it("keeps ends_at exactly duration_minutes after starts_at, for any valid duration, so the database never sees a fractional-minute gap", () => {
    for (const duration of [5, 30, 45, 300, 475, 480]) {
      const result = parseAppointmentForm(
        form({
          date: "2026-07-15",
          time: "10:00",
          duration_minutes: String(duration),
        }),
      );
      expect(result).toHaveProperty("ok", true);
      if ("appointment" in result) {
        const starts = new Date(result.appointment.starts_at).getTime();
        const ends = new Date(result.appointment.ends_at).getTime();
        expect(ends - starts).toBe(duration * 60_000);
      }
    }
  });

  it("keeps ends_at exactly duration_minutes after starts_at across the autumn clock change, when the Madrid-offset round trip could otherwise drift by an hour", () => {
    const result = parseAppointmentForm(
      form({
        date: "2026-10-25",
        time: "01:00",
        duration_minutes: "180",
      }),
    );
    expect(result).toHaveProperty("ok", true);
    if ("appointment" in result) {
      const starts = new Date(result.appointment.starts_at).getTime();
      const ends = new Date(result.appointment.ends_at).getTime();
      expect(ends - starts).toBe(180 * 60_000);
    }
  });

  it("returns the rest of the appointment fields", () => {
    const result = parseAppointmentForm(
      form({
        patient_id: "patient-9",
        service_id: "service-9",
        professional_id: "pro-9",
        notes: "Primera visita",
      }),
    );
    expect(result).toHaveProperty("appointment.patient_id", "patient-9");
    expect(result).toHaveProperty("appointment.service_id", "service-9");
    expect(result).toHaveProperty("appointment.professional_id", "pro-9");
    expect(result).toHaveProperty("appointment.notes", "Primera visita");
  });

  it("rejects a duration that would push ends_at into the next day, a clinic never books across midnight", () => {
    expect(
      parseAppointmentForm(
        form({ date: "2026-07-15", time: "23:00", duration_minutes: "90" }),
      ),
    ).toEqual({ error: "La cita tiene que empezar y terminar el mismo día." });
  });

  it("allows a duration that ends exactly at the following midnight", () => {
    const result = parseAppointmentForm(
      form({ date: "2026-07-15", time: "23:15", duration_minutes: "45" }),
    );
    expect(result).toHaveProperty("ok", true);
    expect(result).toHaveProperty(
      "appointment.ends_at",
      "2026-07-16T00:00:00+02:00",
    );
  });
});

describe("canMarkNoShow", () => {
  it("allows marking no-show once the appointment has started", () => {
    const now = new Date("2026-07-15T10:00:00Z");
    expect(
      canMarkNoShow(
        { status: "scheduled", starts_at: "2026-07-15T10:00:00Z" },
        now,
      ),
    ).toBe(true);
    expect(
      canMarkNoShow(
        { status: "scheduled", starts_at: "2026-07-15T10:00:01Z" },
        now,
      ),
    ).toBe(false);
  });

  it("never allows marking no-show on a cancelled appointment", () => {
    const now = new Date("2026-07-15T10:00:00Z");
    expect(
      canMarkNoShow(
        { status: "cancelled", starts_at: "2026-07-15T09:00:00Z" },
        now,
      ),
    ).toBe(false);
  });
});

describe("pastTimeWarnings", () => {
  const now = new Date("2026-07-15T10:00:00Z");

  it("warns when the new appointment starts at a time that has already passed, since it would show up as done and pending payment", () => {
    expect(pastTimeWarnings("2026-07-15T09:59:00Z", now)).toEqual([
      "Esa hora ya ha pasado.",
    ]);
  });

  it("warns when it starts right now, because by the time it is saved it has begun", () => {
    expect(pastTimeWarnings("2026-07-15T10:00:00Z", now)).toEqual([
      "Esa hora ya ha pasado.",
    ]);
  });

  it("says nothing for a time still to come", () => {
    expect(pastTimeWarnings("2026-07-15T10:01:00Z", now)).toEqual([]);
  });
});

describe("canMove", () => {
  it("allows moving only while the appointment is still in the future", () => {
    const now = new Date("2026-07-15T10:00:00Z");
    expect(
      canMove({ status: "scheduled", starts_at: "2026-07-15T10:00:01Z" }, now),
    ).toBe(true);
    expect(
      canMove({ status: "scheduled", starts_at: "2026-07-15T10:00:00Z" }, now),
    ).toBe(false);
  });

  it("never allows moving a cancelled appointment", () => {
    const now = new Date("2026-07-15T10:00:00Z");
    expect(
      canMove({ status: "cancelled", starts_at: "2026-07-16T09:00:00Z" }, now),
    ).toBe(false);
  });
});

describe("appointmentError", () => {
  it("maps an overlap to a base message the action enriches", () => {
    expect(appointmentError({ code: "23P01", message: "" })).toBe(
      "Ya hay una cita en esa franja.",
    );
  });

  it("tells the team the patient already has an appointment then, so undoing a no-show or moving explains itself", () => {
    expect(
      appointmentError({
        code: "23P01",
        message:
          'conflicting key value violates exclusion constraint "appointments_patient_no_overlap"',
      }),
    ).toBe("Este paciente ya tiene una cita a esa hora.");
  });

  it("maps appointment_not_started", () => {
    expect(
      appointmentError({ code: "23514", message: "appointment_not_started" }),
    ).toBe(
      "Solo se puede marcar como no presentada cuando la cita ya ha empezado.",
    );
  });

  it("tells the team to void the charge before handing a paid appointment to another professional, since its invoice and payment follow the professional", () => {
    expect(
      appointmentError({ code: "23514", message: "appointment_invoiced" }),
    ).toBe(
      "Para cambiar de profesional una cita cobrada, anula antes el cobro.",
    );
  });

  it("maps appointment_cancelled_final", () => {
    expect(
      appointmentError({
        code: "23514",
        message: "appointment_cancelled_final",
      }),
    ).toBe(
      "Una cita cancelada no se puede cambiar de fecha u hora; crea una nueva.",
    );
  });

  it("maps appointment_in_past", () => {
    expect(
      appointmentError({ code: "23514", message: "appointment_in_past" }),
    ).toBe("No se puede cambiar la fecha u hora de una cita que ya ha pasado.");
  });

  it("maps patient_not_bookable", () => {
    expect(
      appointmentError({ code: "23514", message: "patient_not_bookable" }),
    ).toBe("Esa ficha no es de paciente o está archivada.");
  });

  it("maps service_inactive", () => {
    expect(
      appointmentError({ code: "23514", message: "service_inactive" }),
    ).toBe("Ese servicio ya no está activo.");
  });

  it("maps professional_inactive", () => {
    expect(
      appointmentError({ code: "23514", message: "professional_inactive" }),
    ).toBe("Ese profesional no está activo.");
  });

  it("maps service_not_for_professional", () => {
    expect(
      appointmentError({
        code: "23514",
        message: "service_not_for_professional",
      }),
    ).toBe("Ese servicio no es de la especialidad del profesional.");
  });

  it("maps appointment_invalid_transition to the no_show-cannot-be-cancelled ruling", () => {
    expect(
      appointmentError({
        code: "23514",
        message: "appointment_invalid_transition",
      }),
    ).toBe("No se puede cancelar una cita marcada como no presentada.");
  });

  it("maps appointment_crosses_midnight to the same-day message parseAppointmentForm uses", () => {
    expect(
      appointmentError({
        code: "23514",
        message: "appointment_crosses_midnight",
      }),
    ).toBe("La cita tiene que empezar y terminar el mismo día.");
  });

  it("maps 42501 to the forbidden-professional message", () => {
    expect(
      appointmentError({ code: "42501", message: "appointment_forbidden" }),
    ).toBe("No tienes permiso para dar citas a otro profesional.");
  });

  it("falls back to a generic message for an unrecognized error", () => {
    expect(appointmentError({ code: "99999", message: "boom" })).toBe(
      "No se ha podido guardar.",
    );
  });
});

describe("specialtyTone", () => {
  it("maps logopedia to sage", () => {
    expect(specialtyTone("logopedia")).toBe("sage");
  });

  it("maps psicologia to bark", () => {
    expect(specialtyTone("psicologia")).toBe("bark");
  });

  it("maps fisioterapia to pebble", () => {
    expect(specialtyTone("fisioterapia")).toBe("pebble");
  });

  it("maps any other slug to neutral", () => {
    expect(specialtyTone("otra-especialidad")).toBe("neutral");
  });
});

describe("isUuid", () => {
  it("accepts a well-formed uuid", () => {
    expect(isUuid("a0000000-0000-0000-0000-000000000001")).toBe(true);
  });

  it("accepts uppercase hex digits", () => {
    expect(isUuid("A0000000-0000-0000-0000-000000000001")).toBe(true);
  });

  it("rejects a value that is not a uuid, so stray ?with= entries are ignored", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isUuid("")).toBe(false);
  });
});

describe("adjacentAppointments", () => {
  const appointments = [
    { id: "c", startsAt: "2026-10-05T14:00:00Z", professionalId: "laura" },
    { id: "a", startsAt: "2026-10-05T08:00:00Z", professionalId: "marc" },
    { id: "b2", startsAt: "2026-10-05T10:00:00Z", professionalId: "marc" },
    { id: "b1", startsAt: "2026-10-05T10:00:00Z", professionalId: "laura" },
  ];
  const columnOrder = ["laura", "marc"];

  it("walks the agenda in time order, so «Siguiente» opens the appointment that comes next on screen", () => {
    expect(adjacentAppointments(appointments, "a", columnOrder)).toEqual({
      previousId: null,
      nextId: "b1",
    });
    expect(adjacentAppointments(appointments, "b1", columnOrder)).toEqual({
      previousId: "a",
      nextId: "b2",
    });
    expect(adjacentAppointments(appointments, "c", columnOrder)).toEqual({
      previousId: "b2",
      nextId: null,
    });
  });

  it("orders appointments at the same time by column, left to right as the agenda shows them", () => {
    expect(adjacentAppointments(appointments, "b2", ["marc", "laura"])).toEqual(
      { previousId: "a", nextId: "b1" },
    );
  });

  it("offers no neighbours for an appointment that is not on the agenda, such as a cancelled one", () => {
    expect(
      adjacentAppointments(appointments, "cancelled", columnOrder),
    ).toEqual({ previousId: null, nextId: null });
  });
});

describe("professionalOptions", () => {
  const directory = [
    { id: "p-zoe", full_name: "Zoe Ruiz", specialty_id: "spec-logo" },
    { id: "p-marc", full_name: "Marc Ejemplo", specialty_id: "spec-fisio" },
    { id: "p-ana", full_name: "Ana Soler", specialty_id: "spec-logo" },
    { id: "p-owner", full_name: "Patricia Hernán", specialty_id: null },
  ];

  it("lists only the active professionals of the service's specialty, since nobody else can take the appointment", () => {
    expect(
      professionalOptions({
        directory,
        specialtyId: "spec-logo",
        current: { id: "p-zoe", name: "Zoe Ruiz" },
      }),
    ).toEqual([
      { value: "p-ana", label: "Ana Soler" },
      { value: "p-zoe", label: "Zoe Ruiz" },
    ]);
  });

  it("keeps an inactive current professional visible but not selectable, so the appointment can only move away from her", () => {
    expect(
      professionalOptions({
        directory,
        specialtyId: "spec-fisio",
        current: { id: "p-gone", name: "Laura Ejemplo" },
      }),
    ).toEqual([
      { value: "p-gone", label: "Laura Ejemplo (inactiva)", disabled: true },
      { value: "p-marc", label: "Marc Ejemplo" },
    ]);
  });
});

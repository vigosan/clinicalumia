import { describe, expect, it } from "vitest";
import {
  appointmentError,
  type Block,
  canMarkNoShow,
  canMove,
  layoutDay,
  parseAppointmentForm,
  scheduleWarnings,
  specialtyTone,
  visibleHours,
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
      { id: "a", kind: "own", top: 70, height: 45 },
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
      { id: "a", kind: "busy", top: 0, height: 30 },
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
      { id: "a", kind: "time_off", top: 240, height: 60 },
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
      error: "Elige profesional.",
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

  it("maps appointment_not_started", () => {
    expect(
      appointmentError({ code: "23514", message: "appointment_not_started" }),
    ).toBe(
      "Solo se puede marcar «no se presentó» cuando la cita ya ha empezado.",
    );
  });

  it("maps appointment_cancelled_final", () => {
    expect(
      appointmentError({
        code: "23514",
        message: "appointment_cancelled_final",
      }),
    ).toBe("Una cita cancelada no se puede reprogramar; crea una nueva.");
  });

  it("maps appointment_in_past", () => {
    expect(
      appointmentError({ code: "23514", message: "appointment_in_past" }),
    ).toBe("No se puede mover una cita que ya ha pasado.");
  });

  it("maps patient_not_bookable", () => {
    expect(
      appointmentError({ code: "23514", message: "patient_not_bookable" }),
    ).toBe("Esa persona no es paciente o está archivada.");
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

  it("maps appointment_invalid_transition to the no_show-cannot-be-cancelled ruling", () => {
    expect(
      appointmentError({
        code: "23514",
        message: "appointment_invalid_transition",
      }),
    ).toBe("No se puede cancelar una cita marcada como no presentada.");
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

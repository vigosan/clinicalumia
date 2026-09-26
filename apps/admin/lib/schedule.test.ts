import { describe, expect, it } from "vitest";
import { madridDayBounds, validateSchedule } from "./schedule";

describe("validateSchedule", () => {
  it("accepts separate blocks and returns them ordered by day and time", () => {
    expect(
      validateSchedule([
        { weekday: 2, starts_at: "15:15", ends_at: "20:30" },
        { weekday: 1, starts_at: "15:15", ends_at: "20:30" },
        { weekday: 1, starts_at: "09:30", ends_at: "13:30" },
      ]),
    ).toEqual({
      ok: true,
      blocks: [
        { weekday: 1, starts_at: "09:30", ends_at: "13:30" },
        { weekday: 1, starts_at: "15:15", ends_at: "20:30" },
        { weekday: 2, starts_at: "15:15", ends_at: "20:30" },
      ],
    });
  });

  it("names the day when two blocks overlap, so the owner knows what to fix", () => {
    expect(
      validateSchedule([
        { weekday: 3, starts_at: "10:00", ends_at: "12:00" },
        { weekday: 3, starts_at: "11:30", ends_at: "13:00" },
      ]),
    ).toEqual({ error: "El miércoles tiene dos tramos que se solapan." });
  });

  it("allows one block to start exactly when the previous one ends", () => {
    expect(
      validateSchedule([
        { weekday: 1, starts_at: "09:00", ends_at: "13:00" },
        { weekday: 1, starts_at: "13:00", ends_at: "14:00" },
      ]),
    ).toHaveProperty("ok", true);
  });

  it("rejects a block that ends before it starts or has an invalid time", () => {
    expect(
      validateSchedule([{ weekday: 5, starts_at: "14:00", ends_at: "10:00" }]),
    ).toEqual({
      error: "El viernes tiene un tramo que termina antes de empezar.",
    });
    expect(
      validateSchedule([{ weekday: 1, starts_at: "25:00", ends_at: "26:00" }]),
    ).toEqual({
      error: "Hay una hora no válida en el lunes.",
    });
  });

  it("accepts an empty schedule, for someone who does not see patients", () => {
    expect(validateSchedule([])).toEqual({ ok: true, blocks: [] });
  });

  it("names an invalid weekday distinctly from an invalid time, so the owner isn't shown a broken message", () => {
    expect(
      validateSchedule([{ weekday: 8, starts_at: "10:00", ends_at: "12:00" }]),
    ).toEqual({
      error: "Hay un día no válido en el horario.",
    });
    expect(
      validateSchedule([{ weekday: 0, starts_at: "10:00", ends_at: "12:00" }]),
    ).toEqual({
      error: "Hay un día no válido en el horario.",
    });
  });
});

describe("madridDayBounds", () => {
  it("uses the summer offset (CEST) for a date in July", () => {
    expect(madridDayBounds("2026-07-15")).toEqual({
      start: "2026-07-15T00:00:00+02:00",
      end: "2026-07-15T23:59:59+02:00",
    });
  });

  it("uses the winter offset (CET) for a date in December", () => {
    expect(madridDayBounds("2026-12-24")).toEqual({
      start: "2026-12-24T00:00:00+01:00",
      end: "2026-12-24T23:59:59+01:00",
    });
  });

  it("resolves each boundary's own offset on the spring-forward day, when midnight and 23:59:59 fall on different sides of the change", () => {
    expect(madridDayBounds("2026-03-29")).toEqual({
      start: "2026-03-29T00:00:00+01:00",
      end: "2026-03-29T23:59:59+02:00",
    });
  });

  it("resolves each boundary's own offset on the fall-back day, when midnight and 23:59:59 fall on different sides of the change", () => {
    expect(madridDayBounds("2026-10-25")).toEqual({
      start: "2026-10-25T00:00:00+02:00",
      end: "2026-10-25T23:59:59+01:00",
    });
  });
});

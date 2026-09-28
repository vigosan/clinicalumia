import { describe, expect, it } from "vitest";
import { validateSchedule } from "./schedule";

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

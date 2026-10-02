import { describe, expect, it } from "vitest";
import {
  formatHistoryMoment,
  formatMadridDateTime,
  formatShortMadridDay,
} from "./madrid-format";

describe("formatHistoryMoment", () => {
  it("shows the day, month and time in Madrid, so staff read history entries in the clinic's own clock", () => {
    expect(formatHistoryMoment("2026-09-30T08:05:00Z")).toBe(
      "30/09 a las 10:05",
    );
  });

  it("follows the winter offset after the clocks go back", () => {
    expect(formatHistoryMoment("2026-10-26T08:05:00Z")).toBe(
      "26/10 a las 09:05",
    );
  });
});

describe("formatMadridDateTime", () => {
  it("adds the Madrid time after the day, across the clock change", () => {
    expect(formatMadridDateTime("2026-09-30T08:05:00Z")).toBe(
      "30/09/2026 10:05",
    );
    expect(formatMadridDateTime("2026-10-26T08:05:00Z")).toBe(
      "26/10/2026 09:05",
    );
  });
});

describe("formatShortMadridDay", () => {
  it("writes a short weekday, day and month, so the appointment's day fits on one line under the patient's name", () => {
    expect(formatShortMadridDay("2026-10-01T08:00:00Z")).toBe("Jue 1 oct");
  });

  it("uses the Madrid day, so an appointment late in the evening is not shown on the next UTC day", () => {
    expect(formatShortMadridDay("2026-09-30T22:30:00Z")).toBe("Jue 1 oct");
  });
});

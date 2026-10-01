import { describe, expect, it } from "vitest";
import {
  formatDay,
  formatHistoryMoment,
  formatMadridDate,
  formatMadridDateTime,
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

describe("formatDay", () => {
  it("writes a calendar day the Spanish way, day first", () => {
    expect(formatDay("2026-10-05")).toBe("05/10/2026");
  });
});

describe("formatMadridDate", () => {
  it("uses the Madrid day, so a late-evening instant is not shown as the next day in UTC terms", () => {
    expect(formatMadridDate("2026-10-04T22:30:00Z")).toBe("05/10/2026");
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

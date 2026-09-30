import { describe, expect, it } from "vitest";
import { formatHistoryMoment } from "./madrid-format";

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

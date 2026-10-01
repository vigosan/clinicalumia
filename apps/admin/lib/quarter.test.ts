import { madridInstant } from "@clinicalumia/api/madrid-time";
import { describe, expect, it } from "vitest";
import { isCurrentQuarter, lastClosedQuarter, quarterRange } from "./quarter";

describe("quarterRange", () => {
  it("bounds Q1 from 1 January to 1 April, Madrid time", () => {
    expect(quarterRange(2026, 1)).toEqual({
      from: madridInstant("2026-01-01", "00:00"),
      to: madridInstant("2026-04-01", "00:00"),
    });
  });

  it("bounds Q2 from 1 April to 1 July, Madrid time", () => {
    expect(quarterRange(2026, 2)).toEqual({
      from: madridInstant("2026-04-01", "00:00"),
      to: madridInstant("2026-07-01", "00:00"),
    });
  });

  it("bounds Q3 from 1 July to 1 October, Madrid time", () => {
    expect(quarterRange(2026, 3)).toEqual({
      from: madridInstant("2026-07-01", "00:00"),
      to: madridInstant("2026-10-01", "00:00"),
    });
  });

  it("bounds Q4 from 1 October to 1 January of the next year, Madrid time", () => {
    expect(quarterRange(2026, 4)).toEqual({
      from: madridInstant("2026-10-01", "00:00"),
      to: madridInstant("2027-01-01", "00:00"),
    });
  });

  it("keeps the upper bound exclusive, so an invoice issued exactly at the next quarter's start does not belong to this one", () => {
    const { to } = quarterRange(2026, 1);
    expect(to).toBe(madridInstant("2026-04-01", "00:00"));
  });
});

describe("isCurrentQuarter, on the spring-forward day (29/03/2026)", () => {
  it("still counts an invoice issued that day as Q1, since the DST change does not move the quarter boundary", () => {
    const now = new Date(madridInstant("2026-03-29", "10:00"));
    expect(isCurrentQuarter(2026, 1, now)).toBe(true);
    expect(isCurrentQuarter(2026, 2, now)).toBe(false);
  });
});

describe("isCurrentQuarter, on the fall-back day (25/10/2026)", () => {
  it("counts an invoice issued that day as Q4, since 25/10 already falls after the 1 October boundary", () => {
    const now = new Date(madridInstant("2026-10-25", "10:00"));
    expect(isCurrentQuarter(2026, 4, now)).toBe(true);
    expect(isCurrentQuarter(2026, 3, now)).toBe(false);
  });
});

describe("isCurrentQuarter, at 31/03 23:30 Madrid", () => {
  it("is still Q1, one half hour before the quarter actually turns over", () => {
    const now = new Date(madridInstant("2026-03-31", "23:30"));
    expect(isCurrentQuarter(2026, 1, now)).toBe(true);
    expect(isCurrentQuarter(2026, 2, now)).toBe(false);
  });
});

describe("isCurrentQuarter, at 31/12 23:59 Madrid", () => {
  it("is still Q4 of the old year, one minute before midnight", () => {
    const now = new Date(madridInstant("2026-12-31", "23:59"));
    expect(isCurrentQuarter(2026, 4, now)).toBe(true);
    expect(isCurrentQuarter(2027, 1, now)).toBe(false);
  });
});

describe("lastClosedQuarter", () => {
  it("returns the previous quarter of the same year, mid-year", () => {
    const now = new Date(madridInstant("2026-08-15", "10:00"));
    expect(lastClosedQuarter(now)).toEqual({ year: 2026, q: 2 });
  });

  it("rolls back to Q4 of the previous year when the current quarter is Q1", () => {
    const now = new Date(madridInstant("2026-02-10", "10:00"));
    expect(lastClosedQuarter(now)).toEqual({ year: 2025, q: 4 });
  });

  it("is still Q4 of the previous year one minute before the Q1 boundary turns over", () => {
    const now = new Date(madridInstant("2026-12-31", "23:59"));
    expect(lastClosedQuarter(now)).toEqual({ year: 2026, q: 3 });
  });

  it("already treats the new quarter as current right at its first instant, so the closed quarter becomes the one that just ended", () => {
    const now = new Date(madridInstant("2026-01-01", "00:00"));
    expect(lastClosedQuarter(now)).toEqual({ year: 2025, q: 4 });
  });
});

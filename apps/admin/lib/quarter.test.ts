import { describe, expect, it } from "vitest";
import { isCurrentQuarter, lastClosedQuarter, quarterRange } from "./quarter";

function inQuarter(
  instant: string,
  range: { from: string; to: string },
): boolean {
  const t = Date.parse(instant);
  return t >= Date.parse(range.from) && t < Date.parse(range.to);
}

describe("quarterRange", () => {
  it("bounds Q1 2026 from 1 January 00:00 Madrid (winter) to 1 April 00:00 Madrid (summer)", () => {
    const { from, to } = quarterRange(2026, 1);
    expect(new Date(from).toISOString()).toBe("2025-12-31T23:00:00.000Z");
    expect(new Date(to).toISOString()).toBe("2026-03-31T22:00:00.000Z");
  });

  it("bounds Q2 2026 from 1 April 00:00 Madrid to 1 July 00:00 Madrid", () => {
    const { from, to } = quarterRange(2026, 2);
    expect(new Date(from).toISOString()).toBe("2026-03-31T22:00:00.000Z");
    expect(new Date(to).toISOString()).toBe("2026-06-30T22:00:00.000Z");
  });

  it("bounds Q3 2026 from 1 July 00:00 Madrid to 1 October 00:00 Madrid", () => {
    const { from, to } = quarterRange(2026, 3);
    expect(new Date(from).toISOString()).toBe("2026-06-30T22:00:00.000Z");
    expect(new Date(to).toISOString()).toBe("2026-09-30T22:00:00.000Z");
  });

  it("bounds Q4 2026 from 1 October 00:00 Madrid to 1 January 2027 00:00 Madrid (back to winter)", () => {
    const { from, to } = quarterRange(2026, 4);
    expect(new Date(from).toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(new Date(to).toISOString()).toBe("2026-12-31T23:00:00.000Z");
  });
});

describe("quarterRange membership", () => {
  it("keeps the upper bound exclusive: the instant at a quarter's end already belongs to the next quarter, not this one", () => {
    const q1 = quarterRange(2026, 1);
    const q2 = quarterRange(2026, 2);
    expect(inQuarter(q1.to, q1)).toBe(false);
    expect(inQuarter(q1.to, q2)).toBe(true);
  });

  it("31/03 23:30 Madrid still belongs to Q1, half an hour before the quarter turns over", () => {
    const instant = "2026-03-31T21:30:00Z";
    expect(inQuarter(instant, quarterRange(2026, 1))).toBe(true);
    expect(inQuarter(instant, quarterRange(2026, 2))).toBe(false);
  });

  it("1 April 00:00 Madrid already belongs to Q2, not Q1", () => {
    const instant = "2026-03-31T22:00:00Z";
    expect(inQuarter(instant, quarterRange(2026, 2))).toBe(true);
    expect(inQuarter(instant, quarterRange(2026, 1))).toBe(false);
  });

  it("31/12 23:59 Madrid still belongs to Q4 2026, one minute before midnight", () => {
    const instant = "2026-12-31T22:59:00Z";
    expect(inQuarter(instant, quarterRange(2026, 4))).toBe(true);
  });

  it("1 January 2027 00:00 Madrid already belongs to 2027 Q1, not 2026 Q4", () => {
    const instant = "2026-12-31T23:00:00Z";
    expect(inQuarter(instant, quarterRange(2027, 1))).toBe(true);
    expect(inQuarter(instant, quarterRange(2026, 4))).toBe(false);
  });

  it("29/03/2026, the spring-forward day, still belongs to Q1", () => {
    const instant = "2026-03-29T08:00:00Z";
    expect(inQuarter(instant, quarterRange(2026, 1))).toBe(true);
  });

  it("25/10/2026, the fall-back day, already belongs to Q4", () => {
    const instant = "2026-10-25T08:00:00Z";
    expect(inQuarter(instant, quarterRange(2026, 4))).toBe(true);
    expect(inQuarter(instant, quarterRange(2026, 3))).toBe(false);
  });
});

describe("isCurrentQuarter", () => {
  it("still treats an invoice issued on the spring-forward day (29/03/2026) as Q1, since the DST change does not move the quarter boundary", () => {
    const now = new Date("2026-03-29T08:00:00Z");
    expect(isCurrentQuarter(2026, 1, now)).toBe(true);
    expect(isCurrentQuarter(2026, 2, now)).toBe(false);
  });

  it("already treats an invoice issued on the fall-back day (25/10/2026) as Q4, since 25/10 falls after the 1 October boundary", () => {
    const now = new Date("2026-10-25T08:00:00Z");
    expect(isCurrentQuarter(2026, 4, now)).toBe(true);
    expect(isCurrentQuarter(2026, 3, now)).toBe(false);
  });

  it("is still Q1 at 31/03 23:30 Madrid, half an hour before the quarter turns over", () => {
    const now = new Date("2026-03-31T21:30:00Z");
    expect(isCurrentQuarter(2026, 1, now)).toBe(true);
    expect(isCurrentQuarter(2026, 2, now)).toBe(false);
  });

  it("is still Q4 of the old year at 31/12 23:59 Madrid, one minute before midnight", () => {
    const now = new Date("2026-12-31T22:59:00Z");
    expect(isCurrentQuarter(2026, 4, now)).toBe(true);
    expect(isCurrentQuarter(2027, 1, now)).toBe(false);
  });
});

describe("lastClosedQuarter", () => {
  it("returns the previous quarter of the same year, mid-year", () => {
    const now = new Date("2026-08-15T08:00:00Z");
    expect(lastClosedQuarter(now)).toEqual({ year: 2026, q: 2 });
  });

  it("rolls back to Q4 of the previous year when the current quarter is Q1", () => {
    const now = new Date("2026-02-10T09:00:00Z");
    expect(lastClosedQuarter(now)).toEqual({ year: 2025, q: 4 });
  });

  it("is still Q3 of the current year at 31/12 23:59 Madrid, since Q4 has not closed yet", () => {
    const now = new Date("2026-12-31T22:59:00Z");
    expect(lastClosedQuarter(now)).toEqual({ year: 2026, q: 3 });
  });

  it("already treats the new quarter as current right at its first instant, so the closed quarter becomes the one that just ended", () => {
    const now = new Date("2025-12-31T23:00:00Z");
    expect(lastClosedQuarter(now)).toEqual({ year: 2025, q: 4 });
  });
});

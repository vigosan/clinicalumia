import { describe, expect, it } from "vitest";
import {
  addDays,
  madridDateTime,
  madridDayBounds,
  madridInstant,
  todayInMadrid,
  weekdayOf,
  weekStart,
} from "./madrid-time";

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

describe("todayInMadrid", () => {
  it("rolls over to the next day since Madrid is ahead of UTC in winter", () => {
    expect(todayInMadrid(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });

  it("rolls over to the next day at midnight in summer, when Madrid is UTC+2", () => {
    expect(todayInMadrid(new Date("2026-07-14T22:30:00Z"))).toBe("2026-07-15");
  });

  it("still uses the winter offset just before the spring DST change", () => {
    expect(todayInMadrid(new Date("2026-03-28T23:30:00Z"))).toBe("2026-03-29");
  });

  it("still uses the summer offset just before the autumn DST change", () => {
    expect(todayInMadrid(new Date("2026-10-24T22:30:00Z"))).toBe("2026-10-25");
  });
});

describe("madridInstant", () => {
  it("uses the winter offset for a date in January", () => {
    expect(madridInstant("2026-01-15", "10:00")).toBe(
      "2026-01-15T10:00:00+01:00",
    );
  });

  it("uses the summer offset for a date in July", () => {
    expect(madridInstant("2026-07-15", "10:00")).toBe(
      "2026-07-15T10:00:00+02:00",
    );
  });

  it("uses the summer offset on the spring-forward day at 10:00, after the change", () => {
    expect(madridInstant("2026-03-29", "10:00")).toBe(
      "2026-03-29T10:00:00+02:00",
    );
  });

  it("uses the winter offset on the fall-back day at 10:00, after the change", () => {
    expect(madridInstant("2026-10-25", "10:00")).toBe(
      "2026-10-25T10:00:00+01:00",
    );
  });

  it("never throws for the hour skipped when clocks go forward, and returns a valid ISO string", () => {
    const instant = madridInstant("2026-03-29", "02:30");
    expect(instant).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
    );
    expect(Number.isNaN(new Date(instant).getTime())).toBe(false);
    expect(instant).toBe("2026-03-29T02:30:00+02:00");
  });

  it("never throws for the hour repeated when clocks go back, and returns a valid ISO string", () => {
    const instant = madridInstant("2026-10-25", "02:30");
    expect(instant).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
    );
    expect(Number.isNaN(new Date(instant).getTime())).toBe(false);
    expect(instant).toBe("2026-10-25T02:30:00+01:00");
  });

  it("throws for a date that does not exist on the calendar, instead of silently rolling over", () => {
    expect(() => madridInstant("2026-02-30", "10:00")).toThrow();
  });

  it("throws for a month out of range", () => {
    expect(() => madridInstant("2026-13-01", "10:00")).toThrow();
  });

  it("throws for an hour out of range", () => {
    expect(() => madridInstant("2026-01-15", "25:00")).toThrow();
  });

  it("throws for a minute out of range", () => {
    expect(() => madridInstant("2026-01-15", "10:60")).toThrow();
  });

  it("still accepts a valid leap day", () => {
    expect(madridInstant("2028-02-29", "09:00")).toBe(
      "2028-02-29T09:00:00+01:00",
    );
  });
});

describe("madridDateTime", () => {
  it("converts a winter instant back to its Madrid wall date and time", () => {
    expect(madridDateTime(madridInstant("2026-01-15", "10:00"))).toEqual({
      date: "2026-01-15",
      time: "10:00",
    });
  });

  it("converts a summer instant back to its Madrid wall date and time", () => {
    expect(madridDateTime(madridInstant("2026-07-15", "10:00"))).toEqual({
      date: "2026-07-15",
      time: "10:00",
    });
  });

  it("rolls over to the next Madrid day when the UTC instant falls after the fall-back change", () => {
    expect(madridDateTime("2026-10-24T22:30:00Z")).toEqual({
      date: "2026-10-25",
      time: "00:30",
    });
  });

  it("round-trips the repeated hour back to itself, since madridInstant resolves it to its later, unambiguous occurrence", () => {
    expect(madridDateTime(madridInstant("2026-10-25", "02:30"))).toEqual({
      date: "2026-10-25",
      time: "02:30",
    });
  });

  it("does not round-trip the skipped hour, since 02:30 never happens on the Madrid clock on the spring-forward day", () => {
    expect(madridDateTime(madridInstant("2026-03-29", "02:30"))).toEqual({
      date: "2026-03-29",
      time: "01:30",
    });
  });
});

describe("addDays", () => {
  it("advances a date by the given number of days, across a month boundary", () => {
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
  });
});

describe("weekStart", () => {
  it("returns the previous Monday for a date mid-week", () => {
    expect(weekStart("2026-10-25")).toBe("2026-10-19");
  });

  it("returns the same date when it is already a Monday", () => {
    expect(weekStart("2026-10-19")).toBe("2026-10-19");
  });
});

describe("weekdayOf", () => {
  it("returns 1 for a Monday", () => {
    expect(weekdayOf("2026-09-28")).toBe(1);
  });
});

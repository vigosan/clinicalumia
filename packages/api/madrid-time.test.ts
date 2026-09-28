import { describe, expect, it } from "vitest";
import { madridDayBounds, todayInMadrid } from "./madrid-time";

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

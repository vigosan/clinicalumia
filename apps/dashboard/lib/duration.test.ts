import { describe, expect, it } from "vitest";
import { durationOptions, formatMinutes } from "./duration";

describe("formatMinutes", () => {
  it.each([
    [15, "15 min"],
    [60, "1 h"],
    [90, "1 h 30 min"],
    [120, "2 h"],
  ])("writes %i minutes as %s", (minutes, label) => {
    expect(formatMinutes(minutes)).toBe(label);
  });
});

describe("durationOptions", () => {
  it("offers the usual lengths and Otra…", () => {
    expect(durationOptions("").map((o) => o.label)).toEqual([
      "15 min",
      "30 min",
      "45 min",
      "1 h",
      "1 h 30 min",
      "2 h",
      "Otra…",
    ]);
  });

  it("adds a service length that is not a usual one, so it shows as chosen", () => {
    expect(durationOptions("50").map((o) => o.value)).toEqual([
      "15",
      "30",
      "45",
      "50",
      "60",
      "90",
      "120",
      "other",
    ]);
  });
});

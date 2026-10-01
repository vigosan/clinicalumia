import { describe, expect, it } from "vitest";
import { madridRangePresets } from "./date-presets";

function presets(instant: string) {
  return Object.fromEntries(
    madridRangePresets(new Date(instant)).map(({ key, from, to }) => [
      key,
      { from, to },
    ]),
  );
}

describe("madridRangePresets", () => {
  it("labels the shortcuts the clinic asked for, in order", () => {
    expect(
      madridRangePresets(new Date("2026-10-01T10:00:00Z")).map((p) => p.label),
    ).toEqual(["Hoy", "Ayer", "Esta semana", "Este mes"]);
  });

  it("uses the Madrid day, so a late-evening check in summer already counts as tomorrow", () => {
    expect(presets("2026-07-14T22:30:00Z")).toEqual({
      hoy: { from: "2026-07-15", to: "2026-07-15" },
      ayer: { from: "2026-07-14", to: "2026-07-14" },
      semana: { from: "2026-07-13", to: "2026-07-19" },
      mes: { from: "2026-07-01", to: "2026-07-31" },
    });
  });

  it("gets the spring clock change right: just after midnight of Sunday 29 March it is already that Sunday", () => {
    expect(presets("2026-03-28T23:30:00Z")).toEqual({
      hoy: { from: "2026-03-29", to: "2026-03-29" },
      ayer: { from: "2026-03-28", to: "2026-03-28" },
      semana: { from: "2026-03-23", to: "2026-03-29" },
      mes: { from: "2026-03-01", to: "2026-03-31" },
    });
  });

  it("gets the day after the spring change right, when the 23-hour Sunday is yesterday", () => {
    expect(presets("2026-03-29T22:30:00Z")).toEqual({
      hoy: { from: "2026-03-30", to: "2026-03-30" },
      ayer: { from: "2026-03-29", to: "2026-03-29" },
      semana: { from: "2026-03-30", to: "2026-04-05" },
      mes: { from: "2026-03-01", to: "2026-03-31" },
    });
  });

  it("gets the autumn clock change right: late on Sunday 25 October it is still that Sunday", () => {
    expect(presets("2026-10-25T22:30:00Z")).toEqual({
      hoy: { from: "2026-10-25", to: "2026-10-25" },
      ayer: { from: "2026-10-24", to: "2026-10-24" },
      semana: { from: "2026-10-19", to: "2026-10-25" },
      mes: { from: "2026-10-01", to: "2026-10-31" },
    });
  });

  it("gets the day after the autumn change right, when the 25-hour Sunday is yesterday", () => {
    expect(presets("2026-10-25T23:30:00Z")).toEqual({
      hoy: { from: "2026-10-26", to: "2026-10-26" },
      ayer: { from: "2026-10-25", to: "2026-10-25" },
      semana: { from: "2026-10-26", to: "2026-11-01" },
      mes: { from: "2026-10-01", to: "2026-10-31" },
    });
  });

  it("ends February on the 28th in a common year", () => {
    expect(presets("2027-02-10T10:00:00Z").mes).toEqual({
      from: "2027-02-01",
      to: "2027-02-28",
    });
  });
});

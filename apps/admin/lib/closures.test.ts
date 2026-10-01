import { describe, expect, it } from "vitest";
import { closureLabel, splitClosures } from "./closures";

describe("closureLabel", () => {
  it("shows both days of a range in Spanish order so the owner reads it as she writes it", () => {
    expect(
      closureLabel({
        starts_on: "2026-12-24",
        ends_on: "2026-12-26",
        reason: "Navidad",
      }),
    ).toBe("24/12/2026 – 26/12/2026 · Navidad");
  });

  it("shows a single day once instead of repeating it as a range", () => {
    expect(
      closureLabel({
        starts_on: "2027-01-06",
        ends_on: "2027-01-06",
        reason: "Reyes",
      }),
    ).toBe("06/01/2027 · Reyes");
  });
});

describe("splitClosures", () => {
  const closure = (starts_on: string, ends_on: string) => ({
    id: starts_on,
    starts_on,
    ends_on,
    reason: "Motivo",
  });

  it("keeps a closure that is still running today among the upcoming ones, because the clinic is still closed", () => {
    const { upcoming, past } = splitClosures(
      [
        closure("2026-09-01", "2026-09-02"),
        closure("2026-09-30", "2026-10-02"),
        closure("2026-12-24", "2026-12-26"),
      ],
      "2026-10-01",
    );
    expect(upcoming.map((c) => c.id)).toEqual(["2026-09-30", "2026-12-24"]);
    expect(past.map((c) => c.id)).toEqual(["2026-09-01"]);
  });

  it("lists upcoming closures soonest first and past ones most recent first", () => {
    const { upcoming, past } = splitClosures(
      [
        closure("2026-01-06", "2026-01-06"),
        closure("2026-08-15", "2026-08-15"),
        closure("2026-11-01", "2026-11-01"),
        closure("2026-12-08", "2026-12-08"),
      ],
      "2026-10-01",
    );
    expect(upcoming.map((c) => c.id)).toEqual(["2026-11-01", "2026-12-08"]);
    expect(past.map((c) => c.id)).toEqual(["2026-08-15", "2026-01-06"]);
  });
});

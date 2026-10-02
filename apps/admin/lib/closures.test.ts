import { describe, expect, it } from "vitest";
import {
  closureDays,
  closureLabel,
  closuresInMonth,
  longDay,
  monthFromParam,
  monthGrid,
  monthLabel,
  shiftMonth,
} from "./closures";

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

const christmas = {
  id: "c1",
  starts_on: "2026-12-24",
  ends_on: "2026-12-26",
  reason: "Navidad",
};
const newYear = {
  id: "c2",
  starts_on: "2026-12-31",
  ends_on: "2027-01-01",
  reason: "Año nuevo",
};

describe("monthGrid", () => {
  it("lays out whole weeks from Monday to Sunday, so the first and last rows include days of the months around it", () => {
    const weeks = monthGrid("2026-10", []);
    expect(weeks).toHaveLength(5);
    expect(weeks[0]?.map((cell) => cell.date)).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(weeks[0]?.map((cell) => cell.inMonth)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(weeks.at(-1)?.at(-1)?.date).toBe("2026-11-01");
  });

  it("marks every day of a closure that spans several days, so the owner sees the whole bridge", () => {
    const closed = monthGrid("2026-12", [christmas])
      .flat()
      .filter((cell) => cell.closure)
      .map((cell) => cell.date);
    expect(closed).toEqual(["2026-12-24", "2026-12-25", "2026-12-26"]);
  });

  it("shows a closure that crosses into the next month on both sides", () => {
    const december = monthGrid("2026-12", [newYear]).flat();
    const january = monthGrid("2027-01", [newYear]).flat();
    expect(
      december.find((cell) => cell.date === "2026-12-31")?.closure,
    ).toEqual(newYear);
    expect(january.find((cell) => cell.date === "2027-01-01")?.closure).toEqual(
      newYear,
    );
  });
});

describe("closuresInMonth", () => {
  it("lists the closures that touch the month in date order, including one that starts in the month before", () => {
    expect(closuresInMonth([newYear, christmas], "2026-12")).toEqual([
      christmas,
      newYear,
    ]);
    expect(closuresInMonth([newYear, christmas], "2027-01")).toEqual([newYear]);
    expect(closuresInMonth([newYear, christmas], "2026-11")).toEqual([]);
  });
});

describe("monthFromParam", () => {
  it("opens the month in the address so a reload or a shared link keeps it", () => {
    expect(monthFromParam("2027-03", "2026-10-02")).toBe("2027-03");
  });

  it("falls back to the current month when the address has none or a wrong one", () => {
    expect(monthFromParam(undefined, "2026-10-02")).toBe("2026-10");
    expect(monthFromParam("2026-13", "2026-10-02")).toBe("2026-10");
    expect(monthFromParam("octubre", "2026-10-02")).toBe("2026-10");
  });
});

describe("shiftMonth", () => {
  it("moves across the year boundary in both directions", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
  });
});

describe("monthLabel", () => {
  it("names the month in Spanish with a capital letter, as a heading", () => {
    expect(monthLabel("2026-10")).toBe("Octubre de 2026");
  });
});

describe("longDay", () => {
  it("writes a date the way the owner says it, without the year", () => {
    expect(longDay("2027-01-30")).toBe("30 de enero");
    expect(longDay("2026-10-05")).toBe("5 de octubre");
  });
});

describe("closureDays", () => {
  it("names a single closed day once", () => {
    expect(
      closureDays({ starts_on: "2026-12-08", ends_on: "2026-12-08" }),
    ).toBe("8 de diciembre");
  });

  it("joins the days of a range inside one month so the month is not repeated", () => {
    expect(
      closureDays({ starts_on: "2026-12-24", ends_on: "2026-12-26" }),
    ).toBe("24–26 de diciembre");
  });

  it("spells out both months when the range crosses into the next one", () => {
    expect(
      closureDays({ starts_on: "2026-12-30", ends_on: "2027-01-02" }),
    ).toBe("30 de diciembre – 2 de enero");
  });
});

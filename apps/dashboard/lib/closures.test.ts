import { describe, expect, it, vi } from "vitest";
import { type Closure, closureOn, loadClosures } from "./closures";

const CHRISTMAS: Closure = {
  id: "c1",
  startsOn: "2026-12-24",
  endsOn: "2026-12-26",
  reason: "Navidad",
};

const KINGS: Closure = {
  id: "c2",
  startsOn: "2027-01-06",
  endsOn: "2027-01-06",
  reason: "Reyes",
};

describe("closureOn", () => {
  it("finds a single-day closure on its own day, so that day is marked closed", () => {
    expect(closureOn("2027-01-06", [CHRISTMAS, KINGS])).toEqual(KINGS);
  });

  it("covers the first, middle and last day of a multi-day closure, because both ends are included", () => {
    expect(closureOn("2026-12-24", [CHRISTMAS])).toEqual(CHRISTMAS);
    expect(closureOn("2026-12-25", [CHRISTMAS])).toEqual(CHRISTMAS);
    expect(closureOn("2026-12-26", [CHRISTMAS])).toEqual(CHRISTMAS);
  });

  it("leaves the days right before and after a closure open, so neighbouring days are not marked", () => {
    expect(closureOn("2026-12-23", [CHRISTMAS, KINGS])).toBeNull();
    expect(closureOn("2026-12-27", [CHRISTMAS, KINGS])).toBeNull();
    expect(closureOn("2027-01-05", [CHRISTMAS, KINGS])).toBeNull();
    expect(closureOn("2027-01-07", [CHRISTMAS, KINGS])).toBeNull();
  });

  it("returns null when there are no closures", () => {
    expect(closureOn("2026-12-25", [])).toBeNull();
  });
});

function fakeClient(result: {
  data: unknown[] | null;
  error: { code?: string } | null;
}) {
  const calls: [string, ...unknown[]][] = [];
  const builder = {
    select: (...args: unknown[]) => {
      calls.push(["select", ...args]);
      return builder;
    },
    gte: (...args: unknown[]) => {
      calls.push(["gte", ...args]);
      return builder;
    },
    lte: (...args: unknown[]) => {
      calls.push(["lte", ...args]);
      return builder;
    },
    order: (...args: unknown[]) => {
      calls.push(["order", ...args]);
      return Promise.resolve(result);
    },
  };
  const from = vi.fn(() => builder);
  return { client: { from }, from, calls };
}

describe("loadClosures", () => {
  it("asks for the closures that overlap the visible days, so a closure starting before or ending after the range still shows", async () => {
    const { client, from, calls } = fakeClient({ data: [], error: null });
    await loadClosures(client as never, "2026-12-21", "2026-12-27");
    expect(from).toHaveBeenCalledWith("clinic_closures");
    expect(calls).toEqual([
      ["select", "id, starts_on, ends_on, reason"],
      ["gte", "ends_on", "2026-12-21"],
      ["lte", "starts_on", "2026-12-27"],
      ["order", "starts_on"],
    ]);
  });

  it("without an end asks for every closure from the start onwards, so any future date can be checked", async () => {
    const { client, calls } = fakeClient({ data: [], error: null });
    await loadClosures(client as never, "2025-10-01");
    expect(calls).toEqual([
      ["select", "id, starts_on, ends_on, reason"],
      ["gte", "ends_on", "2025-10-01"],
      ["order", "starts_on"],
    ]);
  });

  it("maps the rows to closures the views can use", async () => {
    const { client } = fakeClient({
      data: [
        {
          id: "c1",
          starts_on: "2026-12-24",
          ends_on: "2026-12-26",
          reason: "Navidad",
        },
      ],
      error: null,
    });
    expect(
      await loadClosures(client as never, "2026-12-21", "2026-12-27"),
    ).toEqual([CHRISTMAS]);
  });

  it("returns null when the query fails, so the page can show its error instead of hiding a closure", async () => {
    const { client } = fakeClient({ data: null, error: { code: "42501" } });
    expect(
      await loadClosures(client as never, "2026-12-21", "2026-12-27"),
    ).toBeNull();
  });
});

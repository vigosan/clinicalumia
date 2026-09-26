import { beforeEach, describe, expect, it, vi } from "vitest";

const owner = { ok: true as const, userId: "owner-1" };
let ownerResult: { ok: true; userId: string } | { ok: false; error: string } =
  owner;
const rpcResult = { error: null as null | { code: string; message: string } };
const insertResult = {
  error: null as null | { code: string; message: string },
};
const rpc = vi.fn(async () => rpcResult);
const insert = vi.fn(async () => insertResult);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    rpc,
    from: () => ({ insert }),
  }),
}));
vi.mock("@clinicalumia/api/auth", () => ({
  requireOwner: async () => ownerResult,
}));

const { addTimeOff, saveSchedule } = await import("./actions");

describe("saveSchedule", () => {
  beforeEach(() => {
    ownerResult = owner;
    rpcResult.error = null;
    rpc.mockClear();
  });

  it("refuses a non-owner and never calls the rpc", async () => {
    ownerResult = { ok: false, error: "No tienes permiso para hacer esto." };
    expect(
      await saveSchedule("employee-1", [
        { weekday: 1, starts_at: "09:00", ends_at: "10:00" },
      ]),
    ).toEqual({ error: "No tienes permiso para hacer esto." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns the validator's error for overlapping blocks without calling the rpc", async () => {
    expect(
      await saveSchedule("employee-1", [
        { weekday: 3, starts_at: "10:00", ends_at: "12:00" },
        { weekday: 3, starts_at: "11:00", ends_at: "13:00" },
      ]),
    ).toEqual({ error: "El miércoles tiene dos tramos que se solapan." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports overlapping blocks when the exclusion constraint rejects the rpc call", async () => {
    rpcResult.error = { code: "23P01", message: "exclusion violation" };
    expect(
      await saveSchedule("employee-1", [
        { weekday: 1, starts_at: "09:00", ends_at: "10:00" },
      ]),
    ).toEqual({ error: "Hay tramos que se solapan el mismo día." });
  });
});

describe("addTimeOff", () => {
  beforeEach(() => {
    ownerResult = owner;
    insertResult.error = null;
    insert.mockClear();
  });

  function timeOffForm(overrides: Record<string, string> = {}) {
    const data = new FormData();
    data.set("profile_id", "employee-1");
    data.set("starts_on", "2026-12-24");
    data.set("ends_on", "2026-12-26");
    data.set("reason", "Navidad");
    for (const [key, value] of Object.entries(overrides)) data.set(key, value);
    return data;
  }

  it("rejects an end date earlier than the start date without inserting anything", async () => {
    expect(
      await addTimeOff(
        undefined,
        timeOffForm({ starts_on: "2026-12-26", ends_on: "2026-12-24" }),
      ),
    ).toEqual({ error: "La fecha final no puede ser anterior a la inicial." });
    expect(insert).not.toHaveBeenCalled();
  });
});

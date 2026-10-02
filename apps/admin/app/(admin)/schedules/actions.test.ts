import { beforeEach, describe, expect, it, vi } from "vitest";

const owner = { ok: true as const, userId: "owner-1" };
let ownerResult: { ok: true; userId: string } | { ok: false; error: string } =
  owner;
const rpcResult = { error: null as null | { code: string; message: string } };
const insertResult = {
  error: null as null | { code: string; message: string },
};
const deleteResult = {
  error: null as null | { code: string; message: string },
};
const rpc = vi.fn(async () => rpcResult);
const insert = vi.fn(async (_row: unknown) => insertResult);
const deleteEq = vi.fn(async (_column: string, _value: string) => deleteResult);
const tables: string[] = [];

type AppointmentRow = {
  id: string;
  starts_at: string;
  patient: { first_name: string; last_name: string } | null;
  professional: { full_name: string } | null;
};
const appointmentsResult = {
  data: [] as AppointmentRow[] | null,
  error: null as null | { code: string; message: string },
};
const appointmentsCalls: unknown[][] = [];
const appointmentsQuery = {
  select: (...args: unknown[]) => {
    appointmentsCalls.push(["select", ...args]);
    return appointmentsQuery;
  },
  eq: (...args: unknown[]) => {
    appointmentsCalls.push(["eq", ...args]);
    return appointmentsQuery;
  },
  neq: (...args: unknown[]) => {
    appointmentsCalls.push(["neq", ...args]);
    return appointmentsQuery;
  },
  lt: (...args: unknown[]) => {
    appointmentsCalls.push(["lt", ...args]);
    return appointmentsQuery;
  },
  gt: (...args: unknown[]) => {
    appointmentsCalls.push(["gt", ...args]);
    return appointmentsQuery;
  },
  order: async (...args: unknown[]) => {
    appointmentsCalls.push(["order", ...args]);
    return appointmentsResult;
  },
};

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    rpc,
    from: (table: string) => {
      tables.push(table);
      if (table === "appointments") return appointmentsQuery;
      return { insert, delete: () => ({ eq: deleteEq }) };
    },
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
    appointmentsResult.data = [];
    appointmentsResult.error = null;
    appointmentsCalls.length = 0;
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

  it("looks for that professional's upcoming non-cancelled appointments during the absence, from the first midnight to the midnight after the last day, leaving out those already held", async () => {
    await addTimeOff(undefined, timeOffForm());
    expect(appointmentsCalls).toEqual([
      [
        "select",
        "id, starts_at, patient:people(first_name, last_name), professional:profiles!appointments_professional_id_fkey(full_name)",
      ],
      ["eq", "professional_id", "employee-1"],
      ["neq", "status", "cancelled"],
      ["lt", "starts_at", "2026-12-27T00:00:00+01:00"],
      ["gt", "ends_at", "2026-12-24T00:00:00+01:00"],
      ["gt", "starts_at", expect.any(String)],
      ["order", "starts_at", { ascending: true }],
    ]);
  });

  it("returns the appointments the absence affects, so the owner moves or cancels them instead of patients coming to an absent professional", async () => {
    appointmentsResult.data = [
      {
        id: "appointment-1",
        starts_at: "2026-12-24T09:30:00+00:00",
        patient: { first_name: "Ana", last_name: "Pérez" },
        professional: { full_name: "Laura Ejemplo" },
      },
    ];
    expect(await addTimeOff(undefined, timeOffForm())).toEqual({
      ok: true,
      affected: [
        {
          id: "appointment-1",
          date: "24/12/2026",
          time: "10:30",
          patient: "Ana Pérez",
          professional: "Laura Ejemplo",
        },
      ],
    });
  });

  it("still confirms the absence when the appointments cannot be loaded, flagging the list as unknown", async () => {
    appointmentsResult.data = null;
    appointmentsResult.error = { code: "XX000", message: "boom" };
    expect(await addTimeOff(undefined, timeOffForm())).toEqual({
      ok: true,
      affected: null,
    });
  });
});

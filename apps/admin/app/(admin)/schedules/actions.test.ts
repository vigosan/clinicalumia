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

const { addClosure, addTimeOff, deleteClosure, saveSchedule } = await import(
  "./actions"
);

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

  it("looks for that professional's non-cancelled appointments during the absence, from the first midnight to the midnight after the last day", async () => {
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

describe("addClosure", () => {
  beforeEach(() => {
    ownerResult = owner;
    insertResult.error = null;
    appointmentsResult.data = [];
    appointmentsResult.error = null;
    appointmentsCalls.length = 0;
    tables.length = 0;
    insert.mockClear();
  });

  function closureForm(overrides: Record<string, string> = {}) {
    const data = new FormData();
    data.set("starts_on", "2026-12-24");
    data.set("ends_on", "2026-12-26");
    data.set("reason", "  Navidad  ");
    for (const [key, value] of Object.entries(overrides)) data.set(key, value);
    return data;
  }

  it("refuses a non-owner without touching the database", async () => {
    ownerResult = { ok: false, error: "No tienes permiso para hacer esto." };
    expect(await addClosure(undefined, closureForm())).toEqual({
      error: "No tienes permiso para hacer esto.",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", { starts_on: "" }],
    ["impossible", { ends_on: "2027-02-30" }],
  ])("asks for the dates when one is %s, instead of letting the database guess", async (_case, overrides) => {
    expect(await addClosure(undefined, closureForm(overrides))).toEqual({
      error: "Indica las fechas del cierre.",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an end date earlier than the start date without inserting anything", async () => {
    expect(
      await addClosure(
        undefined,
        closureForm({ starts_on: "2026-12-26", ends_on: "2026-12-24" }),
      ),
    ).toEqual({ error: "La fecha final no puede ser anterior a la inicial." });
    expect(insert).not.toHaveBeenCalled();
  });

  it("requires a reason, because the agenda shows it to the team", async () => {
    expect(await addClosure(undefined, closureForm({ reason: "   " }))).toEqual(
      { error: "Indica el motivo del cierre." },
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a reason longer than 80 characters, the limit the database enforces", async () => {
    expect(
      await addClosure(undefined, closureForm({ reason: "a".repeat(81) })),
    ).toEqual({ error: "El motivo no puede tener más de 80 caracteres." });
    expect(insert).not.toHaveBeenCalled();
  });

  it("saves the closure with the reason trimmed", async () => {
    await addClosure(undefined, closureForm({ reason: ` ${"a".repeat(80)} ` }));
    expect(tables[0]).toBe("clinic_closures");
    expect(insert).toHaveBeenCalledWith({
      starts_on: "2026-12-24",
      ends_on: "2026-12-26",
      reason: "a".repeat(80),
    });
  });

  it("explains an overlap with an existing closure in Spanish", async () => {
    insertResult.error = { code: "23P01", message: "exclusion violation" };
    expect(await addClosure(undefined, closureForm())).toEqual({
      error: "Ya hay un cierre en esas fechas.",
    });
    expect(tables).not.toContain("appointments");
  });

  it("maps the database checks on the reason and on the range to Spanish", async () => {
    insertResult.error = {
      code: "23514",
      message:
        'new row for relation "clinic_closures" violates check constraint "clinic_closures_reason_check"',
    };
    expect(await addClosure(undefined, closureForm())).toEqual({
      error: "Indica un motivo de hasta 80 caracteres.",
    });
    insertResult.error = {
      code: "23514",
      message:
        'new row for relation "clinic_closures" violates check constraint "clinic_closures_check"',
    };
    expect(await addClosure(undefined, closureForm())).toEqual({
      error: "La fecha final no puede ser anterior a la inicial.",
    });
    insertResult.error = { code: "42501", message: "permission denied" };
    expect(await addClosure(undefined, closureForm())).toEqual({
      error: "No se ha podido guardar el cierre.",
    });
  });

  it("looks for non-cancelled appointments overlapping the closed Madrid days, from the first midnight to the midnight after the last day", async () => {
    await addClosure(undefined, closureForm());
    expect(appointmentsCalls).toEqual([
      [
        "select",
        "id, starts_at, patient:people(first_name, last_name), professional:profiles!appointments_professional_id_fkey(full_name)",
      ],
      ["neq", "status", "cancelled"],
      ["lt", "starts_at", "2026-12-27T00:00:00+01:00"],
      ["gt", "ends_at", "2026-12-24T00:00:00+01:00"],
      ["order", "starts_at", { ascending: true }],
    ]);
  });

  it("uses each midnight's own offset on a clock-change day, so no appointment of that day is missed", async () => {
    await addClosure(
      undefined,
      closureForm({ starts_on: "2026-10-25", ends_on: "2026-10-25" }),
    );
    expect(appointmentsCalls).toContainEqual([
      "lt",
      "starts_at",
      "2026-10-26T00:00:00+01:00",
    ]);
    expect(appointmentsCalls).toContainEqual([
      "gt",
      "ends_at",
      "2026-10-25T00:00:00+02:00",
    ]);
  });

  it("returns the affected appointments with Madrid date and time, patient and professional, so the owner can call them", async () => {
    appointmentsResult.data = [
      {
        id: "appointment-1",
        starts_at: "2026-12-24T09:30:00+00:00",
        patient: { first_name: "Ana", last_name: "Pérez" },
        professional: { full_name: "Laura Ejemplo" },
      },
    ];
    expect(await addClosure(undefined, closureForm())).toEqual({
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

  it("still confirms the closure when the appointments cannot be loaded, flagging the list as unknown", async () => {
    appointmentsResult.data = null;
    appointmentsResult.error = { code: "XX000", message: "boom" };
    expect(await addClosure(undefined, closureForm())).toEqual({
      ok: true,
      affected: null,
    });
  });
});

describe("deleteClosure", () => {
  beforeEach(() => {
    ownerResult = owner;
    deleteResult.error = null;
    deleteEq.mockClear();
    tables.length = 0;
  });

  it("refuses a non-owner without deleting anything", async () => {
    ownerResult = { ok: false, error: "No tienes permiso para hacer esto." };
    expect(await deleteClosure("closure-1")).toEqual({
      error: "No tienes permiso para hacer esto.",
    });
    expect(deleteEq).not.toHaveBeenCalled();
  });

  it("deletes only the chosen closure", async () => {
    expect(await deleteClosure("closure-1")).toEqual({ ok: true });
    expect(tables).toEqual(["clinic_closures"]);
    expect(deleteEq).toHaveBeenCalledWith("id", "closure-1");
  });

  it("reports a failed delete in Spanish", async () => {
    deleteResult.error = { code: "42501", message: "permission denied" };
    expect(await deleteClosure("closure-1")).toEqual({
      error: "No se ha podido eliminar el cierre.",
    });
  });
});

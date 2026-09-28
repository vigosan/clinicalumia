import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcResults: Record<string, { data: unknown; error: unknown }> = {
  staff_directory: {
    data: [
      {
        id: "prof-1",
        full_name: "Marc Ejemplo",
        role: "employee",
        specialty_id: "spec-1",
      },
    ],
    error: null,
  },
  agenda_busy: { data: [], error: null },
};
const rpc = vi.fn(async (name: string) => rpcResults[name]);

const schedulesResult: { data: unknown; error: unknown } = {
  data: [],
  error: null,
};
const schedulesEq = vi.fn(async () => schedulesResult);
const schedulesSelect = vi.fn(() => ({ eq: schedulesEq }));

const timeOffResult: { data: unknown; error: unknown } = {
  data: [],
  error: null,
};
const timeOffGt = vi.fn(async () => timeOffResult);
const timeOffLt = vi.fn(() => ({ gt: timeOffGt }));
const timeOffEq = vi.fn(() => ({ lt: timeOffLt }));
const timeOffSelect = vi.fn(() => ({ eq: timeOffEq }));

const insertResult: {
  data: { id: string } | null;
  error: { code?: string; message?: string } | null;
} = { data: null, error: null };
const insertSingle = vi.fn(async () => insertResult);
const insertSelect = vi.fn(() => ({ single: insertSingle }));
const appointmentsInsert = vi.fn(() => ({ select: insertSelect }));

const overlapResult: {
  data: { starts_at: string; ends_at: string } | null;
} = { data: null };
const overlapMaybeSingle = vi.fn(async () => overlapResult);
const overlapLimit = vi.fn(() => ({ maybeSingle: overlapMaybeSingle }));
const overlapGt = vi.fn(() => ({ limit: overlapLimit }));
const overlapLt = vi.fn(() => ({ gt: overlapGt }));
const overlapNeq = vi.fn(() => ({ lt: overlapLt }));
const overlapEq = vi.fn(() => ({ neq: overlapNeq }));
const appointmentsSelect = vi.fn(() => ({ eq: overlapEq }));

const peopleResult: { data: unknown; error: { message: string } | null } = {
  data: [],
  error: null,
};
const peopleLimit = vi.fn(async () => peopleResult);
const peopleOrder = vi.fn(() => ({ limit: peopleLimit }));
const peopleIlike = vi.fn(() => ({ order: peopleOrder }));
const peopleIs = vi.fn(() => ({ ilike: peopleIlike }));
const peopleEq = vi.fn(() => ({ is: peopleIs }));
const peopleSelect = vi.fn(() => ({ eq: peopleEq }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    rpc,
    from: (table: string) => {
      if (table === "employee_schedules") return { select: schedulesSelect };
      if (table === "employee_time_off") return { select: timeOffSelect };
      if (table === "appointments")
        return { insert: appointmentsInsert, select: appointmentsSelect };
      if (table === "people") return { select: peopleSelect };
      return {};
    },
  }),
}));

const { createAppointment, searchPatients } = await import("./actions");

function appointmentForm(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const defaults: Record<string, string> = {
    patient_id: "patient-1",
    service_id: "service-1",
    professional_id: "prof-1",
    date: "2026-10-05",
    time: "10:00",
    duration_minutes: "60",
    notes: "",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) {
    data.set(key, value);
  }
  return data;
}

describe("createAppointment", () => {
  beforeEach(() => {
    rpc.mockClear();
    rpcResults.staff_directory = {
      data: [
        {
          id: "prof-1",
          full_name: "Marc Ejemplo",
          role: "employee",
          specialty_id: "spec-1",
        },
      ],
      error: null,
    };
    rpcResults.agenda_busy = { data: [], error: null };
    schedulesResult.data = [];
    schedulesResult.error = null;
    schedulesSelect.mockClear();
    schedulesEq.mockClear();
    timeOffResult.data = [];
    timeOffResult.error = null;
    timeOffSelect.mockClear();
    insertResult.data = { id: "appt-1" };
    insertResult.error = null;
    appointmentsInsert.mockClear();
    insertSelect.mockClear();
    insertSingle.mockClear();
    overlapResult.data = null;
    appointmentsSelect.mockClear();
  });

  it("returns the parser's error for an invalid form without touching the database", async () => {
    expect(
      await createAppointment(undefined, appointmentForm({ patient_id: "" })),
    ).toEqual({ error: "Elige un paciente." });
    expect(rpc).not.toHaveBeenCalled();
    expect(appointmentsInsert).not.toHaveBeenCalled();
  });

  it("returns the schedule warnings without inserting when confirm is missing", async () => {
    schedulesResult.data = [];

    expect(await createAppointment(undefined, appointmentForm())).toEqual({
      warnings: ["Queda fuera del horario de Marc Ejemplo."],
    });
    expect(appointmentsInsert).not.toHaveBeenCalled();
  });

  it("inserts and redirects when the caller confirms", async () => {
    await expect(
      createAppointment(undefined, appointmentForm({ confirm: "1" })),
    ).rejects.toThrow("REDIRECT:/?date=2026-10-05&appointment=appt-1");

    expect(appointmentsInsert).toHaveBeenCalledTimes(1);
    expect(appointmentsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        patient_id: "patient-1",
        service_id: "service-1",
        professional_id: "prof-1",
        notes: "",
      }),
    );
    expect(schedulesSelect).not.toHaveBeenCalled();
  });

  it("names who and when for a 23P01 overlap", async () => {
    insertResult.data = null;
    insertResult.error = { code: "23P01" };
    overlapResult.data = {
      starts_at: "2026-10-05T14:10:00.000Z",
      ends_at: "2026-10-05T14:55:00.000Z",
    };

    expect(
      await createAppointment(undefined, appointmentForm({ confirm: "1" })),
    ).toEqual({
      error: "Marc Ejemplo ya tiene una cita de 16:10 a 16:55.",
    });
  });

  it("reports the permission message for a 42501 error", async () => {
    insertResult.data = null;
    insertResult.error = { code: "42501" };

    expect(
      await createAppointment(undefined, appointmentForm({ confirm: "1" })),
    ).toEqual({
      error: "No tienes permiso para dar citas a otro profesional.",
    });
    expect(appointmentsSelect).not.toHaveBeenCalled();
  });
});

describe("searchPatients", () => {
  beforeEach(() => {
    peopleResult.data = [];
    peopleResult.error = null;
    peopleSelect.mockClear();
  });

  it("returns an empty list for a blank query without touching the database", async () => {
    expect(await searchPatients("   ")).toEqual([]);
    expect(peopleSelect).not.toHaveBeenCalled();
  });

  it("throws when the search fails", async () => {
    peopleResult.error = { message: "boom" };
    await expect(searchPatients("nora")).rejects.toThrow(
      "No se ha podido buscar.",
    );
  });
});

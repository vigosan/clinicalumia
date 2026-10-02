import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const overlapNeqId = vi.fn(() => ({ limit: overlapLimit }));
const overlapGt = vi.fn(() => ({ limit: overlapLimit, neq: overlapNeqId }));
const overlapLt = vi.fn(() => ({ gt: overlapGt }));
const overlapNeq = vi.fn(() => ({ lt: overlapLt }));
const overlapEq = vi.fn(() => ({ neq: overlapNeq }));
const appointmentsSelect = vi.fn(() => ({ eq: overlapEq }));

const updateResult: {
  data: { id: string }[] | null;
  error: { code?: string; message?: string } | null;
} = { data: null, error: null };
const updateSelect = vi.fn(async () => updateResult);
const updateEq = vi.fn(() => ({ select: updateSelect }));
const appointmentsUpdate = vi.fn(() => ({ eq: updateEq }));

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

const notifyPatient = vi.fn(async () => true);
const loadAppointmentTimes = vi.fn(async () => ({
  starts_at: "2026-10-06T08:00:00+00:00",
  ends_at: "2026-10-06T09:00:00+00:00",
  professional_id: "prof-1",
  professional_name: "Marc Ejemplo",
}));
const loadNoticeRecipients = vi.fn(async (): Promise<string[]> => []);
vi.mock("@/lib/appointment-notice", () => ({
  notifyPatient,
  loadAppointmentTimes,
  loadNoticeRecipients,
}));

type ClosureRow = {
  id: string;
  startsOn: string;
  endsOn: string;
  reason: string;
};
const loadClosures = vi.fn(
  async (): Promise<ClosureRow[] | null> => [] as ClosureRow[],
);
vi.mock("@/lib/closures", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/closures")>()),
  loadClosures,
}));

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
        return {
          insert: appointmentsInsert,
          select: appointmentsSelect,
          update: appointmentsUpdate,
        };
      if (table === "people") return { select: peopleSelect };
      return {};
    },
  }),
}));

const {
  createAppointment,
  moveAppointment,
  cancelAppointment,
  canNotifyPatient,
  markNoShow,
  restoreFromNoShow,
  searchPatients,
} = await import("./actions");

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
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T08:00:00Z"));
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
    updateResult.data = [{ id: "appt-1" }];
    updateResult.error = null;
    appointmentsUpdate.mockClear();
    updateEq.mockClear();
    updateSelect.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("asks for confirmation before giving an appointment at a time that has already passed, because it would show up as done and pending payment", async () => {
    schedulesResult.data = [
      { weekday: 1, starts_at: "09:00:00", ends_at: "20:00:00" },
    ];

    expect(
      await createAppointment(
        undefined,
        appointmentForm({ date: "2026-09-28", time: "10:00" }),
      ),
    ).toEqual({ warnings: ["Esa hora ya ha pasado."] });
    expect(appointmentsInsert).not.toHaveBeenCalled();
  });

  it("gives the past appointment once the team confirms it, since recording a session that already happened is legitimate", async () => {
    await expect(
      createAppointment(
        undefined,
        appointmentForm({ date: "2026-09-28", time: "10:00", confirm: "1" }),
      ),
    ).rejects.toThrow("REDIRECT:/?date=2026-09-28&appointment=appt-1");
    expect(appointmentsInsert).toHaveBeenCalledTimes(1);
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

  it("emails the patient the confirmation after saving when «Avisar al paciente» is checked", async () => {
    notifyPatient.mockClear();

    await expect(
      createAppointment(
        undefined,
        appointmentForm({ confirm: "1", notify: "on" }),
      ),
    ).rejects.toThrow("REDIRECT:/?date=2026-10-05&appointment=appt-1");

    expect(notifyPatient).toHaveBeenCalledWith(expect.anything(), "appt-1", {
      kind: "confirmed",
    });
  });

  it("sends nothing when the box is unchecked, because the team may have told the patient in person", async () => {
    notifyPatient.mockClear();

    await expect(
      createAppointment(undefined, appointmentForm({ confirm: "1" })),
    ).rejects.toThrow("REDIRECT:/?date=2026-10-05&appointment=appt-1");

    expect(notifyPatient).not.toHaveBeenCalled();
  });

  it("keeps the new appointment and goes to it with a warning when the email fails, so the team knows to call the patient", async () => {
    notifyPatient.mockResolvedValueOnce(false);

    await expect(
      createAppointment(
        undefined,
        appointmentForm({ confirm: "1", notify: "on" }),
      ),
    ).rejects.toThrow(
      "REDIRECT:/?date=2026-10-05&appointment=appt-1&aviso=sin-avisar",
    );
    expect(appointmentsInsert).toHaveBeenCalledTimes(1);
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

  it("says the patient is already booked at that time instead of blaming the professional when the overlap is the patient's", async () => {
    insertResult.data = null;
    insertResult.error = {
      code: "23P01",
      message:
        'conflicting key value violates exclusion constraint "appointments_patient_no_overlap"',
    };

    expect(
      await createAppointment(undefined, appointmentForm({ confirm: "1" })),
    ).toEqual({ error: "Este paciente ya tiene una cita a esa hora." });
    expect(appointmentsSelect).not.toHaveBeenCalled();
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

  it("reports the professional is inactive when they are missing from staff_directory, without computing warnings", async () => {
    rpcResults.staff_directory = { data: [], error: null };

    expect(await createAppointment(undefined, appointmentForm())).toEqual({
      error: "Ese profesional no está activo.",
    });
    expect(schedulesSelect).not.toHaveBeenCalled();
    expect(appointmentsInsert).not.toHaveBeenCalled();
  });
});

function moveForm(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const defaults: Record<string, string> = {
    id: "appt-1",
    patient_id: "patient-1",
    service_id: "service-1",
    professional_id: "prof-1",
    date: "2026-10-06",
    time: "11:00",
    duration_minutes: "60",
    notes: "",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) {
    data.set(key, value);
  }
  return data;
}

describe("moveAppointment", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T08:00:00Z"));
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
    schedulesResult.data = [];
    schedulesResult.error = null;
    timeOffResult.data = [];
    timeOffResult.error = null;
    updateResult.data = [{ id: "appt-1" }];
    updateResult.error = null;
    appointmentsUpdate.mockClear();
    updateEq.mockClear();
    updateSelect.mockClear();
    overlapResult.data = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the parser's error for an invalid form without touching the database", async () => {
    expect(await moveAppointment(undefined, moveForm({ date: "" }))).toEqual({
      error: "Indica fecha y hora.",
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(appointmentsUpdate).not.toHaveBeenCalled();
  });

  it("rejects moving an appointment to a start that has already passed, without touching the database", async () => {
    expect(
      await moveAppointment(
        undefined,
        moveForm({ date: "2020-01-01", confirm: "1" }),
      ),
    ).toEqual({
      error: "No se puede pasar una cita a una hora que ya ha pasado.",
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(appointmentsUpdate).not.toHaveBeenCalled();
  });

  it("returns the schedule warnings without moving when confirm is missing", async () => {
    schedulesResult.data = [];

    expect(await moveAppointment(undefined, moveForm())).toEqual({
      warnings: ["Queda fuera del horario de Marc Ejemplo."],
    });
    expect(appointmentsUpdate).not.toHaveBeenCalled();
  });

  it("warns that the clinic is closed that day, with the reason, before moving the appointment there", async () => {
    schedulesResult.data = [
      { weekday: 2, starts_at: "09:00:00", ends_at: "20:00:00" },
    ];
    loadClosures.mockResolvedValueOnce([
      {
        id: "closure-1",
        startsOn: "2026-10-05",
        endsOn: "2026-10-07",
        reason: "Puente",
      },
    ]);

    expect(await moveAppointment(undefined, moveForm())).toEqual({
      warnings: ["La clínica está cerrada ese día (Puente)."],
    });
    expect(loadClosures).toHaveBeenLastCalledWith(
      expect.anything(),
      "2026-10-06",
      "2026-10-06",
    );
    expect(appointmentsUpdate).not.toHaveBeenCalled();
  });

  it("does not move the appointment when it cannot tell whether the clinic is closed that day", async () => {
    loadClosures.mockResolvedValueOnce(null);

    expect(await moveAppointment(undefined, moveForm())).toEqual({
      error: "No se ha podido guardar.",
    });
    expect(appointmentsUpdate).not.toHaveBeenCalled();
  });

  it("never hands the appointment to a professional who is not active", async () => {
    expect(
      await moveAppointment(
        undefined,
        moveForm({ professional_id: "prof-gone", confirm: "1" }),
      ),
    ).toEqual({ error: "Ese profesional no está activo." });
    expect(appointmentsUpdate).not.toHaveBeenCalled();
  });

  it("hands the appointment to the chosen active professional, so the appointments of one who left can be reassigned", async () => {
    rpcResults.staff_directory = {
      data: [
        {
          id: "prof-2",
          full_name: "Laura Ejemplo",
          role: "employee",
          specialty_id: "spec-1",
        },
      ],
      error: null,
    };

    await expect(
      moveAppointment(
        undefined,
        moveForm({ professional_id: "prof-2", confirm: "1" }),
      ),
    ).rejects.toThrow("REDIRECT:/?date=2026-10-06&appointment=appt-1");

    expect(appointmentsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ professional_id: "prof-2" }),
    );
  });

  it("tells the patient about a new professional even when the time stays the same", async () => {
    notifyPatient.mockClear();
    rpcResults.staff_directory = {
      data: [
        {
          id: "prof-2",
          full_name: "Laura Ejemplo",
          role: "employee",
          specialty_id: "spec-1",
        },
      ],
      error: null,
    };
    loadAppointmentTimes.mockResolvedValueOnce({
      starts_at: "2026-10-06T09:00:00.000Z",
      ends_at: "2026-10-06T10:00:00.000Z",
      professional_id: "prof-1",
      professional_name: "Marc Ejemplo",
    });

    await expect(
      moveAppointment(
        undefined,
        moveForm({ professional_id: "prof-2", confirm: "1", notify: "on" }),
      ),
    ).rejects.toThrow("REDIRECT:/?date=2026-10-06&appointment=appt-1");

    expect(notifyPatient).toHaveBeenCalledWith(expect.anything(), "appt-1", {
      kind: "changed",
      previousStartsAt: "2026-10-06T09:00:00.000Z",
      previousProfessionalName: "Marc Ejemplo",
    });
  });

  it("moves and redirects when the caller confirms", async () => {
    await expect(
      moveAppointment(undefined, moveForm({ confirm: "1" })),
    ).rejects.toThrow("REDIRECT:/?date=2026-10-06&appointment=appt-1");

    expect(appointmentsUpdate).toHaveBeenCalledWith({
      professional_id: "prof-1",
      starts_at: expect.any(String),
      ends_at: expect.any(String),
    });
    expect(updateEq).toHaveBeenCalledWith("id", "appt-1");
    expect(schedulesResult.data).toEqual([]);
  });

  it("emails the patient «Cita cambiada» with the previous time after moving when «Avisar al paciente» is checked", async () => {
    notifyPatient.mockClear();

    await expect(
      moveAppointment(undefined, moveForm({ confirm: "1", notify: "on" })),
    ).rejects.toThrow("REDIRECT:/?date=2026-10-06&appointment=appt-1");

    expect(loadAppointmentTimes).toHaveBeenCalledWith(
      expect.anything(),
      "appt-1",
    );
    expect(notifyPatient).toHaveBeenCalledWith(expect.anything(), "appt-1", {
      kind: "changed",
      previousStartsAt: "2026-10-06T08:00:00+00:00",
    });
  });

  it("sends nothing when the box is unchecked", async () => {
    notifyPatient.mockClear();

    await expect(
      moveAppointment(undefined, moveForm({ confirm: "1" })),
    ).rejects.toThrow("REDIRECT:/?date=2026-10-06&appointment=appt-1");

    expect(notifyPatient).not.toHaveBeenCalled();
  });

  it("sends nothing when the time did not actually change, so the patient never gets a change that is not one", async () => {
    notifyPatient.mockClear();
    loadAppointmentTimes.mockResolvedValueOnce({
      starts_at: "2026-10-06T09:00:00.000Z",
      ends_at: "2026-10-06T10:00:00.000Z",
      professional_id: "prof-1",
      professional_name: "Marc Ejemplo",
    });

    await expect(
      moveAppointment(undefined, moveForm({ confirm: "1", notify: "on" })),
    ).rejects.toThrow("REDIRECT:/?date=2026-10-06&appointment=appt-1");

    expect(notifyPatient).not.toHaveBeenCalled();
  });

  it("keeps the new time and warns when the email fails", async () => {
    notifyPatient.mockResolvedValueOnce(false);

    await expect(
      moveAppointment(undefined, moveForm({ confirm: "1", notify: "on" })),
    ).rejects.toThrow(
      "REDIRECT:/?date=2026-10-06&appointment=appt-1&aviso=sin-avisar",
    );
    expect(appointmentsUpdate).toHaveBeenCalledTimes(1);
  });

  it("names who and when for a 23P01 overlap, excluding the appointment being moved", async () => {
    updateResult.data = null;
    updateResult.error = { code: "23P01" };
    overlapResult.data = {
      starts_at: "2026-10-06T14:10:00.000Z",
      ends_at: "2026-10-06T14:55:00.000Z",
    };

    expect(
      await moveAppointment(undefined, moveForm({ confirm: "1" })),
    ).toEqual({
      error: "Marc Ejemplo ya tiene una cita de 16:10 a 16:55.",
    });
    expect(overlapNeqId).toHaveBeenCalledWith("id", "appt-1");
  });

  it("says the patient is already booked at that time when moving onto another of the patient's appointments", async () => {
    appointmentsSelect.mockClear();
    updateResult.data = null;
    updateResult.error = {
      code: "23P01",
      message:
        'conflicting key value violates exclusion constraint "appointments_patient_no_overlap"',
    };

    expect(
      await moveAppointment(undefined, moveForm({ confirm: "1" })),
    ).toEqual({ error: "Este paciente ya tiene una cita a esa hora." });
    expect(appointmentsSelect).not.toHaveBeenCalled();
  });

  it("maps a past-appointment error", async () => {
    updateResult.data = null;
    updateResult.error = { code: "23514", message: "appointment_in_past" };

    expect(
      await moveAppointment(undefined, moveForm({ confirm: "1" })),
    ).toEqual({
      error:
        "No se puede cambiar la fecha u hora de una cita que ya ha pasado.",
    });
  });

  it("reports it could not move the appointment when 0 rows matched", async () => {
    updateResult.data = [];
    updateResult.error = null;

    expect(
      await moveAppointment(undefined, moveForm({ confirm: "1" })),
    ).toEqual({ error: "No se ha podido cambiar la fecha u hora." });
  });
});

describe("cancelAppointment", () => {
  beforeEach(() => {
    updateResult.data = [{ id: "appt-1" }];
    updateResult.error = null;
    appointmentsUpdate.mockClear();
    updateEq.mockClear();
    updateSelect.mockClear();
    rpc.mockClear();
    delete rpcResults.cancel_appointment_with_rectification;
    delete rpcResults.is_owner;
  });

  it("refunds and cancels in one database call that finds the invoice itself, so the two can never get out of step", async () => {
    rpcResults.cancel_appointment_with_rectification = {
      data: "rect-1",
      error: null,
    };

    expect(
      await cancelAppointment(
        "appt-1",
        "patient",
        "No puede venir",
        false,
        true,
      ),
    ).toEqual({ ok: true, noticeFailed: false });
    expect(rpc).toHaveBeenCalledWith("cancel_appointment_with_rectification", {
      p_appointment_id: "appt-1",
      p_cancelled_by: "patient",
      p_reason: "No puede venir",
    });
    expect(appointmentsUpdate).not.toHaveBeenCalled();
  });

  it("emails the patient after refunding and cancelling when «Avisar al paciente» is checked", async () => {
    rpcResults.cancel_appointment_with_rectification = {
      data: "rect-1",
      error: null,
    };
    notifyPatient.mockClear();

    await cancelAppointment("appt-1", "clinic", "", true, true);

    expect(notifyPatient).toHaveBeenCalledWith(expect.anything(), "appt-1", {
      kind: "cancelled",
    });
  });

  it("explains who may refund when the database refuses the rectifying invoice", async () => {
    rpcResults.cancel_appointment_with_rectification = {
      data: null,
      error: { code: "P0001", message: "not_allowed" },
    };

    expect(
      await cancelAppointment("appt-1", "clinic", "", false, true),
    ).toEqual({
      error:
        "Solo puede anular este cobro quien lo registró hoy o la propietaria.",
    });
  });

  it("explains a refused cancellation with the appointment's own message, since nothing was refunded either", async () => {
    rpcResults.cancel_appointment_with_rectification = {
      data: null,
      error: { code: "23514", message: "appointment_invalid_transition" },
    };

    expect(
      await cancelAppointment("appt-1", "clinic", "", false, true),
    ).toEqual({
      error: "No se puede cancelar una cita marcada como no presentada.",
    });
  });

  it("issues no rectifying invoice when the team cancels without refunding", async () => {
    await cancelAppointment("appt-1", "clinic", "", false, false);

    expect(rpc).not.toHaveBeenCalledWith(
      "cancel_appointment_with_rectification",
      expect.anything(),
    );
    expect(appointmentsUpdate).toHaveBeenCalledTimes(1);
  });

  it("cancels with the reason and who cancelled", async () => {
    expect(
      await cancelAppointment("appt-1", "patient", "Se puso enfermo", false),
    ).toEqual({ ok: true, noticeFailed: false });
    expect(appointmentsUpdate).toHaveBeenCalledWith({
      status: "cancelled",
      cancelled_by: "patient",
      cancel_reason: "Se puso enfermo",
    });
    expect(updateEq).toHaveBeenCalledWith("id", "appt-1");
  });

  it("rejects a reason longer than 2000 characters, without touching the database", async () => {
    expect(
      await cancelAppointment("appt-1", "patient", "a".repeat(2001), false),
    ).toEqual({
      error: "El motivo no puede superar los 2000 caracteres.",
    });
    expect(appointmentsUpdate).not.toHaveBeenCalled();
  });

  it("reports it could not cancel when 0 rows matched", async () => {
    updateResult.data = [];

    expect(await cancelAppointment("appt-1", "clinic", "", false)).toEqual({
      error: "No se ha podido cancelar la cita.",
    });
  });

  it("maps an invalid-transition error", async () => {
    updateResult.data = null;
    updateResult.error = {
      code: "23514",
      message: "appointment_invalid_transition",
    };

    expect(await cancelAppointment("appt-1", "clinic", "", false)).toEqual({
      error: "No se puede cancelar una cita marcada como no presentada.",
    });
  });

  it("emails the patient the cancellation after saving it when «Avisar al paciente» is checked", async () => {
    notifyPatient.mockClear();

    expect(await cancelAppointment("appt-1", "clinic", "", true)).toEqual({
      ok: true,
      noticeFailed: false,
    });
    expect(notifyPatient).toHaveBeenCalledWith(expect.anything(), "appt-1", {
      kind: "cancelled",
    });
  });

  it("sends nothing when the box is unchecked", async () => {
    notifyPatient.mockClear();

    await cancelAppointment("appt-1", "clinic", "", false);

    expect(notifyPatient).not.toHaveBeenCalled();
  });

  it("keeps the cancellation and says the patient was not told when the email fails", async () => {
    notifyPatient.mockResolvedValueOnce(false);

    expect(await cancelAppointment("appt-1", "clinic", "", true)).toEqual({
      ok: true,
      noticeFailed: true,
    });
    expect(appointmentsUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("markNoShow", () => {
  beforeEach(() => {
    updateResult.data = [{ id: "appt-1" }];
    updateResult.error = null;
    appointmentsUpdate.mockClear();
    updateEq.mockClear();
    updateSelect.mockClear();
  });

  it("marks the appointment as no_show", async () => {
    expect(await markNoShow("appt-1")).toEqual({ ok: true });
    expect(appointmentsUpdate).toHaveBeenCalledWith({ status: "no_show" });
    expect(updateEq).toHaveBeenCalledWith("id", "appt-1");
  });

  it("reports it could not mark no-show when 0 rows matched", async () => {
    updateResult.data = [];

    expect(await markNoShow("appt-1")).toEqual({
      error: "No se ha podido marcar como no presentada.",
    });
  });

  it("maps a not-started error", async () => {
    updateResult.data = null;
    updateResult.error = { code: "23514", message: "appointment_not_started" };

    expect(await markNoShow("appt-1")).toEqual({
      error:
        "Solo se puede marcar como no presentada cuando la cita ya ha empezado.",
    });
  });
});

describe("restoreFromNoShow", () => {
  beforeEach(() => {
    updateResult.data = [{ id: "appt-1" }];
    updateResult.error = null;
    appointmentsUpdate.mockClear();
    updateEq.mockClear();
    updateSelect.mockClear();
  });

  it("restores the appointment to scheduled", async () => {
    expect(await restoreFromNoShow("appt-1")).toEqual({ ok: true });
    expect(appointmentsUpdate).toHaveBeenCalledWith({ status: "scheduled" });
    expect(updateEq).toHaveBeenCalledWith("id", "appt-1");
  });

  it("reports it could not restore when 0 rows matched", async () => {
    updateResult.data = [];

    expect(await restoreFromNoShow("appt-1")).toEqual({
      error: "No se ha podido restaurar la cita.",
    });
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

describe("canNotifyPatient", () => {
  it("offers to notify only a patient who, or whose guardian, has an email", async () => {
    loadNoticeRecipients.mockResolvedValueOnce(["madre@example.com"]);
    expect(await canNotifyPatient("patient-1")).toBe(true);

    loadNoticeRecipients.mockResolvedValueOnce([]);
    expect(await canNotifyPatient("patient-1")).toBe(false);
  });

  it("hides the box when it cannot tell who would get the email, instead of breaking Nueva cita", async () => {
    loadNoticeRecipients.mockRejectedValueOnce(new Error("boom"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(await canNotifyPatient("patient-1")).toBe(false);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const sendAppointmentNotice = vi.fn();
vi.mock("@clinicalumia/api/appointment-notice", () => ({
  sendAppointmentNotice,
}));

const {
  loadAppointmentTimes,
  loadNoticeRecipients,
  noticeRecipients,
  notifyPatient,
} = await import("./appointment-notice");

type Result = { data: unknown; error: { message: string } | null };

function query(result: Result) {
  const chain = {
    select: () => chain,
    eq: () => Object.assign(Promise.resolve(result), chain),
    single: async () => result,
    maybeSingle: async () => result,
  };
  return chain;
}

const rpc = vi.fn();

function client(
  tables: Record<string, Result>,
  recipients: Result = { data: [], error: null },
) {
  rpc.mockReset();
  rpc.mockResolvedValue(recipients);
  return {
    from: (table: string) =>
      query(tables[table] ?? { data: null, error: null }),
    rpc,
  } as unknown as Parameters<typeof notifyPatient>[0];
}

const appointmentRow = {
  id: "appt-1",
  starts_at: "2026-10-05T08:00:00+00:00",
  ends_at: "2026-10-05T08:45:00+00:00",
  updated_at: "2026-10-01T09:00:00+00:00",
  patient: { first_name: "Leo", last_name: "Martí" },
  service: { name: "Sesión de logopedia" },
  professional: { full_name: "Ana García" },
};

describe("noticeRecipients", () => {
  it("writes to the person when they have an email, like the reminders do", () => {
    expect(
      noticeRecipients({ email: "Marta@Example.com" }, [
        { email: "madre@example.com", archived_at: null },
      ]),
    ).toEqual(["marta@example.com"]);
  });

  it("writes to every guardian with an email when the person has none, so both parents of a minor hear about it", () => {
    expect(
      noticeRecipients({ email: null }, [
        { email: "Padre@example.com", archived_at: null },
        { email: "madre@example.com", archived_at: null },
        { email: null, archived_at: null },
        { email: "padre@example.com", archived_at: null },
      ]),
    ).toEqual(["madre@example.com", "padre@example.com"]);
  });

  it("leaves out archived guardians, since the clinic no longer deals with them", () => {
    expect(
      noticeRecipients({ email: null }, [
        { email: "antiguo@example.com", archived_at: "2026-09-01T00:00:00Z" },
      ]),
    ).toEqual([]);
  });
});

describe("loadNoticeRecipients", () => {
  it("reads the person and their guardians to decide who gets the email", async () => {
    const supabase = client({
      people: { data: { email: null }, error: null },
      guardianships: {
        data: [
          { guardian: { email: "madre@example.com", archived_at: null } },
          { guardian: null },
        ],
        error: null,
      },
    });

    expect(await loadNoticeRecipients(supabase, "person-1")).toEqual([
      "madre@example.com",
    ]);
  });
});

describe("loadAppointmentTimes", () => {
  it("reads when and with whom the appointment is before it changes, so the email can say the previous time and is sent when only the professional changes", async () => {
    const supabase = client({
      appointments: {
        data: {
          starts_at: "a",
          ends_at: "b",
          professional_id: "prof-1",
          professional: { full_name: "Marc Ejemplo" },
        },
        error: null,
      },
    });

    expect(await loadAppointmentTimes(supabase, "appt-1")).toEqual({
      starts_at: "a",
      ends_at: "b",
      professional_id: "prof-1",
      professional_name: "Marc Ejemplo",
    });
  });

  it("gives nothing when the appointment cannot be read, so the change still goes ahead", async () => {
    const supabase = client({
      appointments: { data: null, error: { message: "boom" } },
    });

    expect(await loadAppointmentTimes(supabase, "appt-1")).toBeNull();
  });
});

describe("notifyPatient", () => {
  beforeEach(() => {
    sendAppointmentNotice.mockReset();
    sendAppointmentNotice.mockResolvedValue(undefined);
  });

  it("sends the notice with the appointment as it is now to whoever the reminders would write to, so a web booking hears from the account that made it", async () => {
    const supabase = client(
      { appointments: { data: appointmentRow, error: null } },
      { data: ["cuenta@example.com"], error: null },
    );

    expect(await notifyPatient(supabase, "appt-1", { kind: "cancelled" })).toBe(
      true,
    );
    expect(rpc).toHaveBeenCalledWith("appointment_notice_recipients", {
      p_appointment_id: "appt-1",
    });
    expect(sendAppointmentNotice).toHaveBeenCalledWith({
      recipients: ["cuenta@example.com"],
      notice: { kind: "cancelled" },
      appointment: {
        id: "appt-1",
        startsAt: appointmentRow.starts_at,
        endsAt: appointmentRow.ends_at,
        updatedAt: appointmentRow.updated_at,
        serviceName: "Sesión de logopedia",
        professionalName: "Ana García",
        personName: "Leo Martí",
      },
    });
  });

  it("reports the failure instead of throwing when the email cannot be sent, because the appointment is already saved", async () => {
    sendAppointmentNotice.mockRejectedValue(new Error("Resend caído"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const supabase = client(
      { appointments: { data: appointmentRow, error: null } },
      { data: ["leo@example.com"], error: null },
    );

    expect(await notifyPatient(supabase, "appt-1", { kind: "confirmed" })).toBe(
      false,
    );
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("reports the failure when the appointment cannot be read", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const supabase = client({
      appointments: { data: null, error: { message: "boom" } },
    });

    expect(await notifyPatient(supabase, "appt-1", { kind: "confirmed" })).toBe(
      false,
    );
    expect(sendAppointmentNotice).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("reports the failure when the recipients cannot be read, so the team knows the patient was not told", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const supabase = client(
      { appointments: { data: appointmentRow, error: null } },
      { data: null, error: { message: "appointment_not_found" } },
    );

    expect(await notifyPatient(supabase, "appt-1", { kind: "confirmed" })).toBe(
      false,
    );
    expect(sendAppointmentNotice).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

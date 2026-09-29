import { madridInstant } from "@clinicalumia/api/madrid-time";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn();
vi.mock("@clinicalumia/api/email", () => ({ sendEmail }));

const { patientIcs, reminderEmail, sendDailyReminders } = await import(
  "./reminders"
);
const { site } = await import("./site");

type Candidate = Parameters<typeof reminderEmail>[0];
type Row = Record<string, unknown>;

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    appointment_id: "11111111-1111-4111-8111-111111111111",
    starts_at: madridInstant("2026-10-06", "09:00"),
    ends_at: madridInstant("2026-10-06", "09:45"),
    person_name: "Lucía Pérez",
    service_name: "Sesión de logopedia",
    professional_name: "Ana García",
    change_deadline: madridInstant("2026-10-03", "09:00"),
    can_change: false,
    recipients: ["lucia@example.com"],
    ...overrides,
  };
}

let candidates: Candidate[];
let reminders: Row[];
const rpc = vi.fn();

function matches(row: Row, conditions: ((row: Row) => boolean)[]) {
  return conditions.every((condition) => condition(row));
}

function fakeAdmin() {
  return {
    rpc: async (name: string, args: Row) => {
      rpc(name, args);
      return { data: candidates, error: null };
    },
    from: (table: string) => {
      expect(table).toBe("appointment_reminders");
      const filters: [string, unknown][] = [];
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return query;
        },
        limit: async (count: number) => ({
          data: reminders
            .filter((row) =>
              filters.every(([column, value]) => row[column] === value),
            )
            .slice(0, count),
          error: null,
        }),
        insert: (row: Row) => {
          const taken = reminders.some(
            (other) =>
              other.appointment_id === row.appointment_id &&
              other.channel === row.channel &&
              other.status !== "failed",
          );
          const id = `r${reminders.length + 1}`;
          if (!taken) reminders.push({ id, ...row });
          const result = taken
            ? { data: null, error: { code: "23505", message: "duplicate" } }
            : { data: { id }, error: null };
          return { select: () => ({ single: async () => result }) };
        },
        update: (values: Row) => {
          const conditions: ((row: Row) => boolean)[] = [];
          const apply = async (column: string, value: unknown) => {
            conditions.push((row) => row[column] === value);
            for (const row of reminders.filter((row) =>
              matches(row, conditions),
            )) {
              Object.assign(row, values);
            }
            return { error: null };
          };
          return {
            eq: apply,
            lt: (column: string, value: string) => {
              conditions.push((row) => String(row[column]) < value);
              return { eq: apply };
            },
          };
        },
      };
      return query;
    },
  } as unknown as Parameters<typeof sendDailyReminders>[0]["admin"];
}

function logged() {
  return reminders.map(({ id: _id, ...row }) => row);
}

const now = new Date("2026-10-05T06:00:00Z");

beforeEach(() => {
  candidates = [];
  reminders = [];
  rpc.mockReset();
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(undefined);
});

describe("reminderEmail", () => {
  it("tells who the appointment is for, when, with whom, where and until when it can be changed, so the patient needs nothing else to show up", () => {
    const email = reminderEmail(
      candidate({
        can_change: true,
        change_deadline: madridInstant("2026-10-05", "18:00"),
      }),
    );

    expect(email.subject).toBe("Recordatorio de tu cita");
    expect(email.html).toContain(
      "Te recordamos la cita de Lucía Pérez mañana, martes, 6 de octubre a las 09:00",
    );
    expect(email.html).toContain("Sesión de logopedia");
    expect(email.html).toContain("Ana García");
    expect(email.html).toContain("Calle Montesa 7, 46800 Xàtiva");
    expect(email.html).toContain(
      "Puedes cambiarla o cancelarla hasta el lunes 5 a las 18:00",
    );
    expect(email.html).toContain(
      `<a href="${site.url}/mi-cuenta">Ver Mi cuenta</a>`,
    );
  });

  it("tells the patient to call when the change window has already closed, so nobody tries to cancel online the day before", () => {
    const email = reminderEmail(candidate({ can_change: false }));

    expect(email.html).toContain(
      `Fuera de plazo: llama al ${site.phone.display}`,
    );
  });

  it("escapes names typed by patients and staff, so nobody can inject markup into a clinic email", () => {
    const email = reminderEmail(
      candidate({
        person_name: "<script>alert(1)</script>",
        service_name: "Voz & habla",
        professional_name: 'Ana "La" García',
      }),
    );

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(email.html).toContain("Voz &amp; habla");
    expect(email.html).toContain("Ana &quot;La&quot; García");
  });
});

describe("patientIcs", () => {
  it("identifies the event by the appointment, so importing a later reminder updates the same calendar entry instead of duplicating it", () => {
    const ics = patientIcs(candidate(), now);

    expect(ics).toContain(
      "UID:11111111-1111-4111-8111-111111111111@clinicalumia.es",
    );
    expect(ics).toContain("DTSTART:20261006T070000Z");
    expect(ics).toContain("DTEND:20261006T074500Z");
    expect(ics).toContain(
      "SUMMARY:Cita en Clínica LUMIA · Sesión de logopedia",
    );
    expect(ics).toContain("LOCATION:Calle Montesa 7\\, 46800 Xàtiva");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
});

describe("sendDailyReminders", () => {
  it("asks for tomorrow in Madrid, so a run just after midnight in Spain still reminds the next day's patients", async () => {
    await sendDailyReminders({
      admin: fakeAdmin(),
      now: new Date("2026-10-24T22:30:00Z"),
    });

    expect(rpc).toHaveBeenCalledWith("reminder_candidates", {
      p_day: "2026-10-26",
    });
  });

  it("sends a single email with the calendar file to all recipients of an appointment and marks its claim as sent, so guardians are reminded once and a second run skips it", async () => {
    candidates = [
      candidate({ recipients: ["madre@example.com", "padre@example.com"] }),
    ];

    const result = await sendDailyReminders({ admin: fakeAdmin(), now });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = sendEmail.mock.calls[0]?.[0];
    expect(email.to).toEqual(["madre@example.com", "padre@example.com"]);
    expect(email.subject).toBe("Recordatorio de tu cita");
    expect(email.attachments).toEqual([
      {
        filename: "cita.ics",
        content: expect.stringContaining(
          "UID:11111111-1111-4111-8111-111111111111@clinicalumia.es",
        ),
        contentType: "text/calendar",
      },
    ]);
    expect(logged()).toEqual([
      {
        appointment_id: "11111111-1111-4111-8111-111111111111",
        channel: "email",
        recipient: "madre@example.com, padre@example.com",
        status: "sent",
        sent_at: now.toISOString(),
      },
    ]);
    expect(result).toEqual({ sent: 1, failed: 0, skipped: 0 });
  });

  it("claims the reminder as pending before sending it, so a run that overlaps with this one finds it taken instead of emailing the patient again", async () => {
    candidates = [candidate()];
    const atSend: Row[][] = [];
    sendEmail.mockImplementation(async () => {
      atSend.push(logged().map((row) => ({ ...row })));
    });

    await sendDailyReminders({ admin: fakeAdmin(), now });

    expect(atSend).toEqual([
      [
        {
          appointment_id: "11111111-1111-4111-8111-111111111111",
          channel: "email",
          recipient: "lucia@example.com",
          status: "pending",
        },
      ],
    ]);
  });

  it("skips an appointment another run has already claimed, without emailing it, so two overlapping runs never send the same reminder twice", async () => {
    candidates = [candidate()];
    reminders = [
      {
        id: "otra",
        appointment_id: "11111111-1111-4111-8111-111111111111",
        channel: "email",
        recipient: "lucia@example.com",
        status: "pending",
      },
    ];

    const result = await sendDailyReminders({ admin: fakeAdmin(), now });

    expect(sendEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, failed: 0, skipped: 1 });
  });

  it("releases claims left pending for over an hour before claiming again, so a run that crashed mid-send does not block the reminder forever", async () => {
    candidates = [candidate()];
    reminders = [
      {
        id: "colgada",
        appointment_id: "11111111-1111-4111-8111-111111111111",
        channel: "email",
        recipient: "lucia@example.com",
        status: "pending",
        created_at: "2026-10-05T04:59:00.000Z",
      },
      {
        id: "reciente",
        appointment_id: "22222222-2222-4222-8222-222222222222",
        channel: "email",
        recipient: "otra@example.com",
        status: "pending",
        created_at: "2026-10-05T05:30:00.000Z",
      },
    ];

    const result = await sendDailyReminders({ admin: fakeAdmin(), now });

    expect(reminders.find((row) => row.id === "colgada")?.status).toBe(
      "failed",
    );
    expect(reminders.find((row) => row.id === "reciente")?.status).toBe(
      "pending",
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ sent: 1, failed: 0, skipped: 0 });
  });

  it("logs a failed send and keeps reminding the other patients, so one bad address never leaves the rest of the day without reminders and the failure is retried next run", async () => {
    candidates = [
      candidate({
        appointment_id: "a-falla",
        recipients: ["rebota@example.com"],
      }),
      candidate({ appointment_id: "a-bien", recipients: ["bien@example.com"] }),
    ];
    sendEmail.mockRejectedValueOnce(new Error("buzón inexistente"));

    const result = await sendDailyReminders({ admin: fakeAdmin(), now });

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(logged()).toEqual([
      {
        appointment_id: "a-falla",
        channel: "email",
        recipient: "rebota@example.com",
        status: "failed",
        error: "buzón inexistente",
      },
      {
        appointment_id: "a-bien",
        channel: "email",
        recipient: "bien@example.com",
        status: "sent",
        sent_at: now.toISOString(),
      },
    ]);
    expect(result).toEqual({ sent: 1, failed: 1, skipped: 0 });
  });

  it("logs an appointment nobody can be emailed about as failed without sending anything, and only once, so the team can see it without the log filling up", async () => {
    candidates = [candidate({ appointment_id: "a-sin", recipients: [] })];

    const first = await sendDailyReminders({ admin: fakeAdmin(), now });
    const second = await sendDailyReminders({ admin: fakeAdmin(), now });

    expect(sendEmail).not.toHaveBeenCalled();
    expect(logged()).toEqual([
      {
        appointment_id: "a-sin",
        channel: "email",
        recipient: "",
        status: "failed",
        error: "sin_email",
      },
    ]);
    expect(first).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(second).toEqual({ sent: 0, failed: 0, skipped: 1 });
  });
});

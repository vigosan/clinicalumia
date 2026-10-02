import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { madridInstant } from "./madrid-time";

const sendEmail = vi.fn();
vi.mock("./email", () => ({
  sendEmail,
  emailSender: () => ({
    name: "Clínica LUMIA",
    email: "no-responder@notifications.clinicalumia.es",
  }),
}));

const { appointmentIcs, appointmentNoticeEmail, sendAppointmentNotice } =
  await import("./appointment-notice");

const appointment = {
  id: "77777777-7777-7777-7777-777777777777",
  startsAt: madridInstant("2026-10-02", "09:30"),
  endsAt: madridInstant("2026-10-02", "10:15"),
  updatedAt: "2026-09-30T10:00:05.123456+00:00",
  serviceName: "Sesión de logopedia",
  professionalName: "Ana García",
  personName: "Lucía Pérez",
};
const now = new Date("2026-10-01T08:00:00Z");
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.clinicalumia.es";

const recipient = "lucia@example.com";

function attachedIcs(
  email: ReturnType<typeof appointmentNoticeEmail>,
  method: "REQUEST" | "CANCEL",
) {
  expect(email.attachments).toHaveLength(1);
  const [attachment] = email.attachments;
  expect(attachment?.filename).toBe("cita.ics");
  expect(attachment?.contentType).toBe(`text/calendar; method=${method}`);
  return String(attachment?.content);
}

describe("appointmentNoticeEmail", () => {
  it("confirms a new appointment with when, what, with whom and for whom, so the patient can check it without opening the web", () => {
    const email = appointmentNoticeEmail(
      { kind: "confirmed" },
      appointment,
      now,
      recipient,
    );

    expect(email.subject).toBe("Cita confirmada");
    expect(email.html).toContain("Viernes, 2 de octubre a las 09:30");
    expect(email.html).toContain("Sesión de logopedia");
    expect(email.html).toContain("Ana García");
    expect(email.html).toContain("Lucía Pérez");
    expect(email.html).toContain(
      `Puedes verla o cambiarla en <a href="${siteUrl}/mi-cuenta">Mi cuenta</a>.`,
    );
  });

  it("tells where the clinic is and its phone in the confirmation, so the patient does not have to look them up", () => {
    const email = appointmentNoticeEmail(
      { kind: "confirmed" },
      appointment,
      now,
      recipient,
    );

    expect(email.html).toContain(
      "<strong>Dónde:</strong> Calle Montesa 7, 46800 Xàtiva",
    );
    expect(email.html).toContain("<strong>Teléfono:</strong> 614 552 808");
  });

  it("says until when the appointment can be changed or cancelled, so the patient knows before the deadline passes", () => {
    const email = appointmentNoticeEmail(
      { kind: "confirmed" },
      {
        ...appointment,
        changeWindow:
          "Puedes cambiarla o cancelarla hasta el jueves 1 a las 09:30",
      },
      now,
      recipient,
    );

    expect(email.html).toContain(
      "<p>Puedes cambiarla o cancelarla hasta el jueves 1 a las 09:30</p>",
    );
  });

  it("says «Cita cambiada» with the previous and the new time, so a moved appointment never looks like a second one", () => {
    const email = appointmentNoticeEmail(
      {
        kind: "changed",
        previousStartsAt: madridInstant("2026-10-01", "16:15"),
      },
      appointment,
      now,
      recipient,
    );

    expect(email.subject).toBe("Cita cambiada");
    expect(email.html).toContain(
      "<strong>Ahora:</strong> Viernes, 2 de octubre a las 09:30",
    );
    expect(email.html).toContain(
      "<strong>Antes:</strong> Jueves, 1 de octubre a las 16:15",
    );
    expect(email.html).toContain(
      `<a href="${siteUrl}/mi-cuenta">Ver Mi cuenta</a>`,
    );
  });

  it("names the previous and the new professional when the appointment was handed to someone else, so the patient sees what changed even if the time did not", () => {
    const email = appointmentNoticeEmail(
      {
        kind: "changed",
        previousStartsAt: appointment.startsAt,
        previousProfessionalName: "Laura <Ejemplo>",
      },
      appointment,
      now,
      recipient,
    );

    expect(email.html).toContain(
      "<strong>Ahora:</strong> Viernes, 2 de octubre a las 09:30 con Ana García",
    );
    expect(email.html).toContain(
      "<strong>Antes:</strong> Viernes, 2 de octubre a las 09:30 con Laura &lt;Ejemplo&gt;",
    );
  });

  it("says «Cita cancelada» with the appointment that will not happen", () => {
    const email = appointmentNoticeEmail(
      { kind: "cancelled" },
      appointment,
      now,
      recipient,
    );

    expect(email.subject).toBe("Cita cancelada");
    expect(email.html).toContain("Viernes, 2 de octubre a las 09:30");
    expect(email.html).toContain(
      `<a href="${siteUrl}/mi-cuenta">Ver Mi cuenta</a>`,
    );
  });

  it("escapes names typed by patients so they cannot inject markup into the email", () => {
    const email = appointmentNoticeEmail(
      { kind: "confirmed" },
      { ...appointment, personName: "<b>Lucía</b>" },
      now,
      recipient,
    );

    expect(email.html).toContain("&lt;b&gt;Lucía&lt;/b&gt;");
    expect(email.html).not.toContain("<b>Lucía</b>");
  });

  it("attaches an event the calendar updates in place, numbered by the last change, for a confirmed or changed appointment", () => {
    for (const notice of [
      { kind: "confirmed" as const },
      { kind: "changed" as const, previousStartsAt: appointment.startsAt },
    ]) {
      const ics = attachedIcs(
        appointmentNoticeEmail(notice, appointment, now, recipient),
        "REQUEST",
      );

      expect(ics).toContain("METHOD:REQUEST\r\n");
      expect(ics).toContain(`UID:${appointment.id}@clinicalumia.es\r\n`);
      expect(ics).toContain("SEQUENCE:1790762405\r\n");
      expect(ics).toContain("STATUS:CONFIRMED\r\n");
    }
  });

  it("attaches a cancellation of the same event, so it disappears from the patient's calendar", () => {
    const ics = attachedIcs(
      appointmentNoticeEmail(
        { kind: "cancelled" },
        { ...appointment, updatedAt: "2026-09-30T11:00:00+00:00" },
        now,
        recipient,
      ),
      "CANCEL",
    );

    expect(ics).toContain("METHOD:CANCEL\r\n");
    expect(ics).toContain(`UID:${appointment.id}@clinicalumia.es\r\n`);
    expect(ics).toContain("SEQUENCE:1790766000\r\n");
    expect(ics).toContain("STATUS:CANCELLED\r\n");
  });

  it("addresses the attached event from the clinic to this recipient, so the calendar trusts the update or cancellation and applies it", () => {
    const ics = attachedIcs(
      appointmentNoticeEmail(
        { kind: "cancelled" },
        appointment,
        now,
        recipient,
      ),
      "CANCEL",
    );

    expect(ics).toContain(
      'ORGANIZER;CN="Clínica LUMIA":mailto:no-responder@notifications.clinicalumi',
    );
    expect(ics).toContain(
      "ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:lucia@ex",
    );
  });
});

describe("appointmentIcs", () => {
  it("builds one event with the appointment's own time, identity and place, so a calendar app can add it", () => {
    const ics = appointmentIcs({
      id: "11111111-1111-4111-8111-111111111111",
      startsAt: "2026-10-06T07:00:00+00:00",
      endsAt: "2026-10-06T07:45:00+00:00",
      serviceName: "Sesión de logopedia",
      now: new Date("2026-10-05T06:00:00Z"),
    });

    expect(ics).toContain("METHOD:PUBLISH\r\n");
    expect(ics).toContain(
      "UID:11111111-1111-4111-8111-111111111111@clinicalumia.es",
    );
    expect(ics).toContain("DTSTAMP:20261005T060000Z");
    expect(ics).toContain("DTSTART:20261006T070000Z");
    expect(ics).toContain("DTEND:20261006T074500Z");
    expect(ics).toContain(
      "SUMMARY:Cita en Clínica LUMIA · Sesión de logopedia",
    );
    expect(ics).toContain("LOCATION:Calle Montesa 7\\, 46800 Xàtiva");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it("stamps the moment it was built, not the appointment's time, so a reminder sent later still shows when it was actually generated", () => {
    const base = {
      id: "id",
      startsAt: "2026-10-06T07:00:00+00:00",
      endsAt: "2026-10-06T07:45:00+00:00",
      serviceName: "Sesión de logopedia",
    };

    expect(
      appointmentIcs({ ...base, now: new Date("2026-10-01T09:15:00Z") }),
    ).toContain("DTSTAMP:20261001T091500Z");
    expect(
      appointmentIcs({ ...base, now: new Date("2026-10-05T06:00:00Z") }),
    ).toContain("DTSTAMP:20261005T060000Z");
  });

  it("numbers the event by its last change when known, so a download after a change replaces the older copy", () => {
    const ics = appointmentIcs({
      id: "id",
      startsAt: "2026-10-06T07:00:00+00:00",
      endsAt: "2026-10-06T07:45:00+00:00",
      serviceName: "Sesión de logopedia",
      now: new Date("2026-10-05T06:00:00Z"),
      updatedAt: "2026-09-30T11:00:00+00:00",
    });

    expect(ics).toContain("SEQUENCE:1790766000\r\n");
  });

  it("leaves out organizer and attendee in a file the patient downloads, since it is a copy and not an invitation", () => {
    const ics = appointmentIcs({
      id: "id",
      startsAt: "2026-10-06T07:00:00+00:00",
      endsAt: "2026-10-06T07:45:00+00:00",
      serviceName: "Sesión de logopedia",
      now: new Date("2026-10-05T06:00:00Z"),
    });

    expect(ics).not.toContain("ORGANIZER");
    expect(ics).not.toContain("ATTENDEE");
  });

  it("escapes a comma in the service name, so punctuation in what the patient booked cannot break the calendar file", () => {
    const ics = appointmentIcs({
      id: "id",
      startsAt: "2026-10-06T07:00:00+00:00",
      endsAt: "2026-10-06T07:45:00+00:00",
      serviceName: "Voz, habla y lenguaje",
      now: new Date("2026-10-05T06:00:00Z"),
    });

    expect(ics).toContain(
      "SUMMARY:Cita en Clínica LUMIA · Voz\\, habla y lenguaje",
    );
  });
});

describe("sendAppointmentNotice", () => {
  beforeEach(() => {
    sendEmail.mockReset();
    sendEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends one email per recipient, so two guardians never see each other's address", async () => {
    await sendAppointmentNotice({
      recipients: ["madre@example.com", "padre@example.com"],
      notice: { kind: "confirmed" },
      appointment,
      now,
    });

    expect(sendEmail.mock.calls.map(([email]) => email.to)).toEqual([
      "madre@example.com",
      "padre@example.com",
    ]);
    for (const [email] of sendEmail.mock.calls) {
      expect(email.subject).toBe("Cita confirmada");
      expect(email.attachments[0].filename).toBe("cita.ics");
    }
  });

  it("still tries every recipient when one fails, and then reports the failure so the caller can warn the team", async () => {
    sendEmail.mockRejectedValueOnce(new Error("buzón inexistente"));

    await expect(
      sendAppointmentNotice({
        recipients: ["madre@example.com", "padre@example.com"],
        notice: { kind: "cancelled" },
        appointment,
        now,
      }),
    ).rejects.toThrow("buzón inexistente");
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("invites each recipient by their own address, so every guardian's calendar recognises the event as theirs", async () => {
    await sendAppointmentNotice({
      recipients: ["madre@example.com", "padre@example.com"],
      notice: { kind: "confirmed" },
      appointment,
      now,
    });

    const invites = sendEmail.mock.calls.map(([email]) =>
      String(email.attachments[0].content).replace(/\r\n /g, ""),
    );
    expect(invites[0]).toContain("mailto:madre@example.com");
    expect(invites[0]).not.toContain("padre@example.com");
    expect(invites[1]).toContain("mailto:padre@example.com");
    expect(invites[1]).not.toContain("madre@example.com");
  });

  it("writes to every recipient at once, so one slow mailbox does not delay the others", async () => {
    sendEmail.mockReturnValue(new Promise(() => {}));
    vi.useFakeTimers();

    const sending = sendAppointmentNotice({
      recipients: ["madre@example.com", "padre@example.com"],
      notice: { kind: "confirmed" },
      appointment,
      now,
    });
    sending.catch(() => {});
    await vi.advanceTimersByTimeAsync(0);

    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("gives up when sending never finishes, so the team's action completes and is told the patient was not notified", async () => {
    sendEmail.mockReturnValue(new Promise(() => {}));
    vi.useFakeTimers();

    const sending = sendAppointmentNotice({
      recipients: ["madre@example.com"],
      notice: { kind: "changed", previousStartsAt: appointment.startsAt },
      appointment,
      now,
    });
    const outcome = expect(sending).rejects.toThrow("ha tardado demasiado");
    await vi.advanceTimersByTimeAsync(12_000);

    await outcome;
  });
});

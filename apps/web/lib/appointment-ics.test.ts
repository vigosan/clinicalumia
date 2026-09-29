import { describe, expect, it } from "vitest";
import { appointmentIcs } from "./appointment-ics";

describe("appointmentIcs", () => {
  it("builds one event with the appointment's own time, identity and place, so a calendar app can add it and later update the same entry", () => {
    const ics = appointmentIcs({
      id: "11111111-1111-4111-8111-111111111111",
      startsAt: "2026-10-06T07:00:00+00:00",
      endsAt: "2026-10-06T07:45:00+00:00",
      serviceName: "Sesión de logopedia",
      now: new Date("2026-10-05T06:00:00Z"),
    });

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
    const first = appointmentIcs({
      id: "id",
      startsAt: "2026-10-06T07:00:00+00:00",
      endsAt: "2026-10-06T07:45:00+00:00",
      serviceName: "Sesión de logopedia",
      now: new Date("2026-10-01T09:15:00Z"),
    });
    const later = appointmentIcs({
      id: "id",
      startsAt: "2026-10-06T07:00:00+00:00",
      endsAt: "2026-10-06T07:45:00+00:00",
      serviceName: "Sesión de logopedia",
      now: new Date("2026-10-05T06:00:00Z"),
    });

    expect(first).toContain("DTSTAMP:20261001T091500Z");
    expect(later).toContain("DTSTAMP:20261005T060000Z");
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

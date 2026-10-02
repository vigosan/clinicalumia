import { describe, expect, it } from "vitest";
import { type IcsEvent, icsCalendar } from "./ics";
import { madridInstant } from "./madrid-time";

const baseEvent: IcsEvent = {
  uid: "11111111-1111-1111-1111-111111111111@clinicalumia.es",
  startsAt: "2026-03-10T10:00:00+01:00",
  endsAt: "2026-03-10T10:30:00+01:00",
  stamp: "2026-03-01T09:00:00Z",
  summary: "Cita",
};

describe("icsCalendar", () => {
  it("renders the VCALENDAR header and a VEVENT block with every field", () => {
    const ics = icsCalendar({
      name: "Equipo LUMIA",
      events: [
        {
          uid: "22222222-2222-2222-2222-222222222222@clinicalumia.es",
          startsAt: "2026-03-10T10:00:00+01:00",
          endsAt: "2026-03-10T10:30:00+01:00",
          stamp: "2026-03-01T09:00:00Z",
          summary: "Ana López · Logopedia",
          location: "Calle Montesa 7, 46800 Xàtiva, Valencia",
          description: "Primera visita",
        },
      ],
    });

    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0\r\n");
    expect(ics).toContain("PRODID:-//Clinica LUMIA//Agenda//ES\r\n");
    expect(ics).toContain("CALSCALE:GREGORIAN\r\n");
    expect(ics).toContain("METHOD:PUBLISH\r\n");
    expect(ics).toContain("X-WR-CALNAME:Equipo LUMIA\r\n");
    expect(ics).toContain("X-WR-TIMEZONE:Europe/Madrid\r\n");
    expect(ics).toContain("BEGIN:VEVENT\r\n");
    expect(ics).toContain(
      "UID:22222222-2222-2222-2222-222222222222@clinicalumia.es\r\n",
    );
    expect(ics).toContain("DTSTAMP:20260301T090000Z\r\n");
    expect(ics).toContain("DTSTART:20260310T090000Z\r\n");
    expect(ics).toContain("DTEND:20260310T093000Z\r\n");
    expect(ics).toContain("SUMMARY:Ana López · Logopedia\r\n");
    expect(ics).toContain(
      "LOCATION:Calle Montesa 7\\, 46800 Xàtiva\\, Valencia\r\n",
    );
    expect(ics).toContain("DESCRIPTION:Primera visita\r\n");
    expect(ics).toContain("STATUS:CONFIRMED\r\n");
    expect(ics).toContain("END:VEVENT\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("escapes commas, semicolons and line breaks so the name never breaks the calendar", () => {
    const ics = icsCalendar({
      name: "Equipo LUMIA",
      events: [{ ...baseEvent, summary: "López, Ana; nota\nurgente" }],
    });

    expect(ics).toContain("SUMMARY:López\\, Ana\\; nota\\nurgente\r\n");
  });

  it("folds a 200-character line with ñ and accents at 75 UTF-8 octets without splitting a character", () => {
    const longSummary = (
      "Reunión con la señora Muñoz sobre logopedia miofuncional " +
      "ñ".repeat(200)
    ).slice(0, 200);
    const ics = icsCalendar({
      name: "Equipo LUMIA",
      events: [{ ...baseEvent, summary: longSummary }],
    });

    const lines = ics.split("\r\n");
    const start = lines.findIndex((line) => line.startsWith("SUMMARY:"));
    const summaryLines = [(lines[start] ?? "").slice("SUMMARY:".length)];
    let index = start + 1;
    while (lines[index]?.startsWith(" ")) {
      summaryLines.push((lines[index] ?? "").slice(1));
      index++;
    }

    expect(summaryLines.length).toBeGreaterThan(1);
    expect(summaryLines.join("")).toBe(longSummary);
    const encoder = new TextEncoder();
    for (const line of lines.slice(start, index)) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it("folds a line full of emoji without splitting one in half, so a patient name with an emoji never corrupts the calendar", () => {
    const longSummary = `Sesión 😀 ${"🦷".repeat(40)} fin`;
    const ics = icsCalendar({
      name: "Equipo LUMIA",
      events: [{ ...baseEvent, summary: longSummary }],
    });

    const lines = ics.split("\r\n");
    const start = lines.findIndex((line) => line.startsWith("SUMMARY:"));
    let index = start + 1;
    while (lines[index]?.startsWith(" ")) index++;
    const folded = lines.slice(start, index);

    expect(folded.length).toBeGreaterThan(1);
    expect(
      folded
        .map((line, position) => (position === 0 ? line : line.slice(1)))
        .join("")
        .slice("SUMMARY:".length),
    ).toBe(longSummary);
    const encoder = new TextEncoder();
    for (const line of folded) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
      expect(line).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
      expect(line).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    }
  });

  it("resolves DTSTART to the correct UTC instant across the spring DST change", () => {
    const startsAt = madridInstant("2026-03-29", "10:00");
    const ics = icsCalendar({
      name: "Equipo LUMIA",
      events: [{ ...baseEvent, startsAt, endsAt: startsAt }],
    });

    expect(ics).toContain("DTSTART:20260329T080000Z\r\n");
  });

  it("resolves DTSTART to the correct UTC instant across the autumn DST change", () => {
    const startsAt = madridInstant("2026-10-25", "10:00");
    const ics = icsCalendar({
      name: "Equipo LUMIA",
      events: [{ ...baseEvent, startsAt, endsAt: startsAt }],
    });

    expect(ics).toContain("DTSTART:20261025T090000Z\r\n");
  });

  it("asks the calendar to update the existing event, with a higher SEQUENCE, so a changed appointment replaces the old one instead of adding a second", () => {
    const ics = icsCalendar({
      name: "Clínica LUMIA",
      method: "REQUEST",
      events: [{ ...baseEvent, sequence: 1791000000 }],
    });

    expect(ics).toContain("METHOD:REQUEST\r\n");
    expect(ics).toContain("SEQUENCE:1791000000\r\n");
    expect(ics).toContain("STATUS:CONFIRMED\r\n");
    expect(ics).not.toContain("METHOD:PUBLISH");
  });

  it("cancels the same event, so the patient's calendar removes an appointment that will not happen", () => {
    const ics = icsCalendar({
      name: "Clínica LUMIA",
      method: "CANCEL",
      events: [{ ...baseEvent, sequence: 1791000300, status: "CANCELLED" }],
    });

    expect(ics).toContain("METHOD:CANCEL\r\n");
    expect(ics).toContain(`UID:${baseEvent.uid}\r\n`);
    expect(ics).toContain("SEQUENCE:1791000300\r\n");
    expect(ics).toContain("STATUS:CANCELLED\r\n");
    expect(ics).not.toContain("STATUS:CONFIRMED");
  });

  it("keeps publishing without SEQUENCE when none is given, so the team's subscribed feed is unchanged", () => {
    const ics = icsCalendar({ name: "Equipo LUMIA", events: [baseEvent] });

    expect(ics).toContain("METHOD:PUBLISH\r\n");
    expect(ics).not.toContain("SEQUENCE");
  });

  it("produces a valid calendar when there are no events", () => {
    const ics = icsCalendar({ name: "Equipo LUMIA", events: [] });

    expect(ics).toBe(
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Clinica LUMIA//Agenda//ES",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Equipo LUMIA",
        "X-WR-TIMEZONE:Europe/Madrid",
        "END:VCALENDAR",
        "",
      ].join("\r\n"),
    );
  });
});

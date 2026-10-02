export type IcsEvent = {
  uid: string;
  startsAt: string;
  endsAt: string;
  stamp: string;
  summary: string;
  location?: string;
  description?: string;
  sequence?: number;
  status?: "CONFIRMED" | "CANCELLED";
  organizer?: { name: string; email: string };
  attendee?: string;
};

function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (currentBytes + bytes > 75) {
      lines.push(current);
      current = ` ${char}`;
      currentBytes = 1 + bytes;
    } else {
      current += char;
      currentBytes += bytes;
    }
  }
  lines.push(current);
  return lines.join("\r\n");
}

function contentLine(name: string, value: string): string {
  return foldLine(`${name}:${value}`);
}

function formatUtc(instant: string): string {
  return new Date(instant)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function eventLines(event: IcsEvent): string[] {
  const lines = [
    "BEGIN:VEVENT",
    contentLine("UID", event.uid),
    ...(event.sequence === undefined
      ? []
      : [contentLine("SEQUENCE", String(event.sequence))]),
    contentLine("DTSTAMP", formatUtc(event.stamp)),
    contentLine("DTSTART", formatUtc(event.startsAt)),
    contentLine("DTEND", formatUtc(event.endsAt)),
    contentLine("SUMMARY", escapeText(event.summary)),
  ];
  if (event.organizer) {
    lines.push(
      foldLine(
        `ORGANIZER;CN="${event.organizer.name.replace(/"/g, "")}":mailto:${event.organizer.email}`,
      ),
    );
  }
  if (event.attendee) {
    lines.push(
      foldLine(
        `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${event.attendee}`,
      ),
    );
  }
  if (event.location) {
    lines.push(contentLine("LOCATION", escapeText(event.location)));
  }
  if (event.description) {
    lines.push(contentLine("DESCRIPTION", escapeText(event.description)));
  }
  lines.push(`STATUS:${event.status ?? "CONFIRMED"}`, "END:VEVENT");
  return lines;
}

export function icsCalendar({
  name,
  method = "PUBLISH",
  events,
}: {
  name: string;
  method?: "PUBLISH" | "REQUEST" | "CANCEL";
  events: IcsEvent[];
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Clinica LUMIA//Agenda//ES",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    contentLine("X-WR-CALNAME", escapeText(name)),
    "X-WR-TIMEZONE:Europe/Madrid",
    ...events.flatMap(eventLines),
    "END:VCALENDAR",
  ];
  return `${lines.join("\r\n")}\r\n`;
}

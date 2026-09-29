export type IcsEvent = {
  uid: string;
  startsAt: string;
  endsAt: string;
  stamp: string;
  summary: string;
  location?: string;
  description?: string;
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
    contentLine("DTSTAMP", formatUtc(event.stamp)),
    contentLine("DTSTART", formatUtc(event.startsAt)),
    contentLine("DTEND", formatUtc(event.endsAt)),
    contentLine("SUMMARY", escapeText(event.summary)),
  ];
  if (event.location) {
    lines.push(contentLine("LOCATION", escapeText(event.location)));
  }
  if (event.description) {
    lines.push(contentLine("DESCRIPTION", escapeText(event.description)));
  }
  lines.push("STATUS:CONFIRMED", "END:VEVENT");
  return lines;
}

export function icsCalendar({
  name,
  events,
}: {
  name: string;
  events: IcsEvent[];
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Clinica LUMIA//Agenda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    contentLine("X-WR-CALNAME", escapeText(name)),
    "X-WR-TIMEZONE:Europe/Madrid",
    ...events.flatMap(eventLines),
    "END:VCALENDAR",
  ];
  return `${lines.join("\r\n")}\r\n`;
}

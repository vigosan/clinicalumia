import { icsCalendar } from "@clinicalumia/api/ics";
import { site } from "./site";

export function appointmentIcs({
  id,
  startsAt,
  endsAt,
  serviceName,
  now,
}: {
  id: string;
  startsAt: string;
  endsAt: string;
  serviceName: string;
  now: Date;
}): string {
  const address = `${site.address.street}, ${site.address.postalCode} ${site.address.locality}`;
  return icsCalendar({
    name: "Clínica LUMIA",
    events: [
      {
        uid: `${id}@clinicalumia.es`,
        startsAt,
        endsAt,
        stamp: now.toISOString(),
        summary: `Cita en Clínica LUMIA · ${serviceName}`,
        location: address,
      },
    ],
  });
}

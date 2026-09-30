import { madridInstant } from "@clinicalumia/api/madrid-time";
import { describe, expect, it } from "vitest";
import {
  type AppointmentRow,
  accountError,
  accountNotice,
  cancelledEmail,
  canMoveTo,
  changeWindowText,
  parseContactForm,
  rescheduledEmail,
  splitAppointments,
  statusLabel,
} from "./account";
import { site } from "./site";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

function appointment(overrides: Partial<AppointmentRow> = {}): AppointmentRow {
  return {
    id: "a1",
    person_id: "p1",
    person_name: "Lucía Pérez",
    starts_at: madridInstant("2026-10-06", "09:00"),
    ends_at: madridInstant("2026-10-06", "09:30"),
    status: "scheduled",
    service_id: "s1",
    service_name: "Sesión de logopedia",
    professional_id: "pr1",
    professional_name: "Ana García",
    origin: "web",
    cancelled_by: null,
    change_deadline: madridInstant("2026-10-06", "18:00"),
    can_change: true,
    can_reschedule: true,
    invoiced: false,
    ...overrides,
  };
}

describe("changeWindowText", () => {
  it("shows the deadline in Madrid time when still inside the window, so the patient knows exactly until when", () => {
    const row = appointment({
      change_deadline: madridInstant("2026-10-06", "18:00"),
      can_change: true,
    });
    expect(changeWindowText(row)).toBe(
      "Puedes cambiarla o cancelarla hasta el martes 6 a las 18:00",
    );
  });

  it("tells the patient an already paid appointment is changed by phone, instead of pretending the deadline passed", () => {
    const row = appointment({ can_change: false, invoiced: true });
    expect(changeWindowText(row)).toBe(
      `Esta cita ya está pagada. Para cambiarla o cancelarla, llama a la clínica al ${site.phone.display}.`,
    );
  });

  it("treats the exact deadline as already outside the window, matching the database rule now() < starts_at - plazo", () => {
    const row = appointment({ can_change: false });
    expect(changeWindowText(row)).toBe(
      `Fuera de plazo: llama al ${site.phone.display}`,
    );
  });

  it("formats the deadline correctly on the spring daylight-saving change day", () => {
    const row = appointment({
      can_change: true,
      change_deadline: madridInstant("2026-03-29", "18:00"),
    });
    expect(changeWindowText(row)).toBe(
      "Puedes cambiarla o cancelarla hasta el domingo 29 a las 18:00",
    );
  });

  it("formats the deadline correctly on the autumn daylight-saving change day", () => {
    const row = appointment({
      can_change: true,
      change_deadline: madridInstant("2026-10-25", "18:00"),
    });
    expect(changeWindowText(row)).toBe(
      "Puedes cambiarla o cancelarla hasta el domingo 25 a las 18:00",
    );
  });
});

describe("canMoveTo", () => {
  const row = appointment({
    starts_at: madridInstant("2026-10-09", "10:00"),
    change_deadline: madridInstant("2026-10-06", "10:00"),
  });
  const now = new Date(madridInstant("2026-10-02", "12:00"));

  it("offers a new start whose own window is still open, with the notice of this appointment's service", () => {
    expect(canMoveTo(row, madridInstant("2026-10-05", "12:30"), now)).toBe(
      true,
    );
  });

  it("does not offer a start whose window has already closed, because the database would refuse it as outside the window", () => {
    expect(canMoveTo(row, madridInstant("2026-10-05", "11:00"), now)).toBe(
      false,
    );
  });

  it("does not offer a start exactly at the limit, matching the database rule start - plazo > now()", () => {
    expect(canMoveTo(row, madridInstant("2026-10-05", "12:00"), now)).toBe(
      false,
    );
  });

  it("does not offer the current time of the appointment, because moving there changes nothing", () => {
    expect(canMoveTo(row, row.starts_at, now)).toBe(false);
    expect(canMoveTo(row, new Date(row.starts_at).toISOString(), now)).toBe(
      false,
    );
  });
});

describe("splitAppointments", () => {
  const now = new Date(madridInstant("2026-10-06", "12:00"));

  it("puts scheduled appointments that have not started yet into upcoming, nearest first", () => {
    const soon = appointment({
      id: "soon",
      starts_at: madridInstant("2026-10-06", "13:00"),
    });
    const later = appointment({
      id: "later",
      starts_at: madridInstant("2026-10-07", "09:00"),
    });
    const { upcoming } = splitAppointments([later, soon], now);
    expect(upcoming.map((row) => row.id)).toEqual(["soon", "later"]);
  });

  it("keeps a scheduled appointment starting exactly now in upcoming, since it has not happened yet", () => {
    const row = appointment({ id: "now", starts_at: now.toISOString() });
    const { upcoming } = splitAppointments([row], now);
    expect(upcoming.map((r) => r.id)).toEqual(["now"]);
  });

  it("sends cancelled, no-show and past scheduled appointments to history, most recent first", () => {
    const cancelled = appointment({
      id: "cancelled",
      status: "cancelled",
      cancelled_by: "patient",
      starts_at: madridInstant("2026-10-01", "09:00"),
      ends_at: madridInstant("2026-10-01", "09:30"),
    });
    const noShow = appointment({
      id: "no_show",
      status: "no_show",
      starts_at: madridInstant("2026-10-03", "09:00"),
      ends_at: madridInstant("2026-10-03", "09:30"),
    });
    const past = appointment({
      id: "past",
      status: "scheduled",
      starts_at: madridInstant("2026-10-05", "09:00"),
      ends_at: madridInstant("2026-10-05", "09:30"),
    });
    const { history } = splitAppointments([cancelled, noShow, past], now);
    expect(history.map((row) => row.id)).toEqual([
      "past",
      "no_show",
      "cancelled",
    ]);
  });

  it("sends an in-progress appointment (already started, not yet ended) to history, since it is no longer upcoming", () => {
    const inProgress = appointment({
      id: "in_progress",
      starts_at: madridInstant("2026-10-06", "11:00"),
      ends_at: madridInstant("2026-10-06", "13:00"),
    });
    const { upcoming, history } = splitAppointments([inProgress], now);
    expect(upcoming).toEqual([]);
    expect(history.map((row) => row.id)).toEqual(["in_progress"]);
  });
});

describe("statusLabel", () => {
  const now = new Date(madridInstant("2026-10-06", "12:00"));

  it("labels an appointment cancelled by the patient", () => {
    const row = appointment({ status: "cancelled", cancelled_by: "patient" });
    expect(statusLabel(row, now)).toBe("Cancelada por ti");
  });

  it("labels an appointment cancelled by the clinic, even when the clinic booked it", () => {
    const row = appointment({
      status: "cancelled",
      cancelled_by: "clinic",
      origin: "staff",
    });
    expect(statusLabel(row, now)).toBe("Cancelada por la clínica");
  });

  it("labels a no-show", () => {
    const row = appointment({ status: "no_show" });
    expect(statusLabel(row, now)).toBe("No asististe");
  });

  it("labels a scheduled appointment that already ended as done", () => {
    const row = appointment({
      status: "scheduled",
      starts_at: madridInstant("2026-10-06", "09:00"),
      ends_at: madridInstant("2026-10-06", "09:30"),
    });
    expect(statusLabel(row, now)).toBe("Realizada");
  });

  it("labels an in-progress appointment (already started, not yet ended) as done, agreeing with splitAppointments' starts_at boundary", () => {
    const row = appointment({
      status: "scheduled",
      starts_at: madridInstant("2026-10-06", "11:00"),
      ends_at: madridInstant("2026-10-06", "13:00"),
    });
    expect(statusLabel(row, now)).toBe("Realizada");
  });

  it("labels a scheduled appointment that has not ended yet as upcoming", () => {
    const row = appointment({
      status: "scheduled",
      starts_at: madridInstant("2026-10-06", "13:00"),
      ends_at: madridInstant("2026-10-06", "13:30"),
    });
    expect(statusLabel(row, now)).toBe("Próxima");
  });
});

describe("parseContactForm", () => {
  it("requires a valid phone for an adult", () => {
    expect(parseContactForm(form({ phone: "", address: "" }), false)).toEqual({
      error: "Escribe un teléfono válido.",
    });
    expect(
      parseContactForm(form({ phone: "123", address: "" }), false),
    ).toEqual({ error: "Escribe un teléfono válido." });
  });

  it("allows an empty phone for a minor, mirroring the database rule", () => {
    expect(parseContactForm(form({ phone: "", address: "" }), true)).toEqual({
      phone: null,
      address: "",
    });
  });

  it("rejects a minor's phone with no digits instead of silently clearing the one on file", () => {
    expect(parseContactForm(form({ phone: "abc", address: "" }), true)).toEqual(
      { error: "Escribe un teléfono válido." },
    );
  });

  it("rejects an address longer than 300 characters", () => {
    const result = parseContactForm(
      form({ phone: "614552808", address: "a".repeat(301) }),
      false,
    );
    expect(result).toEqual({ error: "La dirección es demasiado larga." });
  });

  it("accepts a valid phone and address", () => {
    expect(
      parseContactForm(
        form({ phone: "614 55 28 08", address: "Calle Mayor 1" }),
        false,
      ),
    ).toEqual({ phone: "614552808", address: "Calle Mayor 1" });
  });
});

describe("accountError", () => {
  it("tells the patient to call when an already paid appointment can't be moved online, since changing it needs the clinic to correct the invoice", () => {
    expect(accountError({ message: "appointment_invoiced" })).toBe(
      `Esta cita ya está pagada. Para cambiarla o cancelarla, llama a la clínica al ${site.phone.display}.`,
    );
  });

  it("maps every code from the brief", () => {
    expect(accountError({ message: "appointment_not_in_account" })).toBe(
      "Esa cita no está en tu cuenta.",
    );
    expect(accountError({ message: "outside_change_window" })).toBe(
      `Ya no se puede cambiar desde la web. Llama al ${site.phone.display}.`,
    );
    expect(accountError({ message: "slot_not_available" })).toBe(
      "Ese hueco ya no está libre. Elige otro.",
    );
    expect(accountError({ message: "person_not_in_account" })).toBe(
      "Esa persona no está en tu cuenta.",
    );
    expect(accountError({ message: "invalid_phone" })).toBe(
      "Escribe un teléfono válido.",
    );
    expect(accountError({ message: "address_too_long" })).toBe(
      "La dirección es demasiado larga.",
    );
  });

  it("falls back to a generic message for anything else", () => {
    expect(accountError({ message: "unexpected" })).toBe(
      "No se ha podido guardar. Inténtalo de nuevo.",
    );
  });
});

describe("rescheduledEmail", () => {
  const details = {
    id: "77777777-7777-7777-7777-777777777777",
    startsAt: madridInstant("2026-10-02", "09:30"),
    endsAt: madridInstant("2026-10-02", "10:15"),
    serviceName: "Sesión de logopedia",
    professionalName: "Ana García",
    personName: "Lucía Pérez",
  };

  it("gives the subject, when, service, professional, for whom and a link back to Mi cuenta", () => {
    const email = rescheduledEmail(details);
    expect(email.subject).toBe("Cita confirmada");
    expect(email.html).toContain("Viernes, 2 de octubre a las 09:30");
    expect(email.html).toContain("Sesión de logopedia");
    expect(email.html).toContain("Ana García");
    expect(email.html).toContain("Lucía Pérez");
    expect(email.html).toContain(
      `<a href="${site.url}/mi-cuenta">Ver Mi cuenta</a>`,
    );
  });

  it("escapes names typed by patients so they cannot inject markup into the email", () => {
    const email = rescheduledEmail({ ...details, personName: "<b>Lucía</b>" });
    expect(email.html).toContain("&lt;b&gt;Lucía&lt;/b&gt;");
    expect(email.html).not.toContain("<b>Lucía</b>");
  });
});

describe("cancelledEmail", () => {
  const details = {
    id: "77777777-7777-7777-7777-777777777777",
    startsAt: madridInstant("2026-10-02", "09:30"),
    endsAt: madridInstant("2026-10-02", "10:15"),
    serviceName: "Sesión de logopedia",
    professionalName: "Ana García",
    personName: "Lucía Pérez",
  };

  it("gives the subject, when, service, professional, for whom and a link back to Mi cuenta", () => {
    const email = cancelledEmail(details);
    expect(email.subject).toBe("Cita cancelada");
    expect(email.html).toContain("Viernes, 2 de octubre a las 09:30");
    expect(email.html).toContain("Sesión de logopedia");
    expect(email.html).toContain("Ana García");
    expect(email.html).toContain("Lucía Pérez");
    expect(email.html).toContain(
      `<a href="${site.url}/mi-cuenta">Ver Mi cuenta</a>`,
    );
  });

  it("escapes names typed by patients so they cannot inject markup into the email", () => {
    const email = cancelledEmail({ ...details, personName: "<b>Lucía</b>" });
    expect(email.html).toContain("&lt;b&gt;Lucía&lt;/b&gt;");
    expect(email.html).not.toContain("<b>Lucía</b>");
  });
});

describe("accountNotice", () => {
  it("confirms each change the patient just made when they land back on Mi cuenta", () => {
    expect(accountNotice("cancelada")).toBe("Cita cancelada");
    expect(accountNotice("cambiada")).toBe("Cita cambiada");
    expect(accountNotice("menor")).toBe("Menor añadido");
    expect(accountNotice("contacto")).toBe("Datos guardados");
  });

  it("shows nothing for a code typed into the URL, so the page never displays made-up text", () => {
    expect(accountNotice("inventado")).toBeUndefined();
    expect(accountNotice("toString")).toBeUndefined();
    expect(accountNotice(undefined)).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import {
  appointmentStatusLabel,
  type PatientAppointmentSource,
  splitPatientAppointments,
} from "./patient-appointments";

function appointment(
  overrides: Partial<PatientAppointmentSource>,
): PatientAppointmentSource {
  return {
    id: "appt-1",
    startsAt: "2026-10-05T15:00:00+02:00",
    serviceName: "Sesión",
    professionalName: "Laura Ejemplo",
    status: "scheduled",
    cancelledBy: null,
    ...overrides,
  };
}

describe("appointmentStatusLabel", () => {
  it("shows «Programada» for a scheduled appointment that hasn't started", () => {
    expect(
      appointmentStatusLabel(
        appointment({ startsAt: "2026-10-05T15:00:00+02:00" }),
        new Date("2026-10-01T00:00:00Z"),
      ),
    ).toBe("Programada");
  });

  it("shows «Hecha» for a scheduled appointment that already started, since it was never cancelled or marked no-show", () => {
    expect(
      appointmentStatusLabel(
        appointment({ startsAt: "2026-10-05T15:00:00+02:00" }),
        new Date("2026-10-10T00:00:00Z"),
      ),
    ).toBe("Hecha");
  });

  it("shows «Cancelada por el paciente» when the patient cancelled", () => {
    expect(
      appointmentStatusLabel(
        appointment({ status: "cancelled", cancelledBy: "patient" }),
        new Date("2026-10-10T00:00:00Z"),
      ),
    ).toBe("Cancelada por el paciente");
  });

  it("shows «Cancelada por la clínica» when the clinic cancelled", () => {
    expect(
      appointmentStatusLabel(
        appointment({ status: "cancelled", cancelledBy: "clinic" }),
        new Date("2026-10-10T00:00:00Z"),
      ),
    ).toBe("Cancelada por la clínica");
  });

  it("shows «No se presentó» for a no-show, regardless of the date", () => {
    expect(
      appointmentStatusLabel(
        appointment({ status: "no_show" }),
        new Date("2026-10-10T00:00:00Z"),
      ),
    ).toBe("No se presentó");
  });
});

describe("splitPatientAppointments", () => {
  const now = new Date("2026-10-10T00:00:00Z");

  it("puts an appointment that hasn't started yet under upcoming, ordered soonest first", () => {
    const soon = appointment({ id: "soon", startsAt: "2026-10-11T10:00:00Z" });
    const later = appointment({
      id: "later",
      startsAt: "2026-10-15T10:00:00Z",
    });
    const result = splitPatientAppointments([later, soon], now);
    expect(result.upcoming.map((row) => row.id)).toEqual(["soon", "later"]);
    expect(result.past).toEqual([]);
  });

  it("puts an appointment that already started under past, ordered most recent first", () => {
    const older = appointment({
      id: "older",
      startsAt: "2026-10-01T10:00:00Z",
    });
    const recent = appointment({
      id: "recent",
      startsAt: "2026-10-05T10:00:00Z",
    });
    const result = splitPatientAppointments([older, recent], now);
    expect(result.past.map((row) => row.id)).toEqual(["recent", "older"]);
    expect(result.upcoming).toEqual([]);
  });

  it("keeps a cancelled appointment in upcoming when its date is still in the future, so it stays visible with its status", () => {
    const cancelled = appointment({
      id: "cancelled",
      startsAt: "2026-10-20T10:00:00Z",
      status: "cancelled",
      cancelledBy: "clinic",
    });
    const result = splitPatientAppointments([cancelled], now);
    expect(result.upcoming).toHaveLength(1);
    expect(result.upcoming[0]?.statusLabel).toBe("Cancelada por la clínica");
  });

  it("builds the agenda link with the Madrid date and the appointment id", () => {
    const appt = appointment({
      id: "abc-123",
      startsAt: "2026-10-11T22:30:00Z",
    });
    const result = splitPatientAppointments([appt], now);
    expect(result.upcoming[0]?.href).toBe(
      "/?date=2026-10-12&appointment=abc-123",
    );
  });

  it("caps each list at 20 and flags it as truncated", () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      appointment({
        id: `future-${index}`,
        startsAt: `2026-11-${String((index % 28) + 1).padStart(2, "0")}T10:00:00Z`,
      }),
    );
    const result = splitPatientAppointments(many, now);
    expect(result.upcoming).toHaveLength(20);
    expect(result.upcomingTruncated).toBe(true);
    expect(result.pastTruncated).toBe(false);
  });
});

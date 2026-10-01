import { describe, expect, it } from "vitest";
import {
  appointmentStatusLabel,
  type PatientAppointmentSource,
  type PatientPaymentSource,
  patientAppointmentsToCollect,
  patientPaymentRows,
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
    payments: [],
    ...overrides,
  };
}

function payment(
  overrides: Partial<PatientPaymentSource>,
): PatientPaymentSource {
  return {
    id: "pay-1",
    amountCents: 4500,
    method: "cash",
    note: "",
    collectedAt: "2026-10-05T14:00:00Z",
    voidedAt: null,
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

  it("shows «Realizada» for a scheduled appointment that already started, since it was never cancelled or marked no-show", () => {
    expect(
      appointmentStatusLabel(
        appointment({ startsAt: "2026-10-05T15:00:00+02:00" }),
        new Date("2026-10-10T00:00:00Z"),
      ),
    ).toBe("Realizada");
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

  it("shows «No presentada» for a no-show, regardless of the date", () => {
    expect(
      appointmentStatusLabel(
        appointment({ status: "no_show" }),
        new Date("2026-10-10T00:00:00Z"),
      ),
    ).toBe("No presentada");
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

describe("payment state on the record", () => {
  const now = new Date("2026-10-10T10:00:00Z");
  const past = "2026-10-05T10:00:00Z";

  function labelOf(source: PatientAppointmentSource): string | undefined {
    const result = splitPatientAppointments([source], now);
    return [...result.upcoming, ...result.past][0]?.statusLabel;
  }

  it("flags a visit that took place without payment, so nobody forgets to charge it", () => {
    expect(labelOf(appointment({ startsAt: past }))).toBe(
      "Realizada · Pendiente de cobro",
    );
  });

  it("shows amount and method of the valid payment", () => {
    expect(
      labelOf(appointment({ startsAt: past, payments: [payment({})] })),
    ).toBe("Realizada · Cobrada · 45,00 € · Efectivo");
  });

  it("ignores a voided payment, because the visit is unpaid again", () => {
    expect(
      labelOf(
        appointment({
          startsAt: past,
          payments: [payment({ voidedAt: "2026-10-06T10:00:00Z" })],
        }),
      ),
    ).toBe("Realizada · Pendiente de cobro");
  });

  it("says «Sin cargo» for a visit registered at 0 €", () => {
    expect(
      labelOf(
        appointment({
          startsAt: past,
          payments: [payment({ amountCents: 0 })],
        }),
      ),
    ).toBe("Realizada · Sin cargo");
  });

  it("adds nothing to a future visit that is not paid yet", () => {
    expect(labelOf(appointment({ startsAt: "2026-10-20T10:00:00Z" }))).toBe(
      "Programada",
    );
  });
});

describe("patientAppointmentsToCollect", () => {
  const now = new Date("2026-10-10T10:00:00Z");

  it("offers «Cobrar» for unpaid visits up to the end of today, most recent first, including later today when the patient pays on arrival", () => {
    const rows = patientAppointmentsToCollect(
      [
        appointment({ id: "old", startsAt: "2026-10-01T10:00:00Z" }),
        appointment({ id: "later-today", startsAt: "2026-10-10T16:00:00Z" }),
        appointment({ id: "tomorrow", startsAt: "2026-10-11T10:00:00Z" }),
        appointment({
          id: "paid",
          startsAt: "2026-10-05T10:00:00Z",
          payments: [payment({})],
        }),
        appointment({
          id: "cancelled",
          startsAt: "2026-10-06T10:00:00Z",
          status: "cancelled",
          cancelledBy: "clinic",
        }),
      ],
      now,
    );
    expect(rows.map((row) => row.id)).toEqual(["later-today", "old"]);
  });

  it("uses the same 60-day window as «Pendientes», so the record and the Cobros page never disagree about what is owed", () => {
    const rows = patientAppointmentsToCollect(
      [
        appointment({ id: "too-old", startsAt: "2026-08-10T21:59:00Z" }),
        appointment({ id: "first-day", startsAt: "2026-08-10T22:00:00Z" }),
      ],
      now,
    );
    expect(rows.map((row) => row.id)).toEqual(["first-day"]);
  });

  it("keeps a no-show collectable, as the clinic may still charge it", () => {
    const rows = patientAppointmentsToCollect(
      [
        appointment({
          id: "no-show",
          status: "no_show",
          startsAt: "2026-10-05T10:00:00Z",
        }),
      ],
      now,
    );
    expect(rows.map((row) => row.id)).toEqual(["no-show"]);
  });
});

describe("patientPaymentRows", () => {
  it("lists every payment newest first with amount, method, whether it is still valid and the visit it paid, which may be another day", () => {
    const rows = patientPaymentRows([
      appointment({
        id: "a1",
        startsAt: "2026-10-05T10:00:00Z",
        payments: [
          payment({
            id: "voided",
            collectedAt: "2026-10-05T10:30:00Z",
            voidedAt: "2026-10-05T11:00:00Z",
          }),
          payment({
            id: "valid",
            method: "card",
            collectedAt: "2026-10-07T11:30:00Z",
          }),
        ],
      }),
    ]);
    expect(rows.rows).toEqual([
      {
        id: "valid",
        date: "07/10/2026",
        appointmentDate: "05/10/2026",
        serviceName: "Sesión",
        amountLabel: "45,00 € · Tarjeta",
        stateLabel: "Válido",
        voided: false,
        href: "/?date=2026-10-05&appointment=a1",
      },
      {
        id: "voided",
        date: "05/10/2026",
        appointmentDate: "05/10/2026",
        serviceName: "Sesión",
        amountLabel: "45,00 € · Efectivo",
        stateLabel: "Anulado",
        voided: true,
        href: "/?date=2026-10-05&appointment=a1",
      },
    ]);
    expect(rows.truncated).toBe(false);
  });
});

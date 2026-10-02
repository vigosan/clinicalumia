import { describe, expect, it } from "vitest";
import {
  type AppointmentEventRow,
  appointmentHistory,
  historyLine,
} from "./appointment-history";

const nameById = new Map([
  ["actor-1", "Laura Ejemplo"],
  ["actor-2", "Patricia"],
]);

function event(
  overrides: Partial<AppointmentEventRow> = {},
): AppointmentEventRow {
  return {
    id: "event-1",
    kind: "created",
    previous_starts_at: null,
    previous_ends_at: null,
    previous_professional_id: null,
    actor_id: "actor-1",
    actor_kind: "staff",
    created_at: "2026-09-28T08:12:00Z",
    ...overrides,
  };
}

const appointment = {
  starts_at: "2026-09-28T14:00:00Z",
  professional_id: "prof-now",
  cancelled_by: null as "patient" | "clinic" | null,
  cancel_reason: "",
};

describe("historyLine", () => {
  it("says who handed the appointment over, from whom and to whom, so the team knows why it changed hands", () => {
    const names = new Map([
      ...nameById,
      ["prof-old", "Marta Saliente"],
      ["prof-mid", "Ana Relevo"],
      ["prof-now", "Bea Final"],
    ]);
    const first = event({
      id: "e1",
      kind: "reassigned",
      previous_professional_id: "prof-old",
      actor_id: "actor-2",
      created_at: "2026-09-28T08:12:00Z",
    });
    const second = event({
      id: "e2",
      kind: "reassigned",
      previous_professional_id: "prof-mid",
      actor_id: "actor-2",
      created_at: "2026-09-28T09:00:00Z",
    });
    const events = [first, second];
    expect(historyLine(first, 0, events, appointment, names)).toBe(
      "Reasignada de Marta Saliente a Ana Relevo por Patricia el 28/09 a las 10:12",
    );
    expect(historyLine(second, 1, events, appointment, names)).toBe(
      "Reasignada de Ana Relevo a Bea Final por Patricia el 28/09 a las 11:00",
    );
  });

  it("says the appointment was booked from the web instead of naming an actor, since the patient who booked it isn't in the staff directory", () => {
    const created = event({
      kind: "created",
      actor_id: null,
      actor_kind: "patient",
      created_at: "2026-09-28T08:12:00Z",
    });
    const line = historyLine(created, 0, [created], appointment, nameById);
    expect(line).toBe("Reservada desde la web el 28/09 a las 10:12");
  });

  it("names the actor for cancelled, with a short who-cancelled tag and the reason after a middle dot", () => {
    const cancelled = event({
      kind: "cancelled",
      created_at: "2026-09-28T08:12:00Z",
    });
    const line = historyLine(
      cancelled,
      0,
      [cancelled],
      {
        ...appointment,
        cancelled_by: "patient",
        cancel_reason: "Se encontraba mal",
      },
      nameById,
    );
    expect(line).toBe(
      "Cancelada (paciente) por Laura Ejemplo el 28/09 a las 10:12 · Se encontraba mal",
    );
  });

  it("omits the reason separator when there is no cancel_reason", () => {
    const cancelled = event({ kind: "cancelled" });
    const line = historyLine(
      cancelled,
      0,
      [cancelled],
      {
        ...appointment,
        cancelled_by: "clinic",
        cancel_reason: "",
      },
      nameById,
    );
    expect(line).toBe(
      "Cancelada (clínica) por Laura Ejemplo el 28/09 a las 10:12",
    );
  });

  it("names the actor for no_show, unlike the previous line that only said when", () => {
    const noShow = event({ kind: "no_show", actor_id: "actor-2" });
    const line = historyLine(noShow, 0, [noShow], appointment, nameById);
    expect(line).toBe(
      "Marcada como no presentada por Patricia el 28/09 a las 10:12",
    );
  });

  it("names the actor for restored", () => {
    const restored = event({ kind: "restored", actor_id: "actor-2" });
    const line = historyLine(restored, 0, [restored], appointment, nameById);
    expect(line).toBe(
      "Se deshizo «no presentada» por Patricia el 28/09 a las 10:12",
    );
  });

  it("says «alguien del equipo» when a staff member whose name cannot be shown made the change, so the history neither invents an automatic process nor reads as a stranger", () => {
    const restored = event({ kind: "restored", actor_id: "missing-actor" });
    const line = historyLine(restored, 0, [restored], appointment, nameById);
    expect(line).toBe(
      "Se deshizo «no presentada» por alguien del equipo el 28/09 a las 10:12",
    );
  });

  it("says «el sistema» when no person made the change, since it came from an automatic process", () => {
    const noShow = event({ kind: "no_show", actor_id: null });
    const line = historyLine(noShow, 0, [noShow], appointment, nameById);
    expect(line).toBe(
      "Marcada como no presentada por el sistema el 28/09 a las 10:12",
    );
  });

  it("says «la web» when the patient made a change that has no web-specific wording, so staff know it came from the booking site", () => {
    const reassigned = event({
      kind: "reassigned",
      actor_id: null,
      actor_kind: "patient",
      previous_professional_id: "actor-1",
    });
    const line = historyLine(
      reassigned,
      0,
      [reassigned],
      { ...appointment, professional_id: "actor-2" },
      nameById,
    );
    expect(line).toBe(
      "Reasignada de Laura Ejemplo a Patricia por la web el 28/09 a las 10:12",
    );
  });

  it("shows only the time for a same-day move", () => {
    const moved = event({
      kind: "moved",
      previous_starts_at: "2026-09-28T14:00:00Z",
    });
    const line = historyLine(
      moved,
      0,
      [moved],
      { ...appointment, starts_at: "2026-09-28T16:00:00Z" },
      nameById,
    );
    expect(line).toBe(
      "Movida de 16:00 a 18:00 por Laura Ejemplo el 28/09 a las 10:12",
    );
  });

  it("includes the dd/mm date on both sides when the Madrid date changes, since 16:00 to 16:00 hides the real change", () => {
    const moved = event({
      kind: "moved",
      previous_starts_at: "2026-09-28T14:00:00Z",
    });
    const line = historyLine(
      moved,
      0,
      [moved],
      { ...appointment, starts_at: "2026-09-29T14:00:00Z" },
      nameById,
    );
    expect(line).toBe(
      "Movida de 28/09 16:00 a 29/09 16:00 por Laura Ejemplo el 28/09 a las 10:12",
    );
  });

  it("says a patient's own move was made from the web, with when it happened and the previous time, instead of naming an actor", () => {
    const moved = event({
      kind: "moved",
      actor_id: null,
      actor_kind: "patient",
      previous_starts_at: "2026-09-27T12:30:00Z",
      created_at: "2026-09-28T08:12:00Z",
    });
    const line = historyLine(moved, 0, [moved], appointment, nameById);
    expect(line).toBe(
      "Cambiada desde la web el 28/09 a las 10:12 (antes: 27/09 14:30)",
    );
  });

  it("says a patient's own cancellation was made from the web, without naming an actor or a reason", () => {
    const cancelled = event({
      kind: "cancelled",
      actor_id: null,
      actor_kind: "patient",
      created_at: "2026-09-28T08:12:00Z",
    });
    const line = historyLine(
      cancelled,
      0,
      [cancelled],
      { ...appointment, cancelled_by: "patient", cancel_reason: "" },
      nameById,
    );
    expect(line).toBe("Cancelada desde la web el 28/09 a las 10:12");
  });
});

describe("appointmentHistory", () => {
  it("interleaves payment lines with appointment events by time, so a re-collection after a void reads in the order it happened", () => {
    const created = event({
      id: "event-1",
      created_at: "2026-09-28T08:00:00Z",
    });
    const noShow = event({
      id: "event-2",
      kind: "no_show",
      created_at: "2026-09-28T10:30:00Z",
    });
    const history = appointmentHistory({
      events: [created, noShow],
      appointment,
      payments: [
        {
          id: "payment-2",
          amount_cents: 5500,
          method: "bizum",
          collected_at: "2026-09-28T11:00:00Z",
          collected_by: "actor-2",
          voided_at: null,
          voided_by: null,
          void_reason: "",
        },
        {
          id: "payment-1",
          amount_cents: 5500,
          method: "cash",
          collected_at: "2026-09-28T09:00:00Z",
          collected_by: "actor-1",
          voided_at: "2026-09-28T10:45:00Z",
          voided_by: "actor-2",
          void_reason: "Pagó con Bizum",
        },
      ],
      nameById,
    });
    expect(history).toEqual([
      { id: "event-1", text: "Creada por Laura Ejemplo el 28/09 a las 10:00" },
      {
        id: "payment-1-collected",
        text: "Cobrada · 55,00 € · Efectivo por Laura Ejemplo el 28/09 a las 11:00",
      },
      {
        id: "event-2",
        text: "Marcada como no presentada por Laura Ejemplo el 28/09 a las 12:30",
      },
      {
        id: "payment-1-voided",
        text: "Cobro anulado · Pagó con Bizum por Patricia el 28/09 a las 12:45",
      },
      {
        id: "payment-2-collected",
        text: "Cobrada · 55,00 € · Bizum por Patricia el 28/09 a las 13:00",
      },
    ]);
  });
});

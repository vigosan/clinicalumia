import { describe, expect, it } from "vitest";
import { type AppointmentEventRow, historyLine } from "./appointment-history";

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
    actor_id: "actor-1",
    actor_kind: "staff",
    created_at: "2026-09-28T08:12:00Z",
    ...overrides,
  };
}

const appointment = {
  starts_at: "2026-09-28T14:00:00Z",
  cancelled_by: null as "patient" | "clinic" | null,
  cancel_reason: "",
};

describe("historyLine", () => {
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
    expect(line).toBe("Restaurada por Patricia el 28/09 a las 10:12");
  });

  it("falls back to Alguien when the actor has no profile in the directory", () => {
    const restored = event({ kind: "restored", actor_id: "missing-actor" });
    const line = historyLine(restored, 0, [restored], appointment, nameById);
    expect(line).toBe("Restaurada por Alguien el 28/09 a las 10:12");
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
});

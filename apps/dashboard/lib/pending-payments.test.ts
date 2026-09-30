import { describe, expect, it, vi } from "vitest";
import { loadPendingPayments, pendingSince } from "./pending-payments";

describe("pendingSince", () => {
  it("starts 60 days before today in Madrid, at midnight, so old unpaid visits stay visible for two months", () => {
    expect(pendingSince(new Date("2026-09-30T08:00:00Z"))).toBe(
      "2026-08-01T00:00:00+02:00",
    );
  });
});

function fakeClient({
  rows = [],
  rowsError = null,
  directory = [],
  directoryError = null,
}: {
  rows?: unknown[];
  rowsError?: { code?: string } | null;
  directory?: unknown[];
  directoryError?: { code?: string } | null;
} = {}) {
  const rpc = vi.fn((name: string) => {
    if (name === "pending_payments")
      return Promise.resolve({ data: rows, error: rowsError });
    if (name === "staff_directory")
      return Promise.resolve({ data: directory, error: directoryError });
    throw new Error(`unexpected rpc ${name}`);
  });
  return { client: { rpc }, rpc };
}

const NOW = new Date("2026-09-30T08:00:00Z");

describe("loadPendingPayments", () => {
  it("lets the database work out what is pending since the start of the window, so a clinic with thousands of paid visits never truncates the list", async () => {
    const { client, rpc } = fakeClient();
    await loadPendingPayments(client as never, NOW);
    expect(rpc).toHaveBeenCalledWith("pending_payments", {
      p_since: "2026-08-01T00:00:00+02:00",
    });
  });

  it("maps a pending appointment to a row that links to it in the agenda", async () => {
    const { client } = fakeClient({
      rows: [
        {
          appointment_id: "apt-1",
          starts_at: "2026-09-27T09:00:00Z",
          patient_id: "pat-1",
          patient_name: "Marta Paciente",
          service_name: "Consulta",
          professional_id: "prof-1",
          suggested_cents: 3500,
        },
      ],
      directory: [{ id: "prof-1", full_name: "Profesional Uno" }],
    });
    const result = await loadPendingPayments(client as never, NOW);
    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: "apt-1",
          moment: "27/09 11:00",
          patientName: "Marta Paciente",
          serviceName: "Consulta",
          professionalName: "Profesional Uno",
          suggestedAmountCents: 3500,
          href: "/?date=2026-09-27&appointment=apt-1",
        },
      ],
    });
  });

  it("falls back to a generic professional name when the directory doesn't have one", async () => {
    const { client } = fakeClient({
      rows: [
        {
          appointment_id: "apt-1",
          starts_at: "2026-09-27T09:00:00Z",
          patient_id: "pat-1",
          patient_name: "Marta Paciente",
          service_name: "Consulta",
          professional_id: "prof-1",
          suggested_cents: 5500,
        },
      ],
    });
    const result = await loadPendingPayments(client as never, NOW);
    expect(result.ok && result.data[0]?.professionalName).toBe("Profesional");
  });

  it("reports failure when the pending query fails", async () => {
    const { client } = fakeClient({ rowsError: { code: "XX000" } });
    const result = await loadPendingPayments(client as never, NOW);
    expect(result).toEqual({ ok: false });
  });

  it("reports failure when the staff directory fails to load", async () => {
    const { client } = fakeClient({ directoryError: { code: "XX000" } });
    const result = await loadPendingPayments(client as never, NOW);
    expect(result).toEqual({ ok: false });
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  loadLaterTodayCandidates,
  loadPendingPayments,
  pendingSince,
} from "./pending-payments";

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
          startsAt: "2026-09-27T09:00:00Z",
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

  it("lists the most recent unpaid visit first, like the «Registrar cobro» dialog", async () => {
    const row = (id: string, startsAt: string) => ({
      appointment_id: id,
      starts_at: startsAt,
      patient_id: "pat-1",
      patient_name: "Marta Paciente",
      service_name: "Consulta",
      professional_id: "prof-1",
      suggested_cents: 3500,
    });
    const { client } = fakeClient({
      rows: [
        row("old", "2026-09-01T09:00:00Z"),
        row("recent", "2026-09-27T09:00:00Z"),
      ],
    });
    const result = await loadPendingPayments(client as never, NOW);
    expect(result.ok && result.data.map((r) => r.id)).toEqual([
      "recent",
      "old",
    ]);
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

function fakeLaterTodayClient({
  rows = [],
  rowsError = null,
  suggested = {},
}: {
  rows?: unknown[];
  rowsError?: { code?: string } | null;
  suggested?: Record<string, number>;
} = {}) {
  const query = {
    select: vi.fn(() => query),
    gt: vi.fn(() => query),
    lt: vi.fn(() => query),
    neq: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve({ data: rows, error: rowsError })),
  };
  const from = vi.fn(() => query);
  const rpc = vi.fn((name: string, args?: { p_appointment_id: string }) => {
    if (name === "staff_directory")
      return Promise.resolve({
        data: [{ id: "prof-1", full_name: "Profesional Uno" }],
        error: null,
      });
    if (name === "suggested_amount")
      return Promise.resolve({
        data: suggested[args?.p_appointment_id ?? ""] ?? null,
        error: null,
      });
    throw new Error(`unexpected rpc ${name}`);
  });
  return { client: { from, rpc }, from, query, rpc };
}

function laterRow(id: string, payments: { voided_at: string | null }[] = []) {
  return {
    id,
    starts_at: "2026-09-30T15:00:00Z",
    professional_id: "prof-1",
    patient: { first_name: "Marta", last_name: "Paciente" },
    service: { name: "Consulta" },
    payments,
  };
}

describe("loadLaterTodayCandidates", () => {
  it("asks only for today's appointments that have not started and are not cancelled, through the same row-level security as the agenda", async () => {
    const { client, from, query } = fakeLaterTodayClient();
    await loadLaterTodayCandidates(client as never, NOW);
    expect(from).toHaveBeenCalledWith("appointments");
    expect(query.gt).toHaveBeenCalledWith("starts_at", NOW.toISOString());
    expect(query.lt).toHaveBeenCalledWith(
      "starts_at",
      "2026-10-01T00:00:00+02:00",
    );
    expect(query.neq).toHaveBeenCalledWith("status", "cancelled");
  });

  it("offers the unpaid ones with the amount the database suggests, so a prepaid web deposit is discounted", async () => {
    const { client } = fakeLaterTodayClient({
      rows: [
        laterRow("unpaid"),
        laterRow("voided-only", [{ voided_at: "2026-09-30T07:00:00Z" }]),
        laterRow("paid", [{ voided_at: null }]),
      ],
      suggested: { unpaid: 5500, "voided-only": 2000 },
    });
    const result = await loadLaterTodayCandidates(client as never, NOW);
    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: "unpaid",
          startsAt: "2026-09-30T15:00:00Z",
          patientName: "Marta Paciente",
          serviceName: "Consulta",
          professionalName: "Profesional Uno",
          suggestedAmountCents: 5500,
        },
        {
          id: "voided-only",
          startsAt: "2026-09-30T15:00:00Z",
          patientName: "Marta Paciente",
          serviceName: "Consulta",
          professionalName: "Profesional Uno",
          suggestedAmountCents: 2000,
        },
      ],
    });
  });

  it("reports failure when the appointments query fails", async () => {
    const { client } = fakeLaterTodayClient({ rowsError: { code: "XX000" } });
    expect(await loadLaterTodayCandidates(client as never, NOW)).toEqual({
      ok: false,
    });
  });
});

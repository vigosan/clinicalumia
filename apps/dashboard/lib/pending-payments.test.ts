import { describe, expect, it, vi } from "vitest";
import {
  computeSuggestedAmountCents,
  hasActivePayment,
  loadPendingPayments,
  pendingWindow,
} from "./pending-payments";

describe("pendingWindow", () => {
  it("starts 60 days before today in Madrid, at midnight, so old unpaid visits stay visible for two months", () => {
    const now = new Date("2026-09-30T08:00:00Z");
    expect(pendingWindow(now)).toEqual({
      start: "2026-08-01T00:00:00+02:00",
      end: now.toISOString(),
    });
  });

  it("ends exactly at now, so an appointment that hasn't started yet never counts as pending", () => {
    const now = new Date("2026-10-25T10:30:00Z");
    expect(pendingWindow(now).end).toBe(now.toISOString());
  });
});

describe("computeSuggestedAmountCents", () => {
  it("proposes the full price when no deposit was paid online", () => {
    expect(
      computeSuggestedAmountCents({
        price_cents: 5500,
        payment_status: "not_required",
        payment_amount_cents: 0,
      }),
    ).toBe(5500);
  });

  it("subtracts a paid deposit from the price", () => {
    expect(
      computeSuggestedAmountCents({
        price_cents: 5500,
        payment_status: "paid",
        payment_amount_cents: 2000,
      }),
    ).toBe(3500);
  });

  it("ignores a pending (unpaid) deposit, since nothing was actually collected online", () => {
    expect(
      computeSuggestedAmountCents({
        price_cents: 5500,
        payment_status: "pending",
        payment_amount_cents: 2000,
      }),
    ).toBe(5500);
  });

  it("never proposes a negative amount when the deposit exceeds the price", () => {
    expect(
      computeSuggestedAmountCents({
        price_cents: 1000,
        payment_status: "paid",
        payment_amount_cents: 2000,
      }),
    ).toBe(0);
  });
});

describe("hasActivePayment", () => {
  it("has no active payment when there are none at all", () => {
    expect(hasActivePayment([])).toBe(false);
  });

  it("has no active payment when every payment was voided", () => {
    expect(hasActivePayment([{ voided_at: "2026-09-01T10:00:00Z" }])).toBe(
      false,
    );
  });

  it("has an active payment when at least one is not voided", () => {
    expect(
      hasActivePayment([
        { voided_at: "2026-09-01T10:00:00Z" },
        { voided_at: null },
      ]),
    ).toBe(true);
  });
});

function appointmentsQuery(data: unknown[] | null, error: unknown = null) {
  const query = {
    select: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    neq: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve({ data, error })),
  };
  return query;
}

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
  const query = appointmentsQuery(rows, rowsError);
  const from = vi.fn(() => query);
  const rpc = vi.fn((name: string) => {
    if (name === "staff_directory")
      return Promise.resolve({ data: directory, error: directoryError });
    throw new Error(`unexpected rpc ${name}`);
  });
  return { client: { from, rpc }, from, rpc, query };
}

const NOW = new Date("2026-09-30T08:00:00Z");

describe("loadPendingPayments", () => {
  it("queries appointments within the pending window, already started, and not cancelled", async () => {
    const { client, query } = fakeClient();
    await loadPendingPayments(client as never, NOW);
    expect(query.gte).toHaveBeenCalledWith(
      "starts_at",
      "2026-08-01T00:00:00+02:00",
    );
    expect(query.lte).toHaveBeenCalledWith("starts_at", NOW.toISOString());
    expect(query.neq).toHaveBeenCalledWith("status", "cancelled");
    expect(query.order).toHaveBeenCalledWith("starts_at", { ascending: true });
  });

  it("excludes an appointment that already has an active payment", async () => {
    const { client } = fakeClient({
      rows: [
        {
          id: "apt-1",
          starts_at: "2026-09-27T09:00:00Z",
          price_cents: 5500,
          payment_status: "not_required",
          payment_amount_cents: 0,
          professional_id: "prof-1",
          patient: { first_name: "Marta", last_name: "Paciente" },
          service: { name: "Consulta" },
          payments: [{ voided_at: null }],
        },
      ],
    });
    const result = await loadPendingPayments(client as never, NOW);
    expect(result).toEqual({ ok: true, data: [] });
  });

  it("keeps an appointment whose only payment was voided", async () => {
    const { client } = fakeClient({
      rows: [
        {
          id: "apt-1",
          starts_at: "2026-09-27T09:00:00Z",
          price_cents: 5500,
          payment_status: "not_required",
          payment_amount_cents: 0,
          professional_id: "prof-1",
          patient: { first_name: "Marta", last_name: "Paciente" },
          service: { name: "Consulta" },
          payments: [{ voided_at: "2026-09-27T10:00:00Z" }],
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
          suggestedAmountCents: 5500,
          href: "/?date=2026-09-27&appointment=apt-1",
        },
      ],
    });
  });

  it("falls back to a generic professional name when the directory doesn't have one", async () => {
    const { client } = fakeClient({
      rows: [
        {
          id: "apt-1",
          starts_at: "2026-09-27T09:00:00Z",
          price_cents: 5500,
          payment_status: "not_required",
          payment_amount_cents: 0,
          professional_id: "prof-1",
          patient: { first_name: "Marta", last_name: "Paciente" },
          service: { name: "Consulta" },
          payments: [],
        },
      ],
    });
    const result = await loadPendingPayments(client as never, NOW);
    expect(result.ok && result.data[0]?.professionalName).toBe("Profesional");
  });

  it("reports failure when the appointments query fails", async () => {
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

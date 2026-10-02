import { addDays } from "@clinicalumia/api/madrid-time";
import { describe, expect, it, vi } from "vitest";
import {
  cobrosListHref,
  cobrosListParams,
  formatPaymentMoment,
  loadCobros,
  MAX_RANGE_DAYS,
  momentHeader,
  paymentStateLabel,
} from "./payments-load";

const TODAY = "2026-09-30";

describe("cobrosListParams", () => {
  it("defaults to today in Madrid when no dates are given, so the page opens on the day's takings", () => {
    expect(cobrosListParams({}, TODAY)).toEqual({
      desde: TODAY,
      hasta: TODAY,
      profesionalId: null,
    });
  });

  it("keeps an explicit valid range", () => {
    expect(
      cobrosListParams({ desde: "2026-09-01", hasta: "2026-09-15" }, TODAY),
    ).toEqual({
      desde: "2026-09-01",
      hasta: "2026-09-15",
      profesionalId: null,
    });
  });

  it("falls back to today when a date is not well-formed, instead of showing a broken range", () => {
    expect(
      cobrosListParams({ desde: "2026-99-99", hasta: TODAY }, TODAY),
    ).toEqual({ desde: TODAY, hasta: TODAY, profesionalId: null });
  });

  it("falls back to today when hasta comes before desde", () => {
    expect(
      cobrosListParams({ desde: "2026-09-15", hasta: "2026-09-01" }, TODAY),
    ).toEqual({ desde: TODAY, hasta: TODAY, profesionalId: null });
  });

  it("accepts a range right at the 92-day maximum", () => {
    const desde = "2026-01-01";
    const hasta = addDays(desde, MAX_RANGE_DAYS - 1);
    expect(cobrosListParams({ desde, hasta }, TODAY)).toEqual({
      desde,
      hasta,
      profesionalId: null,
    });
  });

  it("falls back to today when the range goes one day past the 92-day maximum, so nobody loads months of data by accident", () => {
    const desde = "2026-01-01";
    const hasta = addDays(desde, MAX_RANGE_DAYS);
    expect(cobrosListParams({ desde, hasta }, TODAY)).toEqual({
      desde: TODAY,
      hasta: TODAY,
      profesionalId: null,
    });
  });

  it("keeps a well-formed professional uuid", () => {
    expect(
      cobrosListParams(
        { profesional: "a0000000-0000-0000-0000-000000000001" },
        TODAY,
      ).profesionalId,
    ).toBe("a0000000-0000-0000-0000-000000000001");
  });

  it("ignores a professional value that is not a uuid, rather than passing junk to the query", () => {
    expect(
      cobrosListParams({ profesional: "not-a-uuid" }, TODAY).profesionalId,
    ).toBeNull();
  });
});

describe("cobrosListHref", () => {
  it("always states desde and hasta explicitly", () => {
    expect(
      cobrosListHref({ desde: TODAY, hasta: TODAY, profesionalId: null }),
    ).toBe(`/cobros?desde=${TODAY}&hasta=${TODAY}`);
  });

  it("includes the professional filter only when one is set", () => {
    expect(
      cobrosListHref({
        desde: TODAY,
        hasta: TODAY,
        profesionalId: "a0000000-0000-0000-0000-000000000001",
      }),
    ).toBe(
      `/cobros?desde=${TODAY}&hasta=${TODAY}&profesional=a0000000-0000-0000-0000-000000000001`,
    );
  });
});

describe("formatPaymentMoment", () => {
  it("shows only the time for a single day, since the date is already the page's title", () => {
    expect(formatPaymentMoment("2026-09-30T08:00:00Z", false)).toBe("10:00");
  });

  it("shows the date too when the range spans more than one day, so rows from different days aren't confused", () => {
    expect(formatPaymentMoment("2026-09-30T08:00:00Z", true)).toBe(
      "30/09 10:00",
    );
  });
});

describe("momentHeader", () => {
  it("says the column is the time when the list covers one day", () => {
    expect(momentHeader(false)).toBe("Hora");
  });

  it("says the column is the date and time when the list spans several days, so staff know the date is shown", () => {
    expect(momentHeader(true)).toBe("Fecha y hora");
  });
});

describe("paymentStateLabel", () => {
  it("labels a payment that still counts as current, so the state column is never blank", () => {
    expect(
      paymentStateLabel({
        entry: "collected",
        voidedAt: null,
        voidReason: "",
      }),
    ).toBe("Válido");
  });

  it("says when a collected payment was voided later, without hiding that the money was taken that day", () => {
    expect(
      paymentStateLabel({
        entry: "collected",
        voidedAt: "2026-10-02T10:00:00Z",
        voidReason: "Cobrado por error",
      }),
    ).toBe("Anulado el 02/10");
  });

  it("shows why a payment was voided on the void's own row, instead of hiding it in a tooltip", () => {
    expect(
      paymentStateLabel({
        entry: "voided",
        voidedAt: "2026-09-30T10:00:00Z",
        voidReason: "Cobrado por error",
      }),
    ).toBe("Anulado · Cobrado por error");
  });
});

function fakeClient({
  payments = [],
  paymentsError = null,
  totals = [],
  totalsError = null,
  directory = [],
  directoryError = null,
  specialties = [],
  specialtiesError = null,
  userId = "self-1",
}: {
  payments?: unknown[];
  paymentsError?: { code?: string } | null;
  totals?: unknown[];
  totalsError?: { code?: string } | null;
  directory?: unknown[];
  directoryError?: { code?: string } | null;
  specialties?: unknown[];
  specialtiesError?: { code?: string } | null;
  userId?: string | null;
} = {}) {
  const rpc = vi.fn((name: string) => {
    if (name === "list_payments")
      return Promise.resolve({ data: payments, error: paymentsError });
    if (name === "payment_totals")
      return Promise.resolve({ data: totals, error: totalsError });
    if (name === "staff_directory")
      return Promise.resolve({ data: directory, error: directoryError });
    throw new Error(`unexpected rpc ${name}`);
  });
  const select = vi.fn(() =>
    Promise.resolve({ data: specialties, error: specialtiesError }),
  );
  const from = vi.fn(() => ({ select }));
  const auth = {
    getUser: vi.fn(() =>
      Promise.resolve({ data: { user: userId ? { id: userId } : null } }),
    ),
  };
  return { client: { rpc, from, auth }, rpc, from, select, auth };
}

describe("loadCobros", () => {
  it("asks the database for the Madrid day bounds of the range, end exclusive", async () => {
    const { client, rpc } = fakeClient();
    await loadCobros(client as never, {
      desde: "2026-09-30",
      hasta: "2026-09-30",
      profesionalId: null,
    });
    expect(rpc).toHaveBeenCalledWith("list_payments", {
      p_start: "2026-09-30T00:00:00+02:00",
      p_end: "2026-10-01T00:00:00+02:00",
      p_professional_id: undefined,
    });
  });

  it("computes the end bound in the day after's own offset, so a query on the day the clocks go back still covers the right 24 hours", async () => {
    const { client, rpc } = fakeClient();
    await loadCobros(client as never, {
      desde: "2026-10-25",
      hasta: "2026-10-25",
      profesionalId: null,
    });
    expect(rpc).toHaveBeenCalledWith("list_payments", {
      p_start: "2026-10-25T00:00:00+02:00",
      p_end: "2026-10-26T00:00:00+01:00",
      p_professional_id: undefined,
    });
  });

  it("passes the chosen professional to the database, so filtering happens in the query itself", async () => {
    const { client, rpc } = fakeClient();
    await loadCobros(client as never, {
      desde: "2026-09-30",
      hasta: "2026-09-30",
      profesionalId: "prof-2",
    });
    expect(rpc).toHaveBeenCalledWith(
      "list_payments",
      expect.objectContaining({ p_professional_id: "prof-2" }),
    );
  });

  it("builds the professional filter options with their specialty, sorted by name", async () => {
    const { client } = fakeClient({
      directory: [
        {
          id: "prof-2",
          full_name: "Zoe Profesional",
          role: "employee",
          specialty_id: "spec-1",
        },
        {
          id: "prof-1",
          full_name: "Ana Profesional",
          role: "employee",
          specialty_id: null,
        },
      ],
      specialties: [{ id: "spec-1", name: "Psicología" }],
    });
    const result = await loadCobros(client as never, {
      desde: "2026-09-30",
      hasta: "2026-09-30",
      profesionalId: null,
    });
    expect(result).toEqual({
      ok: true,
      data: {
        payments: [],
        staffOptions: [
          { id: "prof-1", fullName: "Ana Profesional", specialtyName: null },
          {
            id: "prof-2",
            fullName: "Zoe Profesional",
            specialtyName: "Psicología",
          },
        ],
        nameById: new Map([
          ["prof-1", "Ana Profesional"],
          ["prof-2", "Zoe Profesional"],
        ]),
        isOwner: false,
        totals: { methods: [], total: 0 },
        truncated: false,
      },
    });
  });

  it("knows the signed-in staff member is the owner, so the page can show the professional filter", async () => {
    const { client } = fakeClient({
      directory: [
        {
          id: "self-1",
          full_name: "Propietaria",
          role: "owner",
          specialty_id: null,
        },
      ],
      userId: "self-1",
    });
    const result = await loadCobros(client as never, {
      desde: "2026-09-30",
      hasta: "2026-09-30",
      profesionalId: null,
    });
    expect(result.ok && result.data.isOwner).toBe(true);
  });

  it("knows the signed-in staff member is not the owner, so the page hides the professional filter", async () => {
    const { client } = fakeClient({
      directory: [
        {
          id: "self-1",
          full_name: "Empleada",
          role: "employee",
          specialty_id: null,
        },
      ],
      userId: "self-1",
    });
    const result = await loadCobros(client as never, {
      desde: "2026-09-30",
      hasta: "2026-09-30",
      profesionalId: null,
    });
    expect(result.ok && result.data.isOwner).toBe(false);
  });

  it("maps a payment row and its void row, each on its own moment, so a void shows on the day it happened", async () => {
    const source = {
      id: "pay-1",
      collected_at: "2026-09-30T09:00:00Z",
      amount_cents: 4500,
      method: "cash",
      collected_by: "prof-1",
      voided_at: "2026-10-02T10:00:00Z",
      void_reason: "Cobrado por error",
      professional_id: "prof-1",
      patient_id: "pat-1",
      patient_name: "Marta Paciente",
      service_name: "Consulta",
    };
    const { client } = fakeClient({
      payments: [
        { ...source, entry: "collected", moment: "2026-09-30T09:00:00Z" },
        {
          ...source,
          entry: "voided",
          moment: "2026-10-02T10:00:00Z",
          amount_cents: -4500,
        },
      ],
    });
    const result = await loadCobros(client as never, {
      desde: "2026-09-30",
      hasta: "2026-10-02",
      profesionalId: null,
    });
    const row = {
      id: "pay-1",
      collectedAt: "2026-09-30T09:00:00Z",
      method: "cash",
      collectedBy: "prof-1",
      voidedAt: "2026-10-02T10:00:00Z",
      voidReason: "Cobrado por error",
      professionalId: "prof-1",
      patientId: "pat-1",
      patientName: "Marta Paciente",
      serviceName: "Consulta",
    };
    expect(result.ok && result.data.payments).toEqual([
      {
        ...row,
        entry: "collected",
        moment: "2026-09-30T09:00:00Z",
        amountCents: 4500,
      },
      {
        ...row,
        entry: "voided",
        moment: "2026-10-02T10:00:00Z",
        amountCents: -4500,
      },
    ]);
  });

  it("reports failure when any of the reads fails, instead of showing a partial or wrong reconciliation", async () => {
    const { client } = fakeClient({ paymentsError: { code: "XX000" } });
    const result = await loadCobros(client as never, {
      desde: "2026-09-30",
      hasta: "2026-09-30",
      profesionalId: null,
    });
    expect(result).toEqual({ ok: false });
  });

  it("asks the database for the totals over the same range and professional, so they cover every payment even when the list is cut short", async () => {
    const { client, rpc } = fakeClient();
    await loadCobros(client as never, {
      desde: "2026-09-30",
      hasta: "2026-09-30",
      profesionalId: "prof-2",
    });
    expect(rpc).toHaveBeenCalledWith("payment_totals", {
      p_start: "2026-09-30T00:00:00+02:00",
      p_end: "2026-10-01T00:00:00+02:00",
      p_professional_id: "prof-2",
    });
  });

  it("keeps a method whose voids outweigh its takings in the range, so the money given back is not hidden and the total matches Facturación", async () => {
    const { client } = fakeClient({
      totals: [
        { method: "cash", cents: -4500 },
        { method: "card", cents: 5500 },
      ],
    });
    const result = await loadCobros(client as never, {
      desde: "2026-10-01",
      hasta: "2026-10-31",
      profesionalId: null,
    });
    expect(result.ok && result.data.totals).toEqual({
      methods: [
        { method: "cash", cents: -4500 },
        { method: "card", cents: 5500 },
      ],
      total: 1000,
    });
  });

  it("uses the database totals per method, leaving out methods that add up to nothing", async () => {
    const { client } = fakeClient({
      totals: [
        { method: "cash", cents: 5500 },
        { method: "card", cents: 0 },
        { method: "transfer", cents: 700 },
      ],
    });
    const result = await loadCobros(client as never, {
      desde: "2026-09-30",
      hasta: "2026-09-30",
      profesionalId: null,
    });
    expect(result.ok && result.data.totals).toEqual({
      methods: [
        { method: "cash", cents: 5500 },
        { method: "transfer", cents: 700 },
      ],
      total: 6200,
    });
  });

  it("flags the list as cut short when the database returns its maximum of 1000 rows, so nobody takes a partial list as complete", async () => {
    const { client } = fakeClient({
      payments: Array.from({ length: 1000 }, (_, index) => ({
        id: `pay-${index}`,
        entry: "collected",
        moment: "2026-09-30T09:00:00Z",
        collected_at: "2026-09-30T09:00:00Z",
        amount_cents: 100,
        method: "cash",
        collected_by: "prof-1",
        voided_at: null,
        void_reason: "",
        professional_id: "prof-1",
        patient_id: "pat-1",
        patient_name: "Marta Paciente",
        service_name: "Consulta",
      })),
    });
    const result = await loadCobros(client as never, {
      desde: "2026-09-30",
      hasta: "2026-09-30",
      profesionalId: null,
    });
    expect(result.ok && result.data.truncated).toBe(true);
  });

  it("reports failure when the totals fail to load, instead of showing a wrong reconciliation", async () => {
    const { client } = fakeClient({ totalsError: { code: "XX000" } });
    const result = await loadCobros(client as never, {
      desde: "2026-09-30",
      hasta: "2026-09-30",
      profesionalId: null,
    });
    expect(result).toEqual({ ok: false });
  });
});

import type { InvoiceSnapshot } from "@clinicalumia/invoices";
import { unzipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuarterInvoice } from "./quarter-summary";
import { quarterZip } from "./quarter-zip";

const fakePdf = vi.hoisted(() => ({ bytes: 0 }));
const render = vi.hoisted(() => vi.fn());

vi.mock("@clinicalumia/invoices", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@clinicalumia/invoices")>();
  return {
    ...actual,
    renderInvoicePdf: (...args: Parameters<typeof actual.renderInvoicePdf>) => {
      render(...args);
      return fakePdf.bytes > 0
        ? Promise.resolve(new Uint8Array(fakePdf.bytes))
        : actual.renderInvoicePdf(...args);
    },
  };
});

const LIMIT = 50 * 1024 * 1024;

const snapshot: InvoiceSnapshot = {
  issuer: {
    name: "Patricia Hernán Sánchez",
    tax_id: "20449989E",
    address_line: "Calle Montesa 7",
    postal_code: "46800",
    city: "Xàtiva",
    province: "Valencia",
    phone: "",
    email: "",
    website: "",
  },
  recipient: null,
  lines: [
    {
      description: "Psicoterapia individual",
      session_date: "2026-08-10",
      patient: "María L.",
      quantity: 1,
      base_cents: 5500,
      vat_rate: 0,
      vat_cents: 0,
      total_cents: 5500,
    },
  ],
  totals: { base_cents: 5500, vat_cents: 0, total_cents: 5500 },
  vat: "exempt",
  vat_note: "Exenta de IVA (art. 20.Uno.3.º LIVA)",
  payments: [{ method: "card", amount_cents: 5500 }],
  footer: "",
};

const invoices: QuarterInvoice[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    code: "1347/26",
    kind: "simplified",
    status: "issued",
    issued_at: "2026-07-02T10:00:00+02:00",
    replaces: null,
    rectifies: null,
    replaced_by: null,
    snapshot,
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    code: "R3/26",
    kind: "rectifying",
    status: "issued",
    issued_at: "2026-08-14T18:30:00+02:00",
    replaces: null,
    rectifies: "1347/26",
    replaced_by: null,
    snapshot: {
      ...snapshot,
      lines: snapshot.lines.map((line) => ({
        ...line,
        base_cents: -5500,
        total_cents: -5500,
      })),
      totals: { base_cents: -5500, vat_cents: 0, total_cents: -5500 },
      rectifies: { code: "1347/26", issued_on: "2026-07-02" },
      reason: "Importe erróneo",
    },
  },
];

function detailOf(invoice: QuarterInvoice) {
  return {
    id: invoice.id,
    code: invoice.code,
    kind: invoice.kind,
    status: invoice.status,
    issued_at: invoice.issued_at,
    total_cents: invoice.snapshot.totals.total_cents,
    reason: invoice.snapshot.reason ?? "",
    payment_id: "22222222-2222-2222-2222-222222222222",
    appointment_id: "33333333-3333-3333-3333-333333333333",
    patient_id: "44444444-4444-4444-4444-444444444444",
    professional_id: "55555555-5555-5555-5555-555555555555",
    snapshot: invoice.snapshot,
    related: {
      replaces: null,
      replaced_by: null,
      rectifies: null,
      rectified_by: null,
    },
    qr: { nif: invoice.snapshot.issuer.tax_id },
  };
}

function fakeSupabase(
  list: QuarterInvoice[] = invoices,
  {
    failingId,
    delay,
  }: { failingId?: string; delay?: (id: string) => number } = {},
) {
  const inFlight = { now: 0, max: 0 };
  const rpc = vi.fn((_name: string, args: { p_invoice_id: string }) => ({
    single: async () => {
      inFlight.now += 1;
      inFlight.max = Math.max(inFlight.max, inFlight.now);
      await new Promise((resolve) =>
        setTimeout(resolve, delay?.(args.p_invoice_id) ?? 0),
      );
      inFlight.now -= 1;
      if (args.p_invoice_id === failingId)
        return { data: null, error: { message: "invoice_not_found" } };
      const invoice = list.find(({ id }) => id === args.p_invoice_id)!;
      return { data: detailOf(invoice), error: null };
    },
  }));
  const from = vi.fn(() => ({
    select: () => ({ maybeSingle: async () => ({ data: null }) }),
  }));
  return Object.assign(
    { rpc, from } as unknown as Parameters<typeof quarterZip>[0],
    { rpc, from, inFlight },
  );
}

function manyInvoices(count: number): QuarterInvoice[] {
  return Array.from({ length: count }, (_, index) => ({
    ...invoices[0]!,
    id: `00000000-0000-0000-0000-${String(index + 10).padStart(12, "0")}`,
    code: `${index + 1}/26`,
  }));
}

beforeEach(() => {
  fakePdf.bytes = 0;
  render.mockClear();
});

const ascii = (bytes: Uint8Array, length: number) =>
  String.fromCharCode(...bytes.slice(0, length));

describe("quarterZip", () => {
  it("packs one PDF per invoice, named after its code so the gestoría can match it with the ledger, plus the ledger itself", async () => {
    const supabase = fakeSupabase();
    const result = await quarterZip(supabase, {
      year: 2026,
      q: 3,
      invoices,
      maxBytes: LIMIT,
    });
    if (!("zip" in result)) throw new Error("expected a zip");
    const entries = unzipSync(result.zip);
    expect(Object.keys(entries).sort()).toEqual([
      "1347-26.pdf",
      "LUMIA-facturas-2026-T3.xlsx",
      "R3-26.pdf",
    ]);
    expect(ascii(entries["1347-26.pdf"]!, 4)).toBe("%PDF");
    expect(ascii(entries["R3-26.pdf"]!, 4)).toBe("%PDF");
    expect(ascii(entries["LUMIA-facturas-2026-T3.xlsx"]!, 2)).toBe("PK");
  }, 30_000);

  it("renders each PDF from the same invoice detail the panel uses, so the copy in the ZIP matches the one already handed to the patient", async () => {
    const supabase = fakeSupabase();
    await quarterZip(supabase, { year: 2026, q: 3, invoices, maxBytes: LIMIT });
    expect(supabase.rpc.mock.calls.map(([name, args]) => [name, args])).toEqual(
      invoices.map(({ id }) => ["invoice_detail", { p_invoice_id: id }]),
    );
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledWith("clinic_settings");
  }, 30_000);

  it("fails instead of handing over a ZIP with an invoice missing", async () => {
    const supabase = fakeSupabase(invoices, { failingId: invoices[1]!.id });
    await expect(
      quarterZip(supabase, { year: 2026, q: 3, invoices, maxBytes: LIMIT }),
    ).rejects.toThrow("No se ha podido generar la factura R3/26");
  }, 30_000);

  it("stops rendering as soon as the PDFs pass the storage limit, so a heavy logo does not burn minutes of CPU or exhaust memory before saying no", async () => {
    fakePdf.bytes = 20 * 1024 * 1024;
    const list = manyInvoices(10);
    const supabase = fakeSupabase(list);
    const result = await quarterZip(supabase, {
      year: 2026,
      q: 3,
      invoices: list,
      maxBytes: LIMIT,
    });
    expect(result).toEqual({ tooLarge: true });
    expect(render).toHaveBeenCalledTimes(3);
    expect(supabase.rpc.mock.calls.length).toBeLessThan(list.length);
  });

  it("refuses a ZIP whose PDFs fit but whose ledger and headers push it past the limit", async () => {
    fakePdf.bytes = 1000;
    const supabase = fakeSupabase();
    const result = await quarterZip(supabase, {
      year: 2026,
      q: 3,
      invoices,
      maxBytes: 2100,
    });
    expect(result).toEqual({ tooLarge: true });
  });

  it("fetches a few invoice details at a time but keeps the ledger order in the ZIP", async () => {
    fakePdf.bytes = 10;
    const list = manyInvoices(10);
    const supabase = fakeSupabase(list, {
      delay: (id) => 30 - list.findIndex((invoice) => invoice.id === id) * 3,
    });
    const result = await quarterZip(supabase, {
      year: 2026,
      q: 3,
      invoices: list,
      maxBytes: LIMIT,
    });
    if (!("zip" in result)) throw new Error("expected a zip");
    expect(Object.keys(unzipSync(result.zip))).toEqual([
      ...list.map(({ code }) => `${code.replace("/", "-")}.pdf`),
      "LUMIA-facturas-2026-T3.xlsx",
    ]);
    expect(supabase.inFlight.max).toBeGreaterThan(1);
    expect(supabase.inFlight.max).toBeLessThanOrEqual(4);
  });
});

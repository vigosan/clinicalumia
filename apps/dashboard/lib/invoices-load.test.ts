import { describe, expect, it, vi } from "vitest";
import {
  formatInvoiceDate,
  INVOICE_KIND_OPTIONS,
  INVOICES_PAGE_SIZE,
  invoiceKindLabel,
  invoiceRecipientLabel,
  invoiceStatusLabel,
  invoicesListHref,
  invoicesListParams,
  invoicesPageCount,
  loadInvoices,
} from "./invoices-load";

const TODAY = "2026-09-30";

describe("invoicesListParams", () => {
  it("defaults to the current month in Madrid, so the page opens on this month's invoices", () => {
    expect(invoicesListParams({}, TODAY)).toEqual({
      desde: "2026-09-01",
      hasta: "2026-09-30",
      kind: "",
      q: "",
      profesionalId: null,
      page: 1,
    });
  });

  it("uses the last day of the current month even when it has fewer than 30 days", () => {
    expect(invoicesListParams({}, "2026-02-10")).toMatchObject({
      desde: "2026-02-01",
      hasta: "2026-02-28",
    });
  });

  it("keeps an explicit valid range", () => {
    expect(
      invoicesListParams({ desde: "2026-01-01", hasta: "2026-01-15" }, TODAY),
    ).toMatchObject({ desde: "2026-01-01", hasta: "2026-01-15" });
  });

  it("falls back to the current month when a date is not well-formed", () => {
    expect(
      invoicesListParams({ desde: "2026-99-99", hasta: TODAY }, TODAY),
    ).toMatchObject({ desde: "2026-09-01", hasta: "2026-09-30" });
  });

  it("falls back to the current month when hasta comes before desde", () => {
    expect(
      invoicesListParams({ desde: "2026-09-15", hasta: "2026-09-01" }, TODAY),
    ).toMatchObject({ desde: "2026-09-01", hasta: "2026-09-30" });
  });

  it("only accepts a known invoice kind, so a tampered URL cannot request an invalid filter", () => {
    expect(invoicesListParams({ tipo: "full" }, TODAY).kind).toBe("full");
    expect(invoicesListParams({ tipo: "nope" }, TODAY).kind).toBe("");
  });

  it("only accepts a professional id shaped like a uuid", () => {
    expect(
      invoicesListParams(
        { profesional: "8b000000-0000-0000-0000-000000000001" },
        TODAY,
      ).profesionalId,
    ).toBe("8b000000-0000-0000-0000-000000000001");
    expect(
      invoicesListParams({ profesional: "not-a-uuid" }, TODAY).profesionalId,
    ).toBe(null);
  });

  it("defaults the page to 1 when it is missing or not a positive integer", () => {
    expect(invoicesListParams({ pagina: "3" }, TODAY).page).toBe(3);
    expect(invoicesListParams({ pagina: "0" }, TODAY).page).toBe(1);
    expect(invoicesListParams({ pagina: "abc" }, TODAY).page).toBe(1);
  });
});

describe("invoicesListHref", () => {
  it("only includes non-default filters, so the plain page keeps a clean url", () => {
    expect(
      invoicesListHref({
        desde: "2026-09-01",
        hasta: "2026-09-30",
        kind: "",
        q: "",
        profesionalId: null,
        page: 1,
      }),
    ).toBe("/facturas?desde=2026-09-01&hasta=2026-09-30");
  });

  it("adds tipo, q, profesional and pagina when set", () => {
    expect(
      invoicesListHref({
        desde: "2026-09-01",
        hasta: "2026-09-30",
        kind: "rectifying",
        q: "García",
        profesionalId: "8b000000-0000-0000-0000-000000000001",
        page: 2,
      }),
    ).toBe(
      "/facturas?desde=2026-09-01&hasta=2026-09-30&tipo=rectifying&q=Garc%C3%ADa&profesional=8b000000-0000-0000-0000-000000000001&pagina=2",
    );
  });
});

describe("INVOICE_KIND_OPTIONS", () => {
  it("offers the four options with the required Spanish labels", () => {
    expect(INVOICE_KIND_OPTIONS).toEqual([
      { value: "", label: "Todas" },
      { value: "simplified", label: "Simplificadas" },
      { value: "full", label: "Completas" },
      { value: "rectifying", label: "Rectificativas" },
    ]);
  });
});

describe("invoiceKindLabel", () => {
  it("labels each kind in Spanish", () => {
    expect(invoiceKindLabel("simplified")).toBe("Simplificada");
    expect(invoiceKindLabel("full")).toBe("Completa");
    expect(invoiceKindLabel("rectifying")).toBe("Rectificativa");
  });
});

describe("invoiceStatusLabel", () => {
  it("says the invoice was replaced by the one that supersedes it", () => {
    expect(
      invoiceStatusLabel({
        status: "replaced",
        replacedByCode: "9/26",
        rectifiedByCode: null,
      }),
    ).toBe("Sustituida por 9/26");
  });

  it("says the invoice was rectified by the one that compensates it", () => {
    expect(
      invoiceStatusLabel({
        status: "issued",
        replacedByCode: null,
        rectifiedByCode: "R1/26",
      }),
    ).toBe("Rectificada por R1/26");
  });

  it("otherwise the invoice is simply issued", () => {
    expect(
      invoiceStatusLabel({
        status: "issued",
        replacedByCode: null,
        rectifiedByCode: null,
      }),
    ).toBe("Emitida");
  });
});

describe("invoiceRecipientLabel", () => {
  it("shows the recipient name for a full invoice", () => {
    expect(
      invoiceRecipientLabel({
        recipientName: "Tutor Ñandú García",
        patientName: "Lucía Martínez López",
      }),
    ).toBe("Tutor Ñandú García");
  });

  it("falls back to the patient's name for a simplified invoice, which has no recipient", () => {
    expect(
      invoiceRecipientLabel({
        recipientName: null,
        patientName: "Lucía Martínez López",
      }),
    ).toBe("Lucía Martínez López");
  });
});

describe("invoicesPageCount", () => {
  it("is always at least 1, even with no invoices", () => {
    expect(invoicesPageCount(0)).toBe(1);
  });

  it("rounds up to the next full page", () => {
    expect(invoicesPageCount(INVOICES_PAGE_SIZE + 1)).toBe(2);
    expect(invoicesPageCount(INVOICES_PAGE_SIZE * 2)).toBe(2);
  });
});

describe("formatInvoiceDate", () => {
  it("formats the issue instant as a Madrid day", () => {
    expect(formatInvoiceDate("2026-09-30T08:00:00Z")).toBe("30/09/2026");
  });
});

function fakeClient({
  invoices = [],
  invoicesError = null,
  directory = [],
  directoryError = null,
  specialties = [],
  specialtiesError = null,
  userId = "self-1",
}: {
  invoices?: unknown[];
  invoicesError?: { code?: string; message?: string } | null;
  directory?: unknown[];
  directoryError?: { code?: string } | null;
  specialties?: unknown[];
  specialtiesError?: { code?: string } | null;
  userId?: string | null;
} = {}) {
  const rpc = vi.fn((name: string) => {
    if (name === "list_invoices")
      return Promise.resolve({ data: invoices, error: invoicesError });
    if (name === "staff_directory")
      return Promise.resolve({ data: directory, error: directoryError });
    throw new Error(`unexpected rpc ${name}`);
  });
  const select = vi.fn(() =>
    Promise.resolve({ data: specialties, error: specialtiesError }),
  );
  const client = {
    rpc,
    from: vi.fn(() => ({ select })),
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: userId ? { id: userId } : null } }),
    },
  };
  return { client, rpc };
}

describe("loadInvoices", () => {
  it("asks the database with the mapped filters and the page's limit and offset", async () => {
    const { client, rpc } = fakeClient();
    await loadInvoices(client as never, {
      desde: "2026-09-01",
      hasta: "2026-09-30",
      kind: "full",
      q: "García",
      profesionalId: "8b000000-0000-0000-0000-000000000001",
      page: 2,
    });
    expect(rpc).toHaveBeenCalledWith("list_invoices", {
      p_start: "2026-09-01",
      p_end: "2026-09-30",
      p_kind: "full",
      p_query: "García",
      p_professional_id: "8b000000-0000-0000-0000-000000000001",
      p_limit: INVOICES_PAGE_SIZE,
      p_offset: INVOICES_PAGE_SIZE,
    });
  });

  it("omits the kind, query and professional when they are unset", async () => {
    const { client, rpc } = fakeClient();
    await loadInvoices(client as never, {
      desde: "2026-09-01",
      hasta: "2026-09-30",
      kind: "",
      q: "",
      profesionalId: null,
      page: 1,
    });
    expect(rpc).toHaveBeenCalledWith("list_invoices", {
      p_start: "2026-09-01",
      p_end: "2026-09-30",
      p_kind: undefined,
      p_query: undefined,
      p_professional_id: undefined,
      p_limit: INVOICES_PAGE_SIZE,
      p_offset: 0,
    });
  });

  it("maps the rows and reads the total count from the first row", async () => {
    const { client } = fakeClient({
      invoices: [
        {
          id: "inv-1",
          code: "9/26",
          kind: "full",
          status: "issued",
          issued_at: "2026-09-30T08:00:00Z",
          total_cents: 4500,
          recipient_name: "Tutor García",
          patient_id: "p-1",
          patient_name: "Lucía Martínez",
          professional_id: "prof-1",
          replaced_by_code: null,
          rectified_by_code: "R1/26",
          total_count: 1,
        },
      ],
    });
    const result = await loadInvoices(client as never, {
      desde: "2026-09-01",
      hasta: "2026-09-30",
      kind: "",
      q: "",
      profesionalId: null,
      page: 1,
    });
    expect(result).toMatchObject({
      ok: true,
      data: {
        totalCount: 1,
        isOwner: false,
        rows: [
          {
            id: "inv-1",
            code: "9/26",
            kind: "full",
            status: "issued",
            recipientName: "Tutor García",
            patientName: "Lucía Martínez",
            replacedByCode: null,
            rectifiedByCode: "R1/26",
          },
        ],
      },
    });
  });

  it("gives a null total count when the page has no rows, so the caller knows it went past the end", async () => {
    const { client } = fakeClient({ invoices: [] });
    const result = await loadInvoices(client as never, {
      desde: "2026-09-01",
      hasta: "2026-09-30",
      kind: "",
      q: "",
      profesionalId: null,
      page: 3,
    });
    expect(result).toMatchObject({
      ok: true,
      data: { rows: [], totalCount: null },
    });
  });

  it("marks the owner from the staff directory", async () => {
    const { client } = fakeClient({
      directory: [{ id: "self-1", full_name: "Propietaria", role: "owner" }],
    });
    const result = await loadInvoices(client as never, {
      desde: "2026-09-01",
      hasta: "2026-09-30",
      kind: "",
      q: "",
      profesionalId: null,
      page: 1,
    });
    expect(result).toMatchObject({ ok: true, data: { isOwner: true } });
  });

  it("fails when the invoices query errors", async () => {
    const { client } = fakeClient({ invoicesError: { code: "42501" } });
    const result = await loadInvoices(client as never, {
      desde: "2026-09-01",
      hasta: "2026-09-30",
      kind: "",
      q: "",
      profesionalId: null,
      page: 1,
    });
    expect(result).toEqual({ ok: false });
  });
});

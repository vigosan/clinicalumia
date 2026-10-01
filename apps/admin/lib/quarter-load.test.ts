import { describe, expect, it, vi } from "vitest";
import { quarterRange } from "./quarter";
import { loadQuarterInvoices, QUARTER_PAGE_SIZE } from "./quarter-load";

type Page = { data: unknown[] | null; error: { message: string } | null };

function fakeClient(pages: Page[]) {
  const calls = {
    from: vi.fn(),
    select: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  };
  let page = 0;
  const builder = {
    select: (...args: unknown[]) => {
      calls.select(...args);
      return builder;
    },
    gte: (...args: unknown[]) => {
      calls.gte(...args);
      return builder;
    },
    lt: (...args: unknown[]) => {
      calls.lt(...args);
      return builder;
    },
    order: (...args: unknown[]) => {
      calls.order(...args);
      return builder;
    },
    range: (...args: unknown[]) => {
      calls.range(...args);
      return Promise.resolve(pages[page++] ?? { data: [], error: null });
    },
  };
  const client = {
    from: (table: string) => {
      calls.from(table);
      return builder;
    },
  };
  return { client, calls };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    code: "1/26",
    kind: "simplified",
    status: "issued",
    issued_at: "2026-07-02T08:00:00+00:00",
    snapshot: { lines: [] },
    replaces: null,
    rectifies: null,
    replaced_by: [],
    ...overrides,
  };
}

describe("loadQuarterInvoices", () => {
  it("asks only for invoices issued inside the quarter's Madrid bounds, end excluded", async () => {
    const { client, calls } = fakeClient([{ data: [], error: null }]);
    await loadQuarterInvoices(client as never, 2026, 3);
    const { from, to } = quarterRange(2026, 3);
    expect(calls.from).toHaveBeenCalledWith("invoices");
    expect(calls.gte).toHaveBeenCalledWith("issued_at", from);
    expect(calls.lt).toHaveBeenCalledWith("issued_at", to);
  });

  it("selects only the columns the summary needs, with the related invoices' codes", async () => {
    const { client, calls } = fakeClient([{ data: [], error: null }]);
    await loadQuarterInvoices(client as never, 2026, 3);
    const columns = String(calls.select.mock.calls[0]?.[0]).replace(/\s+/g, "");
    expect(columns).toBe(
      "id,code,kind,status,issued_at,snapshot,replaces:replaces_invoice_id(code),rectifies:rectifies_invoice_id(code),replaced_by:invoices!replaces_invoice_id(code)",
    );
  });

  it("flattens the related invoices to their codes, so the ledger can say who replaces or rectifies whom", async () => {
    const { client } = fakeClient([
      {
        data: [
          row({ status: "replaced", replaced_by: [{ code: "2/26" }] }),
          row({ code: "2/26", kind: "full", replaces: { code: "1/26" } }),
          row({
            code: "R1/26",
            kind: "rectifying",
            rectifies: { code: "3/26" },
          }),
        ],
        error: null,
      },
    ]);
    const result = await loadQuarterInvoices(client as never, 2026, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.invoices.map(({ code, replaces, rectifies, replaced_by }) => ({
        code,
        replaces,
        rectifies,
        replaced_by,
      })),
    ).toEqual([
      { code: "1/26", replaces: null, rectifies: null, replaced_by: "2/26" },
      { code: "2/26", replaces: "1/26", rectifies: null, replaced_by: null },
      { code: "R1/26", replaces: null, rectifies: "3/26", replaced_by: null },
    ]);
  });

  it("keeps reading pages until the last one, so a big quarter is never cut at the API's row limit", async () => {
    const full = Array.from({ length: QUARTER_PAGE_SIZE }, (_, index) =>
      row({ code: `${index + 1}/26` }),
    );
    const { client, calls } = fakeClient([
      { data: full, error: null },
      { data: [row({ code: "last/26" })], error: null },
    ]);
    const result = await loadQuarterInvoices(client as never, 2026, 3);
    expect(calls.range.mock.calls).toEqual([
      [0, QUARTER_PAGE_SIZE - 1],
      [QUARTER_PAGE_SIZE, 2 * QUARTER_PAGE_SIZE - 1],
    ]);
    expect(result.ok && result.invoices.length).toBe(QUARTER_PAGE_SIZE + 1);
  });

  it("orders by issue date and id, so pages do not overlap or skip rows", async () => {
    const { client, calls } = fakeClient([{ data: [], error: null }]);
    await loadQuarterInvoices(client as never, 2026, 3);
    expect(calls.order.mock.calls).toEqual([
      ["issued_at", { ascending: true }],
      ["id", { ascending: true }],
    ]);
  });

  it("reports a failure instead of showing a partial quarter", async () => {
    const full = Array.from({ length: QUARTER_PAGE_SIZE }, () => row());
    const { client } = fakeClient([
      { data: full, error: null },
      { data: null, error: { message: "boom" } },
    ]);
    expect(await loadQuarterInvoices(client as never, 2026, 3)).toEqual({
      ok: false,
    });
  });
});

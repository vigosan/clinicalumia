import { describe, expect, it, vi } from "vitest";
import { loadNavCounts } from "./nav-counts";

const NOW = new Date("2026-09-30T08:00:00Z");

function fakeClient({
  consentsCount = 0,
  consentsError = null,
  pendingRows = [],
  pendingError = null,
}: {
  consentsCount?: number | null;
  consentsError?: { code?: string } | null;
  pendingRows?: unknown[] | null;
  pendingError?: { code?: string } | null;
} = {}) {
  const query = {
    select: vi.fn(() => query),
    is: vi.fn(() =>
      Promise.resolve({ data: [], error: consentsError, count: consentsCount }),
    ),
  };
  const from = vi.fn(() => query);
  const rpc = vi.fn((name: string) => {
    if (name === "pending_payments")
      return Promise.resolve({ data: pendingRows, error: pendingError });
    throw new Error(`unexpected rpc ${name}`);
  });
  return { client: { from, rpc }, from, query, rpc };
}

describe("loadNavCounts", () => {
  it("counts consents still waiting for a person and pending payments, so the sidebar matches each page's own «Pendientes» list", async () => {
    const { client } = fakeClient({
      consentsCount: 3,
      pendingRows: [{ appointment_id: "apt-1" }, { appointment_id: "apt-2" }],
    });
    expect(await loadNavCounts(client as never, NOW)).toEqual({
      consentimientos: 3,
      cobros: 2,
    });
  });

  it("omits a counter when its count is zero, so an empty tray never shows a pill", async () => {
    const { client } = fakeClient({ consentsCount: 0, pendingRows: [] });
    expect(await loadNavCounts(client as never, NOW)).toEqual({
      consentimientos: undefined,
      cobros: undefined,
    });
  });

  it("omits a counter when its query fails, so a broken count never breaks the layout", async () => {
    const { client } = fakeClient({
      consentsError: { code: "XX000" },
      pendingError: { code: "XX000" },
    });
    expect(await loadNavCounts(client as never, NOW)).toEqual({
      consentimientos: undefined,
      cobros: undefined,
    });
  });
});

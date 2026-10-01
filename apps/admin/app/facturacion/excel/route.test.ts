import { beforeEach, describe, expect, it, vi } from "vitest";

const owner: {
  result: { ok: true; userId: string } | { ok: false; error: string };
} = {
  result: { ok: true, userId: "owner-id" },
};
const load = vi.fn();

vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({}),
}));
vi.mock("@clinicalumia/api/auth", () => ({
  requireOwner: async () => owner.result,
}));
vi.mock("@/lib/quarter-load", () => ({
  loadQuarterInvoices: (...args: unknown[]) => load(...args),
}));

const { GET } = await import("./route");

function get(search: string) {
  return GET(new Request(`http://localhost:3002/facturacion/excel${search}`));
}

beforeEach(() => {
  owner.result = { ok: true, userId: "owner-id" };
  load.mockReset();
  load.mockResolvedValue({ ok: true, invoices: [] });
});

describe("GET /facturacion/excel", () => {
  it("downloads the quarter's ledger as a private xlsx named after the quarter", async () => {
    const response = await get("?year=2026&q=3");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="LUMIA-facturas-2026-T3.xlsx"',
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(String.fromCharCode(bytes[0]!, bytes[1]!)).toBe("PK");
    expect(load).toHaveBeenCalledWith(expect.anything(), 2026, 3);
  });

  it("refuses anyone who is not the owner before reading any invoice, since the file holds every patient's billing", async () => {
    owner.result = { ok: false, error: "No tienes permiso para hacer esto." };
    const response = await get("?year=2026&q=3");
    expect(response.status).toBe(403);
    expect(await response.text()).toBe("No tienes permiso para hacer esto.");
    expect(load).not.toHaveBeenCalled();
  });

  it("answers 400 in Spanish to a year or quarter that does not exist, instead of exporting some other period", async () => {
    for (const search of [
      "",
      "?year=2026",
      "?year=2026&q=5",
      "?year=abc&q=1",
    ]) {
      const response = await get(search);
      expect(response.status).toBe(400);
      expect(await response.text()).toBe(
        "El año o el trimestre no son válidos.",
      );
    }
    expect(load).not.toHaveBeenCalled();
  });

  it("fails loudly instead of downloading an empty or partial ledger when the invoices cannot be read", async () => {
    load.mockResolvedValue({ ok: false });
    await expect(get("?year=2026&q=3")).rejects.toThrow(
      "No se ha podido cargar el trimestre.",
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const owner: {
  result: { ok: true; userId: string } | { ok: false; error: string };
} = {
  result: { ok: true, userId: "owner-id" },
};
const load = vi.fn();
const zip = vi.fn();
const calls: string[] = [];
const storage = {
  list: vi.fn(),
  remove: vi.fn(),
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
};
const bucket = vi.fn();

vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    storage: {
      from: (name: string) => {
        bucket(name);
        return storage;
      },
    },
  }),
}));
vi.mock("@clinicalumia/api/auth", () => ({
  requireOwner: async () => owner.result,
}));
vi.mock("@/lib/quarter-load", () => ({
  loadQuarterInvoices: (...args: unknown[]) => load(...args),
}));
vi.mock("@/lib/quarter-zip", () => ({
  quarterZip: (...args: unknown[]) => zip(...args),
}));

const { POST, maxDuration } = await import("./route");

const INVOICES = [{ id: "invoice-1", code: "1/26" }];
const ZIP_BYTES = new Uint8Array([0x50, 0x4b, 3, 4]);
const UUID = /^owner-id\/[0-9a-f-]{36}\.zip$/;

function post(search: string) {
  return POST(
    new Request(`http://localhost:3002/facturacion/zip${search}`, {
      method: "POST",
    }),
  );
}

beforeEach(() => {
  owner.result = { ok: true, userId: "owner-id" };
  calls.length = 0;
  bucket.mockReset();
  load.mockReset();
  load.mockResolvedValue({ ok: true, invoices: INVOICES });
  zip.mockReset();
  zip.mockImplementation(async () => {
    calls.push("zip");
    return ZIP_BYTES;
  });
  storage.list.mockReset();
  storage.list.mockImplementation(async () => {
    calls.push("list");
    return { data: [{ name: "old.zip" }], error: null };
  });
  storage.remove.mockReset();
  storage.remove.mockImplementation(async () => {
    calls.push("remove");
    return { data: [], error: null };
  });
  storage.upload.mockReset();
  storage.upload.mockImplementation(async () => {
    calls.push("upload");
    return { data: {}, error: null };
  });
  storage.createSignedUrl.mockReset();
  storage.createSignedUrl.mockResolvedValue({
    data: { signedUrl: "http://127.0.0.1:54321/signed" },
    error: null,
  });
});

describe("POST /facturacion/zip", () => {
  it("gives the PDFs a whole quarter needs time to render", () => {
    expect(maxDuration).toBe(300);
  });

  it("stores the ZIP in the owner's private folder and answers with a 10-minute link that downloads it under the quarter's name", async () => {
    const response = await post("?year=2026&q=3");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      url: "http://127.0.0.1:54321/signed",
    });
    expect(load).toHaveBeenCalledWith(expect.anything(), 2026, 3);
    expect(zip).toHaveBeenCalledWith(expect.anything(), {
      year: 2026,
      q: 3,
      invoices: INVOICES,
    });
    expect(bucket.mock.calls.every(([name]) => name === "exports")).toBe(true);
    const [path, body, options] = storage.upload.mock.calls[0]!;
    expect(path).toMatch(UUID);
    expect(body).toBe(ZIP_BYTES);
    expect(options).toEqual({ contentType: "application/zip" });
    expect(storage.createSignedUrl).toHaveBeenCalledWith(path, 600, {
      download: "LUMIA-facturas-2026-T3.zip",
    });
  });

  it("deletes the owner's previous ZIPs before keeping the new one, so patient data does not pile up", async () => {
    await post("?year=2026&q=3");
    expect(storage.list).toHaveBeenCalledWith("owner-id");
    expect(storage.remove).toHaveBeenCalledWith(["owner-id/old.zip"]);
    expect(calls).toEqual(["zip", "list", "remove", "upload"]);
  });

  it("skips the removal when the owner has no previous ZIP", async () => {
    storage.list.mockResolvedValue({ data: [], error: null });
    const response = await post("?year=2026&q=3");
    expect(response.status).toBe(200);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("refuses anyone who is not the owner before reading any invoice, since the ZIP holds every patient's invoice", async () => {
    owner.result = { ok: false, error: "No tienes permiso para hacer esto." };
    const response = await post("?year=2026&q=3");
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "No tienes permiso para hacer esto.",
    });
    expect(load).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("answers 400 in Spanish to a year or quarter that does not exist, instead of exporting some other period", async () => {
    for (const search of [
      "",
      "?year=2026",
      "?year=2026&q=5",
      "?year=abc&q=1",
    ]) {
      const response = await post(search);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "El año o el trimestre no son válidos.",
      });
    }
    expect(load).not.toHaveBeenCalled();
  });

  it("explains that there is nothing to download for a quarter without invoices instead of storing an empty ZIP", async () => {
    load.mockResolvedValue({ ok: true, invoices: [] });
    const response = await post("?year=2026&q=3");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "No hay facturas en este trimestre.",
    });
    expect(zip).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("explains that the ZIP is too big for the storage limit instead of failing on upload", async () => {
    zip.mockResolvedValue(new Uint8Array(50 * 1024 * 1024 + 1));
    const response = await post("?year=2026&q=3");
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error:
        "El ZIP del trimestre pesa más de 50 MB. Descarga las facturas desde el panel.",
    });
    expect(storage.remove).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("fails loudly instead of building a partial ZIP when the invoices cannot be read", async () => {
    load.mockResolvedValue({ ok: false });
    await expect(post("?year=2026&q=3")).rejects.toThrow(
      "No se ha podido cargar el trimestre.",
    );
  });

  it("fails loudly when the ZIP cannot be stored or signed, instead of answering without a link", async () => {
    storage.upload.mockResolvedValue({ data: null, error: { message: "x" } });
    await expect(post("?year=2026&q=3")).rejects.toThrow(
      "No se ha podido guardar el ZIP: x",
    );
    storage.upload.mockResolvedValue({ data: {}, error: null });
    storage.createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "y" },
    });
    await expect(post("?year=2026&q=3")).rejects.toThrow(
      "No se ha podido guardar el ZIP: y",
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const INVOICE_ID = "c3000000-0000-0000-0000-000000000003";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const SVG = new TextEncoder().encode("<svg></svg>");
const PDF = new Uint8Array([37, 80, 68, 70]);

type DbError = { code?: string; message?: string } | null;

const detail: { data: unknown; error: DbError } = { data: null, error: null };
const rpc = vi.fn((_name: string, _args: unknown) => ({
  single: async () => detail,
}));
const settings: { data: { logo_path: string | null } | null } = {
  data: { logo_path: null },
};

vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    rpc,
    from: () => ({
      select: () => ({
        maybeSingle: async () => ({ ...settings, error: null }),
      }),
    }),
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `http://storage.test/branding/${path}` },
        }),
      }),
    },
  }),
}));
vi.mock("@clinicalumia/invoices", () => ({
  renderInvoicePdf: vi.fn(async () => PDF),
  invoiceFileName: (code: string) => `factura-${code.replace("/", "-")}.pdf`,
}));

const { renderInvoicePdf } = await import("@clinicalumia/invoices");
const { GET } = await import("./route");

function get(id: string) {
  return GET(new Request(`http://localhost:3001/facturas/${id}/pdf`), {
    params: Promise.resolve({ id }),
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  detail.data = { id: INVOICE_ID, code: "34/26" };
  detail.error = null;
  settings.data = { logo_path: null };
  rpc.mockClear();
  vi.mocked(renderInvoicePdf).mockClear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("GET /facturas/[id]/pdf", () => {
  it("serves the invoice inline as a private PDF that no cache keeps, since it holds patient data", async () => {
    const response = await get(INVOICE_ID);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      'inline; filename="factura-34-26.pdf"',
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PDF);
    expect(rpc).toHaveBeenCalledWith("invoice_detail", {
      p_invoice_id: INVOICE_ID,
    });
  });

  it("does not exist for an invoice the person may not see, so a colleague's invoice number reveals nothing", async () => {
    detail.data = null;
    detail.error = { code: "P0001", message: "invoice_not_found" };
    expect((await get(INVOICE_ID)).status).toBe(404);
  });

  it("does not exist for someone who is not active staff", async () => {
    detail.data = null;
    detail.error = { code: "42501", message: "invoice_forbidden" };
    expect((await get(INVOICE_ID)).status).toBe(404);
  });

  it("does not reach the database for an address that is not an invoice id", async () => {
    expect((await get("34-26")).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("prints the clinic's own logo when it is a PNG or JPEG", async () => {
    settings.data = { logo_path: "logo.png" };
    fetchMock.mockResolvedValue(new Response(PNG));
    await get(INVOICE_ID);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://storage.test/branding/logo.png",
    );
    expect(renderInvoicePdf).toHaveBeenCalledWith(detail.data, { logo: PNG });
  });

  it("uses the default LUMIA logo when the clinic's logo is an SVG or WebP the PDF cannot draw", async () => {
    settings.data = { logo_path: "logo.svg" };
    fetchMock.mockResolvedValue(new Response(SVG));
    await get(INVOICE_ID);
    expect(renderInvoicePdf).toHaveBeenCalledWith(detail.data, {
      logo: undefined,
    });
  });
});

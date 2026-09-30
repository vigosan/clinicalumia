import { beforeEach, describe, expect, it, vi } from "vitest";

const INVOICE_ID = "c3000000-0000-0000-0000-000000000003";

type DbError = { code?: string; message?: string } | null;

const rpcResults: Record<string, { data: unknown; error: DbError }> = {};
const rpc = vi.fn(
  async (name: string, _args?: unknown) =>
    rpcResults[name] ?? { data: null, error: null },
);
const single = vi.fn(async () => rpcResults.invoice_detail);
const settings = { data: { logo_path: null }, error: null };

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    rpc: (name: string, args: unknown) =>
      name === "invoice_detail"
        ? {
            single: () => {
              rpc(name, args);
              return single();
            },
          }
        : rpc(name, args),
    from: () => ({
      select: () => ({ maybeSingle: async () => settings }),
    }),
  }),
}));
vi.mock("@clinicalumia/api/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@clinicalumia/invoices", () => ({
  renderInvoicePdf: vi.fn(async () => new Uint8Array([37, 80, 68, 70])),
  invoiceFileName: (code: string) => `factura-${code.replace("/", "-")}.pdf`,
}));

const { revalidatePath } = await import("next/cache");
const { sendEmail } = await import("@clinicalumia/api/email");
const { issueFullInvoice, issueRectifyingInvoice, sendInvoiceEmail } =
  await import("./actions");

const DETAIL = { id: INVOICE_ID, code: "34/26" };

beforeEach(() => {
  for (const key of Object.keys(rpcResults)) delete rpcResults[key];
  rpcResults.invoice_detail = { data: DETAIL, error: null };
  rpc.mockClear();
  vi.mocked(sendEmail).mockReset();
  vi.mocked(revalidatePath).mockClear();
});

describe("issueFullInvoice", () => {
  it("sends the trimmed recipient to issue_full_invoice and refreshes the panel so it shows the new invoice number", async () => {
    const result = await issueFullInvoice(INVOICE_ID, {
      name: "  Ana García ",
      taxId: " x1234567l ",
      address: " Avenida del Puerto 3 ",
      postalCode: " 46800 ",
      city: " Xàtiva ",
    });
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("issue_full_invoice", {
      p_invoice_id: INVOICE_ID,
      p_recipient: {
        name: "Ana García",
        tax_id: "x1234567l",
        address: "Avenida del Puerto 3",
        postal_code: "46800",
        city: "Xàtiva",
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("explains an invalid tax id and keeps the form as typed so it can be corrected", async () => {
    rpcResults.issue_full_invoice = {
      data: null,
      error: { code: "P0001", message: "recipient_tax_id_invalid" },
    };
    const result = await issueFullInvoice(INVOICE_ID, {
      name: "Ana",
      taxId: "123",
      address: "Calle",
      postalCode: "46800",
      city: "Xàtiva",
    });
    expect(result).toEqual({
      error:
        "Escribe un DNI, NIE o CIF válido. Otros documentos (pasaporte, NIF extranjero) no se admiten todavía.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("issueRectifyingInvoice", () => {
  it("issues the rectifying invoice with the trimmed reason, which also voids the payment, and refreshes the panel", async () => {
    const result = await issueRectifyingInvoice(
      INVOICE_ID,
      "  Cobrado por error ",
    );
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("issue_rectifying_invoice", {
      p_invoice_id: INVOICE_ID,
      p_reason: "Cobrado por error",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("explains who may void when a colleague tries it the next day", async () => {
    rpcResults.issue_rectifying_invoice = {
      data: null,
      error: { code: "P0001", message: "not_allowed" },
    };
    const result = await issueRectifyingInvoice(INVOICE_ID, "Error");
    expect(result).toEqual({
      error:
        "Solo puede anular este cobro quien lo registró hoy o la propietaria.",
    });
  });
});

describe("sendInvoiceEmail", () => {
  it("emails the PDF to the normalised address with the invoice number in the subject, and records the send", async () => {
    const result = await sendInvoiceEmail(INVOICE_ID, "  Ana@Correo.TEST ");
    expect(result).toEqual({ ok: true, email: "ana@correo.test" });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ana@correo.test",
        subject: "Factura 34/26 · Clínica LUMIA",
        attachments: [
          {
            filename: "factura-34-26.pdf",
            content: new Uint8Array([37, 80, 68, 70]),
            contentType: "application/pdf",
          },
        ],
      }),
    );
    expect(rpc).toHaveBeenCalledWith("record_invoice_email", {
      p_invoice_id: INVOICE_ID,
      p_email: "ana@correo.test",
    });
  });

  it("refuses an address that cannot receive email before generating anything", async () => {
    const result = await sendInvoiceEmail(INVOICE_ID, "ana@correo");
    expect(result).toEqual({ error: "Escribe un email válido." });
    expect(rpc).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not send an invoice the person may not see", async () => {
    rpcResults.invoice_detail = {
      data: null,
      error: { code: "P0001", message: "invoice_not_found" },
    };
    const result = await sendInvoiceEmail(INVOICE_ID, "ana@correo.test");
    expect(result).toEqual({ error: "Esta factura ya no está disponible." });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not record a send that failed, so the log only lists emails that left", async () => {
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("Mailpit caído"));
    const result = await sendInvoiceEmail(INVOICE_ID, "ana@correo.test");
    expect(result).toEqual({
      error: "No se ha podido enviar el email. Inténtalo de nuevo.",
    });
    expect(rpc).not.toHaveBeenCalledWith(
      "record_invoice_email",
      expect.anything(),
    );
  });
});

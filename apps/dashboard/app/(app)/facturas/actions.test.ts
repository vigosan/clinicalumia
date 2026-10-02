import { beforeEach, describe, expect, it, vi } from "vitest";

const INVOICE_ID = "c3000000-0000-0000-0000-000000000003";
const CORRECTED_ID = "c3000000-0000-0000-0000-000000000004";
const PATIENT_ID = "c3000000-0000-0000-0000-0000000000c1";

type DbError = { code?: string; message?: string; details?: string } | null;

const rpcResults: Record<string, { data: unknown; error: DbError }> = {};
const rpc = vi.fn(
  async (name: string, _args?: unknown) =>
    rpcResults[name] ?? { data: null, error: null },
);
const single = vi.fn(async () => rpcResults.invoice_detail);
const settings = { data: { logo_path: null }, error: null };
const emailOnlyIfEmpty = vi.fn(async (_column: string, _value: null) => ({
  error: null,
}));
const savedEmail = vi.fn((_id: string) => ({ is: emailOnlyIfEmpty }));
const peopleUpdate = vi.fn((_values: unknown) => ({ eq: savedEmail }));
const patientRow: { data: { birth_date: string | null } | null } = {
  data: { birth_date: "1990-05-12" },
};

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
    from: (table: string) =>
      table === "people"
        ? {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ ...patientRow, error: null }),
              }),
            }),
            update: peopleUpdate,
          }
        : { select: () => ({ maybeSingle: async () => settings }) },
  }),
}));
vi.mock("@clinicalumia/api/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@clinicalumia/invoices", () => ({
  renderInvoicePdf: vi.fn(async () => new Uint8Array([37, 80, 68, 70])),
  invoiceFileName: (code: string) => `factura-${code.replace("/", "-")}.pdf`,
}));

const { revalidatePath } = await import("next/cache");
const { sendEmail } = await import("@clinicalumia/api/email");
const { renderInvoicePdf } = await import("@clinicalumia/invoices");
const {
  correctInvoiceRecipient,
  issueFullInvoice,
  issueRectifyingInvoice,
  sendInvoiceEmail,
} = await import("./actions");

const DETAIL = { id: INVOICE_ID, code: "34/26", patient_id: PATIENT_ID };

const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  consoleError.mockClear();
  for (const key of Object.keys(rpcResults)) delete rpcResults[key];
  rpcResults.invoice_detail = { data: DETAIL, error: null };
  rpc.mockClear();
  peopleUpdate.mockClear();
  patientRow.data = { birth_date: "1990-05-12" };
  savedEmail.mockClear();
  emailOnlyIfEmpty.mockClear();
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
    expect(revalidatePath).toHaveBeenCalledWith("/facturas");
    expect(revalidatePath).toHaveBeenCalledWith(`/facturas/${INVOICE_ID}`);
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

describe("correctInvoiceRecipient", () => {
  it("corrects the recipient in one database call and returns the new invoice, so the screen can open it", async () => {
    rpcResults.correct_full_invoice_recipient = {
      data: CORRECTED_ID,
      error: null,
    };
    const result = await correctInvoiceRecipient(INVOICE_ID, {
      name: " Talleres Auditoría S.L. ",
      taxId: "B98765431",
      address: "Polígono Sur 4",
      postalCode: "46800",
      city: "Xàtiva",
    });
    expect(result).toEqual({ ok: true, id: CORRECTED_ID });
    expect(rpc).toHaveBeenCalledWith("correct_full_invoice_recipient", {
      p_invoice_id: INVOICE_ID,
      p_recipient: {
        name: "Talleres Auditoría S.L.",
        tax_id: "B98765431",
        address: "Polígono Sur 4",
        postal_code: "46800",
        city: "Xàtiva",
      },
    });
    expect(rpc).not.toHaveBeenCalledWith(
      "issue_rectifying_invoice",
      expect.anything(),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/facturas");
    expect(revalidatePath).toHaveBeenCalledWith(`/facturas/${INVOICE_ID}`);
  });

  it("explains that only a full invoice has a recipient to correct", async () => {
    rpcResults.correct_full_invoice_recipient = {
      data: null,
      error: { code: "P0001", message: "invoice_not_full" },
    };
    const result = await correctInvoiceRecipient(INVOICE_ID, {
      name: "Ana",
      taxId: "12345678Z",
      address: "Calle",
      postalCode: "46800",
      city: "Xàtiva",
    });
    expect(result).toEqual({
      error: "Solo se puede corregir el destinatario de una factura completa.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("correctInvoiceRecipient unchanged", () => {
  it("explains that nothing changed when the recipient is submitted as it was", async () => {
    rpcResults.correct_full_invoice_recipient = {
      data: null,
      error: { code: "P0001", message: "recipient_unchanged" },
    };
    const result = await correctInvoiceRecipient(INVOICE_ID, {
      name: "Ana",
      taxId: "12345678Z",
      address: "Calle",
      postalCode: "46800",
      city: "Xàtiva",
    });
    expect(result).toEqual({
      error: "Los datos del destinatario no han cambiado.",
    });
  });
});

describe("issueRectifyingInvoice", () => {
  it("names the rectifying numbering when it is the one missing, and tells an employee to warn the owner", async () => {
    rpcResults.is_owner = { data: false, error: null };
    rpcResults.issue_rectifying_invoice = {
      data: null,
      error: { code: "P0001", message: "rectifying_series_not_configured" },
    };
    const result = await issueRectifyingInvoice(INVOICE_ID, "Error");
    expect(result).toEqual({
      error:
        "Falta configurar la numeración de las rectificativas. Avisa a la propietaria para que la confirme en el admin.",
    });
  });

  it("asks the owner for exactly the clinic fields the rectifying invoice is missing", async () => {
    rpcResults.is_owner = { data: true, error: null };
    rpcResults.issue_rectifying_invoice = {
      data: null,
      error: {
        code: "P0001",
        message: "clinic_fiscal_data_missing",
        details: "address_line,city",
      },
    };
    const result = await issueRectifyingInvoice(INVOICE_ID, "Error");
    expect(result).toEqual({
      error:
        "Faltan datos de la clínica para la factura: dirección y ciudad. Complétalos en el admin, en Datos de la clínica.",
    });
  });

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
    expect(revalidatePath).toHaveBeenCalledWith("/facturas");
    expect(revalidatePath).toHaveBeenCalledWith(`/facturas/${INVOICE_ID}`);
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

  it("saves the address in the patient's record when asked, only if the record still has no email, so the next invoice proposes it", async () => {
    const result = await sendInvoiceEmail(INVOICE_ID, "Ana@Correo.test", true);
    expect(result).toEqual({ ok: true, email: "ana@correo.test" });
    expect(peopleUpdate).toHaveBeenCalledWith({ email: "ana@correo.test" });
    expect(savedEmail).toHaveBeenCalledWith("id", PATIENT_ID);
    expect(emailOnlyIfEmpty).toHaveBeenCalledWith("email", null);
    expect(revalidatePath).toHaveBeenCalledWith(`/patients/${PATIENT_ID}`);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("never saves the address in a minor's record, because it is a parent's and the patient area would then treat the child as the parent", async () => {
    patientRow.data = { birth_date: "2018-03-01" };
    const result = await sendInvoiceEmail(INVOICE_ID, "ana@correo.test", true);
    expect(result).toEqual({ ok: true, email: "ana@correo.test" });
    expect(peopleUpdate).not.toHaveBeenCalled();
  });

  it("leaves the record untouched when «Guardar en la ficha» is unchecked", async () => {
    await sendInvoiceEmail(INVOICE_ID, "ana@correo.test", false);
    expect(peopleUpdate).not.toHaveBeenCalled();
  });

  it("does not save an address whose email failed to send", async () => {
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("Mailpit caído"));
    await sendInvoiceEmail(INVOICE_ID, "ana@correo.test", true);
    expect(peopleUpdate).not.toHaveBeenCalled();
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

  it("explains inline that the PDF could not be generated instead of crashing the screen, and sends nothing", async () => {
    const failure = new Error("Fuente no encontrada");
    vi.mocked(renderInvoicePdf).mockRejectedValueOnce(failure);
    const result = await sendInvoiceEmail(INVOICE_ID, "ana@correo.test");
    expect(result).toEqual({
      error:
        "No se ha podido generar el PDF de la factura. Inténtalo de nuevo.",
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "No se ha podido generar el PDF de la factura",
      failure,
    );
  });

  it("does not record a send that failed, so the log only lists emails that left, and logs why it failed", async () => {
    const failure = new Error("Mailpit caído");
    vi.mocked(sendEmail).mockRejectedValueOnce(failure);
    const result = await sendInvoiceEmail(INVOICE_ID, "ana@correo.test");
    expect(result).toEqual({
      error: "No se ha podido enviar el email. Inténtalo de nuevo.",
    });
    expect(rpc).not.toHaveBeenCalledWith(
      "record_invoice_email",
      expect.anything(),
    );
    expect(consoleError).toHaveBeenCalledWith(
      "No se ha podido enviar la factura por email",
      failure,
    );
  });

  it("confirms the send even if recording it fails, because the email already left and resending would duplicate it", async () => {
    rpcResults.record_invoice_email = {
      data: null,
      error: { code: "P0001", message: "invoice_not_found" },
    };
    const result = await sendInvoiceEmail(INVOICE_ID, "ana@correo.test");
    expect(result).toEqual({ ok: true, email: "ana@correo.test" });
    expect(consoleError).toHaveBeenCalledWith(
      "No se ha podido registrar el envío de la factura",
      rpcResults.record_invoice_email.error,
    );
  });
});

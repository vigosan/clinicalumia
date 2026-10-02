import { describe, expect, it } from "vitest";
import {
  currentInvoice,
  invoiceEmailHtml,
  invoiceIssuedLabel,
  normalizeEmail,
  proposedInvoiceEmail,
  recipientDraft,
  recipientParams,
  recipientWithTaxId,
} from "./invoices";

const adult = {
  first_name: "Lucía",
  last_name: "Martínez",
  email: "lucia@correo.test",
  tax_id: "12345678Z",
  address: "Calle Mayor 1",
};

const guardian = {
  first_name: "Ana",
  last_name: "García",
  email: "ana@correo.test",
  tax_id: "X1234567L",
  address: "Avenida del Puerto 3",
};

describe("currentInvoice", () => {
  it("picks the full invoice over the simplified one it replaced, because that is the one that counts now", () => {
    expect(
      currentInvoice([
        {
          id: "s1",
          code: "1/26",
          kind: "simplified",
          status: "replaced",
          issued_at: "2026-10-01T09:00:00+00:00",
          rectifies_invoice_id: null,
        },
        {
          id: "f2",
          code: "2/26",
          kind: "full",
          status: "issued",
          issued_at: "2026-10-02T09:00:00+00:00",
          rectifies_invoice_id: null,
        },
      ]),
    ).toEqual({
      id: "f2",
      code: "2/26",
      kind: "full",
      issuedAt: "2026-10-02T09:00:00+00:00",
    });
  });

  it("returns the simplified invoice while it has not been replaced", () => {
    expect(
      currentInvoice([
        {
          id: "s1",
          code: "1/26",
          kind: "simplified",
          status: "issued",
          issued_at: "2026-10-01T09:00:00+00:00",
          rectifies_invoice_id: null,
        },
      ]),
    ).toEqual({
      id: "s1",
      code: "1/26",
      kind: "simplified",
      issuedAt: "2026-10-01T09:00:00+00:00",
    });
  });

  it("after correcting the recipient, picks the new full invoice and not the rectified one, although both are still issued and the charge stays valid", () => {
    expect(
      currentInvoice([
        {
          id: "f1",
          code: "1/26",
          kind: "full",
          status: "issued",
          issued_at: "2026-10-01T09:00:00+00:00",
          rectifies_invoice_id: null,
        },
        {
          id: "r1",
          code: "R1/26",
          kind: "rectifying",
          status: "issued",
          issued_at: "2026-10-02T09:00:00+00:00",
          rectifies_invoice_id: "f1",
        },
        {
          id: "f2",
          code: "2/26",
          kind: "full",
          status: "issued",
          issued_at: "2026-10-02T09:00:00+00:00",
          rectifies_invoice_id: null,
        },
      ])?.id,
    ).toBe("f2");
  });

  it("returns nothing for a payment without invoice, such as a free session", () => {
    expect(currentInvoice([])).toBeNull();
  });
});

describe("invoiceIssuedLabel", () => {
  it("gives the Madrid day the invoice was issued, with its year, so a session paid in December and moved to January is not ambiguous", () => {
    expect(invoiceIssuedLabel("2026-10-01T22:30:00+00:00")).toBe(
      "Factura emitida el 02/10/2026",
    );
  });
});

describe("recipientDraft", () => {
  it("fills the full invoice with the adult patient's own data", () => {
    expect(
      recipientDraft({ patient: adult, guardian: null, minor: false }),
    ).toEqual({
      name: "Lucía Martínez",
      taxId: "12345678Z",
      address: "Calle Mayor 1",
      postalCode: "",
      city: "",
    });
  });

  it("fills a minor's invoice with the guardian's data, because the guardian is who pays and deducts it", () => {
    expect(recipientDraft({ patient: adult, guardian, minor: true })).toEqual({
      name: "Ana García",
      taxId: "X1234567L",
      address: "Avenida del Puerto 3",
      postalCode: "",
      city: "",
    });
  });

  it("falls back to the minor's own data when no guardian is on file, and leaves a missing tax id empty to be typed", () => {
    expect(
      recipientDraft({
        patient: { ...adult, tax_id: null },
        guardian: null,
        minor: true,
      }).taxId,
    ).toBe("");
  });
});

describe("recipientDraft with an earlier full invoice", () => {
  const company = {
    name: "Talleres Auditoría S.L.",
    tax_id: "B98765431",
    address: "Polígono Sur 4",
    postal_code: "46800",
    city: "Xàtiva",
  };

  it("fills the form with the recipient of the patient's latest full invoice, because a company that paid once usually pays again and its data is not in the patient's record", () => {
    expect(
      recipientDraft({
        patient: adult,
        guardian,
        minor: true,
        lastRecipient: company,
      }),
    ).toEqual({
      name: "Talleres Auditoría S.L.",
      taxId: "B98765431",
      address: "Polígono Sur 4",
      postalCode: "46800",
      city: "Xàtiva",
    });
  });

  it("uses the record's data when the patient never had a full invoice", () => {
    expect(
      recipientDraft({
        patient: adult,
        guardian: null,
        minor: false,
        lastRecipient: null,
      }).name,
    ).toBe("Lucía Martínez");
  });
});

describe("recipientWithTaxId", () => {
  it("names who the invoice is made out to with its tax id, so a full invoice for a company is not mistaken for the patient's", () => {
    expect(
      recipientWithTaxId({
        name: "Talleres Auditoría S.L.",
        tax_id: "B98765431",
        address: "Polígono Sur 4",
        postal_code: "46800",
        city: "Xàtiva",
      }),
    ).toBe("Talleres Auditoría S.L. (B98765431)");
  });

  it("gives nothing for a simplified invoice, which has no recipient", () => {
    expect(recipientWithTaxId(null)).toBeNull();
  });
});

describe("recipientParams", () => {
  it("sends the recipient trimmed and with the database field names, so stray spaces never reach a printed invoice", () => {
    expect(
      recipientParams({
        name: "  Ana García ",
        taxId: " x1234567l ",
        address: " Avenida del Puerto 3 ",
        postalCode: " 46800 ",
        city: " Xàtiva ",
      }),
    ).toEqual({
      name: "Ana García",
      tax_id: "x1234567l",
      address: "Avenida del Puerto 3",
      postal_code: "46800",
      city: "Xàtiva",
    });
  });
});

describe("proposedInvoiceEmail", () => {
  it("proposes the patient's email first", () => {
    expect(proposedInvoiceEmail({ patient: adult, guardian })).toBe(
      "lucia@correo.test",
    );
  });

  it("proposes the guardian's email when the patient has none, as with most children", () => {
    expect(
      proposedInvoiceEmail({ patient: { ...adult, email: null }, guardian }),
    ).toBe("ana@correo.test");
  });

  it("proposes nothing when nobody has an email, so the staff types it", () => {
    expect(
      proposedInvoiceEmail({
        patient: { ...adult, email: null },
        guardian: null,
      }),
    ).toBe("");
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases a typed address", () => {
    expect(normalizeEmail("  Ana@Correo.TEST ")).toBe("ana@correo.test");
  });

  it("rejects an address that cannot receive email", () => {
    expect(normalizeEmail("ana@correo")).toBeNull();
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("ana @correo.test")).toBeNull();
  });
});

describe("invoiceEmailHtml", () => {
  it("names the invoice in the body", () => {
    expect(invoiceEmailHtml("34/26")).toContain("la factura 34/26");
  });

  it("escapes the invoice code, since the series format is editable and must never inject markup into the email", () => {
    const html = invoiceEmailHtml('<a href="x">1</a>');
    expect(html).not.toContain("<a href");
    expect(html).toContain("&lt;a href=&quot;x&quot;&gt;1&lt;/a&gt;");
  });
});

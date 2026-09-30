import { describe, expect, it } from "vitest";
import {
  currentInvoice,
  normalizeEmail,
  proposedInvoiceEmail,
  recipientDraft,
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
        { id: "s1", code: "1/26", kind: "simplified", status: "replaced" },
        { id: "f2", code: "2/26", kind: "full", status: "issued" },
      ]),
    ).toEqual({ id: "f2", code: "2/26", kind: "full" });
  });

  it("returns the simplified invoice while it has not been replaced", () => {
    expect(
      currentInvoice([
        { id: "s1", code: "1/26", kind: "simplified", status: "issued" },
      ]),
    ).toEqual({ id: "s1", code: "1/26", kind: "simplified" });
  });

  it("returns nothing for a payment without invoice, such as a free session", () => {
    expect(currentInvoice([])).toBeNull();
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

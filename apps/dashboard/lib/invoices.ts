import { formatMadridDate } from "@clinicalumia/api/madrid-time";
import type { InvoiceSnapshot } from "@clinicalumia/invoices";

export type InvoiceKind = "simplified" | "full" | "rectifying";

export type CurrentInvoice = {
  id: string;
  code: string;
  kind: InvoiceKind;
  issuedAt: string;
};

export type InvoiceContact = {
  first_name: string;
  last_name: string;
  email: string | null;
  tax_id: string | null;
  address: string;
};

export type InvoiceRecipient = NonNullable<InvoiceSnapshot["recipient"]>;

export type RecipientDraft = {
  name: string;
  taxId: string;
  address: string;
  postalCode: string;
  city: string;
};

export function recipientParams(recipient: RecipientDraft) {
  return {
    name: recipient.name.trim(),
    tax_id: recipient.taxId.trim(),
    address: recipient.address.trim(),
    postal_code: recipient.postalCode.trim(),
    city: recipient.city.trim(),
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function currentInvoice(
  invoices: {
    id: string;
    code: string;
    kind: InvoiceKind;
    status: "issued" | "replaced";
    issued_at: string;
    rectifies_invoice_id: string | null;
  }[],
): CurrentInvoice | null {
  const rectified = new Set(
    invoices.map((invoice) => invoice.rectifies_invoice_id),
  );
  const current = invoices.find(
    (invoice) =>
      invoice.status === "issued" &&
      invoice.kind !== "rectifying" &&
      !rectified.has(invoice.id),
  );
  return current
    ? {
        id: current.id,
        code: current.code,
        kind: current.kind,
        issuedAt: current.issued_at,
      }
    : null;
}

export function invoiceIssuedLabel(issuedAt: string): string {
  return `Factura emitida el ${formatMadridDate(issuedAt)}`;
}

export function recipientWithTaxId(
  recipient: InvoiceRecipient | null,
): string | null {
  return recipient ? `${recipient.name} (${recipient.tax_id})` : null;
}

export function recipientFromInvoice(
  recipient: InvoiceRecipient,
): RecipientDraft {
  return {
    name: recipient.name,
    taxId: recipient.tax_id,
    address: recipient.address,
    postalCode: recipient.postal_code,
    city: recipient.city,
  };
}

export function recipientDraft({
  patient,
  guardian,
  minor,
  lastRecipient = null,
}: {
  patient: InvoiceContact;
  guardian: InvoiceContact | null;
  minor: boolean;
  lastRecipient?: InvoiceRecipient | null;
}): RecipientDraft {
  if (lastRecipient) return recipientFromInvoice(lastRecipient);
  const payer = minor && guardian ? guardian : patient;
  return {
    name: `${payer.first_name} ${payer.last_name}`,
    taxId: payer.tax_id ?? "",
    address: payer.address,
    postalCode: "",
    city: "",
  };
}

export function proposedInvoiceEmail({
  patient,
  guardian,
}: {
  patient: InvoiceContact;
  guardian: InvoiceContact | null;
}): string {
  return patient.email ?? guardian?.email ?? "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function invoiceEmailHtml(code: string): string {
  return `
    <p>Hola:</p>
    <p>Te enviamos adjunta la factura ${escapeHtml(code)} de Clínica LUMIA.</p>
    <p>Gracias por tu confianza.</p>
    <p>Clínica LUMIA</p>
  `;
}

export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return EMAIL.test(email) ? email : null;
}

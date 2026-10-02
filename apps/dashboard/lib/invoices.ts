import { madridDateTime } from "@clinicalumia/api/madrid-time";

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
  }[],
): CurrentInvoice | null {
  const current = invoices.find(
    (invoice) => invoice.status === "issued" && invoice.kind !== "rectifying",
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
  const { date } = madridDateTime(issuedAt);
  return `Factura emitida el ${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

export function recipientDraft({
  patient,
  guardian,
  minor,
}: {
  patient: InvoiceContact;
  guardian: InvoiceContact | null;
  minor: boolean;
}): RecipientDraft {
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

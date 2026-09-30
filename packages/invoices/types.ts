import type { Database } from "@clinicalumia/db";

export type InvoiceDetail =
  Database["public"]["Functions"]["invoice_detail"]["Returns"][number];

export type InvoicePayment = { method: string; amount_cents: number };

export type InvoiceSnapshot = {
  issuer: {
    name: string;
    tax_id: string;
    address_line: string;
    postal_code: string;
    city: string;
    province: string;
    phone: string;
    email: string;
    website: string;
  };
  recipient: {
    name: string;
    tax_id: string;
    address: string;
    postal_code: string;
    city: string;
  } | null;
  lines: {
    description: string;
    session_date: string;
    patient: string;
    quantity: number;
    base_cents: number;
    vat_rate: number;
    vat_cents: number;
    total_cents: number;
  }[];
  totals: { base_cents: number; vat_cents: number; total_cents: number };
  vat: Database["public"]["Enums"]["vat_treatment"];
  vat_note: string;
  payments: InvoicePayment[] | null;
  footer: string;
  rectifies?: { code: string; issued_on: string };
  reason?: string;
};

export type InvoiceRelated = {
  replaces: { id: string; code: string } | null;
  replaced_by: { id: string; code: string } | null;
  rectifies: { id: string; code: string } | null;
  rectified_by: { id: string; code: string } | null;
};

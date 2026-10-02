import Link from "next/link";
import {
  formatInvoiceDate,
  type InvoiceRow,
  invoiceKindLabel,
  invoiceStatusLabel,
} from "@/lib/invoices-load";
import { formatEuros } from "@/lib/payments";

export function PatientInvoices({
  error,
  invoices,
  truncated,
}: {
  error: boolean;
  invoices: InvoiceRow[];
  truncated: boolean;
}) {
  if (error) {
    return (
      <p
        role="alert"
        data-testid="patient-invoices-error"
        className="text-[13px] text-danger-600"
      >
        No se han podido cargar las facturas. Recarga la página.
      </p>
    );
  }

  if (invoices.length === 0) {
    return (
      <p className="text-sm text-ink-800">Aquí aparecerán sus facturas.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="patient-invoices">
      <ul className="flex flex-col divide-y divide-line">
        {invoices.map((invoice) => (
          <li key={invoice.id}>
            <Link
              href={`/facturas/${invoice.id}`}
              data-testid="patient-invoice"
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 -mx-3 rounded-field px-3 py-3 text-[15px] text-ink-900 hover:bg-cream-50"
            >
              <span>
                {invoice.code} · {formatInvoiceDate(invoice.issuedAt)} ·{" "}
                {invoiceKindLabel(invoice.kind)}
              </span>
              <span className="text-[13px] text-ink-800">
                {formatEuros(invoice.totalCents)} ·{" "}
                {invoiceStatusLabel(invoice)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {truncated && (
        <p className="text-[13px] text-ink-800">
          Se muestran solo las 20 más recientes.
        </p>
      )}
    </div>
  );
}

import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { isMinor } from "@clinicalumia/api/person";
import { createClient } from "@clinicalumia/api/server";
import { Button } from "@clinicalumia/ui/button";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/agenda";
import { proposedInvoiceEmail, recipientDraft } from "@/lib/invoices";
import {
  formatInvoiceDate,
  invoiceKindLabel,
  invoiceStatusLabel,
} from "@/lib/invoices-load";
import { formatEuros } from "@/lib/payments";
import { FullInvoiceForm } from "../../agenda/FullInvoiceForm";
import { SendInvoiceForm } from "../../agenda/SendInvoiceForm";

type RelatedInvoice = { id: string; code: string } | null;
type Related = {
  replaces: RelatedInvoice;
  replaced_by: RelatedInvoice;
  rectifies: RelatedInvoice;
  rectified_by: RelatedInvoice;
};

const RELATED_LABELS: Record<keyof Related, string> = {
  replaces: "Sustituye a",
  replaced_by: "Sustituida por",
  rectifies: "Rectifica a",
  rectified_by: "Rectificada por",
};

function ErrorCard() {
  return (
    <Card role="alert" className="text-center text-sm text-danger-600">
      No se ha podido cargar la factura. Recarga la página.
    </Card>
  );
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: detail, error } = await supabase
    .rpc("invoice_detail", { p_invoice_id: id })
    .single();
  if (error || !detail) {
    if (error?.code === "42501" || error?.message === "invoice_not_found")
      notFound();
    return <ErrorCard />;
  }

  const { data: patient, error: patientError } = await supabase
    .from("people")
    .select("id, first_name, last_name, email, tax_id, address, birth_date")
    .eq("id", detail.patient_id)
    .maybeSingle();
  if (patientError || !patient) return <ErrorCard />;

  const { data: guardianRows } = await supabase
    .from("guardianships")
    .select(
      "is_primary, guardian:people!guardianships_guardian_id_fkey(first_name, last_name, email, tax_id, address)",
    )
    .eq("minor_id", patient.id)
    .order("is_primary", { ascending: false });
  const guardian = guardianRows?.[0]?.guardian ?? null;
  const minor = patient.birth_date
    ? isMinor(patient.birth_date, todayInMadrid())
    : false;

  const related = detail.related as Related;
  const status = invoiceStatusLabel({
    status: detail.status,
    replacedByCode: related.replaced_by?.code ?? null,
    rectifiedByCode: related.rectified_by?.code ?? null,
  });
  const relatedEntries = (Object.keys(RELATED_LABELS) as (keyof Related)[])
    .map((key) => ({ key, invoice: related[key] }))
    .filter(
      (
        entry,
      ): entry is {
        key: keyof Related;
        invoice: { id: string; code: string };
      } => entry.invoice !== null,
    );

  return (
    <>
      <PageHeader title={`Factura ${detail.code}`} />
      <Card className="flex flex-col gap-2">
        <p data-testid="invoice-code">Factura {detail.code}</p>
        <p>{invoiceKindLabel(detail.kind)}</p>
        <p>{formatInvoiceDate(detail.issued_at)}</p>
        <p>
          <Link href={`/patients/${patient.id}`}>
            {patient.first_name} {patient.last_name}
          </Link>
        </p>
        <p>{formatEuros(detail.total_cents)}</p>
        <p data-testid="invoice-status">{status}</p>
        {detail.reason && <p>Motivo: {detail.reason}</p>}
      </Card>
      {relatedEntries.length > 0 && (
        <Card data-testid="invoice-related" className="flex flex-col gap-2">
          {relatedEntries.map(({ key, invoice }) => (
            <Link
              key={key}
              href={`/facturas/${invoice.id}`}
              data-testid="invoice-related-link"
            >
              {RELATED_LABELS[key]} {invoice.code}
            </Link>
          ))}
        </Card>
      )}
      <Card className="flex flex-col gap-2">
        <div>
          <Button asChild variant="secondary" size="sm">
            <a
              href={`/facturas/${detail.id}/pdf`}
              target="_blank"
              rel="noopener"
              data-testid="invoice-view"
            >
              Ver / Imprimir
            </a>
          </Button>
        </div>
        <SendInvoiceForm
          invoiceId={detail.id}
          proposedEmail={proposedInvoiceEmail({ patient, guardian })}
        />
        {detail.kind === "simplified" && detail.status === "issued" && (
          <FullInvoiceForm
            invoiceId={detail.id}
            recipient={recipientDraft({ patient, guardian, minor })}
          />
        )}
      </Card>
    </>
  );
}

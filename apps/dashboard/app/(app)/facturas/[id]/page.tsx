import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { isMinor } from "@clinicalumia/api/person";
import { createClient } from "@clinicalumia/api/server";
import { Alert } from "@clinicalumia/ui/alert";
import { Button } from "@clinicalumia/ui/button";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/agenda";
import {
  type InvoiceRecipient,
  proposedInvoiceEmail,
  recipientDraft,
  recipientFromInvoice,
  recipientWithTaxId,
} from "@/lib/invoices";
import {
  formatInvoiceDate,
  invoiceKindLabel,
  invoiceStatusLabel,
  loadLastFullRecipient,
} from "@/lib/invoices-load";
import { canVoidPayment, formatEuros } from "@/lib/payments";
import { FullInvoiceForm } from "../../agenda/FullInvoiceForm";
import { SendInvoiceForm } from "../../agenda/SendInvoiceForm";
import { VoidPaymentDialog } from "../../agenda/VoidPaymentDialog";

type RelatedInvoice = { id: string; code: string } | null;
type Related = {
  replaces: RelatedInvoice;
  replaced_by: RelatedInvoice;
  rectifies: RelatedInvoice;
  rectified_by: RelatedInvoice;
  corrects: RelatedInvoice;
  corrected_by: RelatedInvoice;
};

const RELATED_LABELS: Record<keyof Related, string> = {
  replaces: "Sustituye a",
  replaced_by: "Sustituida por",
  rectifies: "Rectifica a",
  rectified_by: "Rectificada por",
  corrects: "Corrige a",
  corrected_by: "Corregida por",
};

function ErrorCard() {
  return <Alert>No se ha podido cargar la factura. Recarga la página.</Alert>;
}

export const metadata: Metadata = { title: "Factura" };

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

  const [
    { data: payment, error: paymentError },
    lastRecipient,
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("collected_by, collected_at")
      .eq("id", detail.payment_id)
      .maybeSingle(),
    loadLastFullRecipient(supabase, patient.id),
    supabase.auth.getUser(),
  ]);
  if (paymentError || !payment || !user) return <ErrorCard />;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const related = detail.related as Related;
  const recipient = (detail.snapshot as { recipient: InvoiceRecipient | null })
    .recipient;
  const recipientLabel = recipientWithTaxId(recipient);
  const proposedEmail = proposedInvoiceEmail({ patient, guardian });
  const inForce =
    detail.kind !== "rectifying" &&
    detail.status === "issued" &&
    !related.rectified_by;
  const canRectify =
    inForce &&
    canVoidPayment({
      payment,
      userId: user.id,
      isOwner: profile?.role === "owner",
      now: new Date(),
    });
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
      <PageHeader
        breadcrumbs={[
          { label: "Facturas", href: "/facturas" },
          { label: detail.code },
        ]}
        title={`Factura ${detail.code}`}
        titleTestId="invoice-code"
      />
      <Card className="flex flex-col gap-2">
        <p>{invoiceKindLabel(detail.kind)}</p>
        <p>{formatInvoiceDate(detail.issued_at)}</p>
        <p data-testid="invoice-parties">
          {recipientLabel && <>Para: {recipientLabel} · Paciente: </>}
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
      <Card className="flex flex-wrap items-start gap-2">
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
          key={`send-${detail.id}`}
          invoiceId={detail.id}
          proposedEmail={proposedEmail}
          saveEmail={proposedEmail === "" && !minor}
          asDrawer
        />
        {detail.kind === "simplified" && inForce && (
          <FullInvoiceForm
            key={`full-${detail.id}`}
            invoiceId={detail.id}
            recipient={recipientDraft({
              patient,
              guardian,
              minor,
              lastRecipient,
            })}
            asDrawer
          />
        )}
        {detail.kind === "full" && canRectify && recipient && (
          <FullInvoiceForm
            key={`correct-${detail.id}`}
            invoiceId={detail.id}
            recipient={recipientFromInvoice(recipient)}
            correct
            asDrawer
          />
        )}
        {canRectify && (
          <div>
            <VoidPaymentDialog
              paymentId={detail.payment_id}
              invoiceId={detail.id}
              triggerLabel="Emitir rectificativa"
              triggerTestId="invoice-rectify"
            />
          </div>
        )}
      </Card>
    </>
  );
}

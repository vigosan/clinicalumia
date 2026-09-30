import { madridDateTime, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@clinicalumia/ui/table";
import Link from "next/link";
import { patientsListState } from "@/lib/patients-list-state";
import { formatEuros, methodLabel, totalsByMethod } from "@/lib/payments";
import { cobrosListParams, loadCobros } from "@/lib/payments-load";
import { CobrosFilters } from "./CobrosFilters";

export default async function CobrosPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    profesional?: string;
  }>;
}) {
  const search = await searchParams;
  const params = cobrosListParams(search, todayInMadrid());
  const supabase = await createClient();
  const result = await loadCobros(supabase, params);

  const payments = result.ok ? result.data.payments : [];
  const staffOptions = result.ok ? result.data.staffOptions : [];
  const nameById = result.ok ? result.data.nameById : new Map<string, string>();
  const totals = totalsByMethod(
    payments.map((payment) => ({
      amount_cents: payment.amountCents,
      method: payment.method,
      voided_at: payment.voidedAt,
    })),
  );
  const state = patientsListState(!result.ok, payments.length);

  return (
    <>
      <PageHeader title="Cobros" />
      <Card>
        <CobrosFilters params={params} staffOptions={staffOptions} />
      </Card>
      {state === "error" && (
        <Card
          role="alert"
          className="text-center text-sm text-danger-600"
          data-testid="payments-error"
        >
          No se ha podido cargar el listado. Recarga la página.
        </Card>
      )}
      {state === "empty" && (
        <Card
          className="text-center text-sm text-ink-800"
          data-testid="payments-empty"
        >
          No hay cobros en estas fechas.
        </Card>
      )}
      {state === "list" && (
        <>
          <Table aria-label="Cobros" data-testid="payments-list">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Hora</TableHeaderCell>
                <TableHeaderCell>Paciente</TableHeaderCell>
                <TableHeaderCell>Servicio</TableHeaderCell>
                <TableHeaderCell>Profesional</TableHeaderCell>
                <TableHeaderCell>Importe</TableHeaderCell>
                <TableHeaderCell>Forma</TableHeaderCell>
                <TableHeaderCell>Quién cobró</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((payment) => (
                <TableRow
                  key={payment.id}
                  data-testid="payment-row"
                  className={payment.voidedAt ? "opacity-60" : undefined}
                >
                  <TableCell>
                    {madridDateTime(payment.collectedAt).time.slice(0, 5)}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/patients/${payment.patientId}`}>
                      {payment.patientName}
                    </Link>
                  </TableCell>
                  <TableCell>{payment.serviceName}</TableCell>
                  <TableCell>
                    {nameById.get(payment.professionalId) ?? "Profesional"}
                  </TableCell>
                  <TableCell>{formatEuros(payment.amountCents)}</TableCell>
                  <TableCell>{methodLabel(payment.method)}</TableCell>
                  <TableCell>
                    {nameById.get(payment.collectedBy) ?? "Alguien"}
                  </TableCell>
                  <TableCell>
                    {payment.voidedAt && (
                      <span
                        data-testid="payment-voided"
                        title={payment.voidReason}
                      >
                        Anulado
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div
            data-testid="payments-totals"
            className="flex flex-wrap items-center gap-4 text-sm text-ink-900"
          >
            {totals.methods.map((entry) => (
              <span
                key={entry.method}
                data-testid="payments-total-method"
                data-method={entry.method}
              >
                {methodLabel(entry.method)}: {formatEuros(entry.cents)}
              </span>
            ))}
            <span data-testid="payments-total-amount" className="font-semibold">
              Total: {formatEuros(totals.total)}
            </span>
          </div>
        </>
      )}
    </>
  );
}

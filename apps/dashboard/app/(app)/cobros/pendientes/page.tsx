import { createClient } from "@clinicalumia/api/server";
import { Button } from "@clinicalumia/ui/button";
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
import { formatEuros } from "@/lib/payments";
import { loadPendingPayments } from "@/lib/pending-payments";

export default async function PendingPaymentsPage() {
  const supabase = await createClient();
  const result = await loadPendingPayments(supabase, new Date());

  const rows = result.ok ? result.data : [];
  const state = patientsListState(!result.ok, rows.length);

  return (
    <>
      <PageHeader title="Pendientes de cobro" />
      {state === "error" && (
        <Card
          role="alert"
          className="text-center text-sm text-danger-600"
          data-testid="payments-pending-error"
        >
          No se ha podido cargar el listado. Recarga la página.
        </Card>
      )}
      {state === "empty" && (
        <Card
          className="text-center text-sm text-ink-800"
          data-testid="payments-pending-empty"
        >
          No hay citas pendientes de cobro.
        </Card>
      )}
      {state === "list" && (
        <Table aria-label="Pendientes de cobro" data-testid="payments-pending">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Fecha y hora</TableHeaderCell>
              <TableHeaderCell>Paciente</TableHeaderCell>
              <TableHeaderCell>Servicio</TableHeaderCell>
              <TableHeaderCell>Profesional</TableHeaderCell>
              <TableHeaderCell>Importe propuesto</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} data-testid="pending-payment-row">
                <TableCell>{row.moment}</TableCell>
                <TableCell className="font-medium">{row.patientName}</TableCell>
                <TableCell>{row.serviceName}</TableCell>
                <TableCell>{row.professionalName}</TableCell>
                <TableCell>{formatEuros(row.suggestedAmountCents)}</TableCell>
                <TableCell>
                  <Button
                    asChild
                    size="sm"
                    data-testid="pending-payment-collect"
                  >
                    <Link href={row.href}>Cobrar</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

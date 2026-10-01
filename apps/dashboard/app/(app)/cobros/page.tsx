import { todayInMadrid } from "@clinicalumia/api/madrid-time";
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
import type { Metadata } from "next";
import Link from "next/link";
import { patientsListState } from "@/lib/patients-list-state";
import { pendingTabLabel } from "@/lib/payment-candidates";
import { formatEuros, methodLabel } from "@/lib/payments";
import {
  cobrosListParams,
  formatPaymentMoment,
  loadCobros,
  momentHeader,
  paymentStateLabel,
} from "@/lib/payments-load";
import {
  loadLaterTodayCandidates,
  loadPendingPayments,
  PENDING_WINDOW_DAYS,
} from "@/lib/pending-payments";
import { CobrosFilters } from "./CobrosFilters";
import { CobrosTabs } from "./CobrosTabs";
import { RegisterPaymentDialog } from "./RegisterPaymentDialog";

export const metadata: Metadata = { title: "Cobros" };

export default async function CobrosPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    profesional?: string;
    tab?: string;
  }>;
}) {
  const search = await searchParams;
  const params = cobrosListParams(search, todayInMadrid());
  const supabase = await createClient();
  const now = new Date();
  const [result, pendingResult, laterTodayResult] = await Promise.all([
    loadCobros(supabase, params),
    loadPendingPayments(supabase, now),
    loadLaterTodayCandidates(supabase, now),
  ]);

  const payments = result.ok ? result.data.payments : [];
  const staffOptions = result.ok ? result.data.staffOptions : [];
  const nameById = result.ok ? result.data.nameById : new Map<string, string>();
  const isOwner = result.ok ? result.data.isOwner : false;
  const totals = result.ok ? result.data.totals : { methods: [], total: 0 };
  const truncated = result.ok && result.data.truncated;
  const state = patientsListState(!result.ok, payments.length);
  const showDate = params.desde !== params.hasta;
  const pendingRows = pendingResult.ok ? pendingResult.data : [];
  const pendingState = patientsListState(!pendingResult.ok, pendingRows.length);
  const candidates = [
    ...(laterTodayResult.ok ? laterTodayResult.data : []),
    ...pendingRows,
  ];
  const nowIso = now.toISOString();

  return (
    <>
      <PageHeader
        title="Cobros"
        description="Dinero recibido por las citas."
        actions={
          <RegisterPaymentDialog
            trigger={
              <Button size="sm" data-testid="payments-register">
                Registrar cobro
              </Button>
            }
            now={nowIso}
            candidates={candidates}
            loadError={!pendingResult.ok || !laterTodayResult.ok}
          />
        }
      />
      <CobrosTabs
        initialTab={search.tab === "pendientes" ? "pendientes" : "cobrados"}
        pendingLabel={pendingTabLabel(
          pendingResult.ok ? pendingRows.length : null,
        )}
        cobrados={
          <>
            <Card>
              <CobrosFilters
                params={params}
                staffOptions={staffOptions}
                isOwner={isOwner}
              />
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
                No hay cobros en estas fechas. Los cobros se registran desde
                cada cita: usa «Registrar cobro» o revisa «Pendientes».
              </Card>
            )}
            {state === "list" && (
              <>
                <div
                  data-testid="payments-totals"
                  className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
                >
                  <Card className="col-span-2 flex flex-col gap-1 bg-sage-100 p-5 sm:col-span-1">
                    <p className="text-xs font-medium text-ink-700 uppercase tracking-[0.08em]">
                      Total
                    </p>
                    <p
                      data-testid="payments-total-amount"
                      className="font-bold text-2xl text-ink-900 tabular-nums"
                    >
                      {formatEuros(totals.total)}
                    </p>
                  </Card>
                  {totals.methods.map((entry) => (
                    <Card
                      key={entry.method}
                      data-testid="payments-total-method"
                      data-method={entry.method}
                      className="flex flex-col gap-1 p-5"
                    >
                      <p className="text-xs font-medium text-ink-700 uppercase tracking-[0.08em]">
                        {methodLabel(entry.method)}
                      </p>
                      <p className="font-semibold text-ink-900 text-xl tabular-nums">
                        {formatEuros(entry.cents)}
                      </p>
                    </Card>
                  ))}
                </div>
                <Table aria-label="Cobros" data-testid="payments-list">
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>
                        {momentHeader(showDate)}
                      </TableHeaderCell>
                      <TableHeaderCell>Paciente</TableHeaderCell>
                      <TableHeaderCell>Servicio</TableHeaderCell>
                      <TableHeaderCell>Profesional</TableHeaderCell>
                      <TableHeaderCell>Importe</TableHeaderCell>
                      <TableHeaderCell>Forma de pago</TableHeaderCell>
                      <TableHeaderCell>Cobrado por</TableHeaderCell>
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
                          {formatPaymentMoment(payment.collectedAt, showDate)}
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link href={`/patients/${payment.patientId}`}>
                            {payment.patientName}
                          </Link>
                        </TableCell>
                        <TableCell>{payment.serviceName}</TableCell>
                        <TableCell>
                          {nameById.get(payment.professionalId) ??
                            "Profesional"}
                        </TableCell>
                        <TableCell>
                          {formatEuros(payment.amountCents)}
                        </TableCell>
                        <TableCell>{methodLabel(payment.method)}</TableCell>
                        <TableCell>
                          {nameById.get(payment.collectedBy) ?? "Alguien"}
                        </TableCell>
                        <TableCell data-testid="payment-state">
                          {paymentStateLabel(payment)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {truncated && (
                  <p
                    className="text-[13px] text-ink-800"
                    data-testid="payments-truncated"
                  >
                    Hay más cobros de los que se pueden mostrar; acota las
                    fechas.
                  </p>
                )}
              </>
            )}
          </>
        }
        pendientes={
          <>
            {pendingState === "error" && (
              <Card
                role="alert"
                className="text-center text-sm text-danger-600"
                data-testid="payments-pending-error"
              >
                No se ha podido cargar el listado. Recarga la página.
              </Card>
            )}
            {pendingState === "empty" && (
              <Card
                className="text-center text-sm text-ink-800"
                data-testid="payments-pending-empty"
              >
                No hay citas pendientes de cobro en los últimos{" "}
                {PENDING_WINDOW_DAYS} días.
              </Card>
            )}
            {pendingState === "list" && (
              <Table
                aria-label="Pendientes de cobro"
                data-testid="payments-pending"
              >
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Fecha y hora</TableHeaderCell>
                    <TableHeaderCell>Paciente</TableHeaderCell>
                    <TableHeaderCell>Servicio</TableHeaderCell>
                    <TableHeaderCell>Profesional</TableHeaderCell>
                    <TableHeaderCell>Importe</TableHeaderCell>
                    <TableHeaderCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingRows.map((row) => (
                    <TableRow key={row.id} data-testid="pending-payment-row">
                      <TableCell>
                        <Link href={row.href}>{row.moment}</Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.patientName}
                      </TableCell>
                      <TableCell>{row.serviceName}</TableCell>
                      <TableCell>{row.professionalName}</TableCell>
                      <TableCell>
                        {formatEuros(row.suggestedAmountCents)}
                      </TableCell>
                      <TableCell>
                        <RegisterPaymentDialog
                          trigger={
                            <Button
                              size="sm"
                              data-testid="pending-payment-collect"
                            >
                              Cobrar
                            </Button>
                          }
                          now={nowIso}
                          preselected={row}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        }
      />
    </>
  );
}

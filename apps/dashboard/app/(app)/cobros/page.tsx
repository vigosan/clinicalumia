import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { Alert } from "@clinicalumia/ui/alert";
import { Button } from "@clinicalumia/ui/button";
import { Card } from "@clinicalumia/ui/card";
import { EmptyState } from "@clinicalumia/ui/empty-state";
import { eyebrowClass, PageHeader } from "@clinicalumia/ui/page-header";
import {
  rowLinkClass,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@clinicalumia/ui/table";
import { CircleCheck, Plus, Wallet } from "lucide-react";
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
                <Plus aria-hidden="true" />
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
            <CobrosFilters
              params={params}
              staffOptions={staffOptions}
              isOwner={isOwner}
            />
            {state === "error" && (
              <Alert data-testid="payments-error">
                No se ha podido cargar el listado. Recarga la página.
              </Alert>
            )}
            {state === "empty" && (
              <EmptyState
                data-testid="payments-empty"
                icon={<Wallet />}
                title="No hay cobros en estas fechas."
                description="Usa «Registrar cobro» o revisa «Pendientes»."
              />
            )}
            {state === "list" && (
              <>
                <div
                  data-testid="payments-totals"
                  className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
                >
                  <Card className="col-span-2 flex flex-col gap-1 bg-sage-100 p-5 sm:col-span-1">
                    <p className={eyebrowClass}>Total</p>
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
                      <p className={eyebrowClass}>
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
                      <TableHeaderCell numeric>Importe</TableHeaderCell>
                      <TableHeaderCell>Forma de pago</TableHeaderCell>
                      <TableHeaderCell>Cobrado por</TableHeaderCell>
                      <TableHeaderCell>Estado</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow
                        key={`${payment.id}-${payment.entry}`}
                        data-testid="payment-row"
                        data-entry={payment.entry}
                      >
                        <TableCell label={momentHeader(showDate)}>
                          {formatPaymentMoment(payment.moment, showDate)}
                        </TableCell>
                        <TableCell className="font-medium max-md:order-first max-md:text-[15px]">
                          <Link href={`/patients/${payment.patientId}`}>
                            {payment.patientName}
                          </Link>
                        </TableCell>
                        <TableCell label="Servicio">
                          {payment.serviceName}
                        </TableCell>
                        <TableCell label="Profesional">
                          {nameById.get(payment.professionalId) ??
                            "Profesional"}
                        </TableCell>
                        <TableCell
                          label="Importe"
                          numeric
                          data-testid="payment-row-amount"
                        >
                          {formatEuros(payment.amountCents)}
                        </TableCell>
                        <TableCell label="Forma de pago">
                          {methodLabel(payment.method)}
                        </TableCell>
                        <TableCell label="Cobrado por">
                          {nameById.get(payment.collectedBy) ?? "Alguien"}
                        </TableCell>
                        <TableCell label="Estado" data-testid="payment-state">
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
              <Alert data-testid="payments-pending-error">
                No se ha podido cargar el listado. Recarga la página.
              </Alert>
            )}
            {pendingState === "empty" && (
              <EmptyState
                data-testid="payments-pending-empty"
                icon={<CircleCheck />}
                title={`No hay citas pendientes de cobro en los últimos ${PENDING_WINDOW_DAYS} días.`}
              />
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
                    <TableHeaderCell numeric>Importe</TableHeaderCell>
                    <TableHeaderCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingRows.map((row) => (
                    <TableRow
                      key={row.id}
                      linked
                      data-testid="pending-payment-row"
                    >
                      <TableCell label="Fecha y hora">
                        <Link href={row.href} className={rowLinkClass}>
                          {row.moment}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium max-md:order-first max-md:text-[15px]">
                        {row.patientName}
                      </TableCell>
                      <TableCell label="Servicio">{row.serviceName}</TableCell>
                      <TableCell label="Profesional">
                        {row.professionalName}
                      </TableCell>
                      <TableCell
                        label="Importe"
                        numeric
                        data-testid="pending-payment-amount"
                      >
                        {formatEuros(row.suggestedAmountCents)}
                      </TableCell>
                      <TableCell className="relative z-10 text-right max-md:mt-2 max-md:justify-end">
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
                          focusAfterSuccess='[data-testid="payments-tab-pendientes"]'
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

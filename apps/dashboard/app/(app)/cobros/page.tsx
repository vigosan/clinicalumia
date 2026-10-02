import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { Alert } from "@clinicalumia/ui/alert";
import { Button } from "@clinicalumia/ui/button";
import { EmptyState } from "@clinicalumia/ui/empty-state";
import { PageHeader } from "@clinicalumia/ui/page-header";
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
import { Fragment } from "react";
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
                  className="flex flex-wrap items-end gap-x-8 gap-y-1"
                >
                  <div className="flex flex-col">
                    <p className="text-ink-700 text-xs">Total</p>
                    <p
                      data-testid="payments-total-amount"
                      className="font-bold text-[32px] text-ink-900 leading-tight tabular-nums"
                    >
                      {formatEuros(totals.total)}
                    </p>
                  </div>
                  <p className="pb-1 text-[15px] text-ink-800">
                    {totals.methods.map((entry, index) => (
                      <Fragment key={entry.method}>
                        {index > 0 && " · "}
                        <span
                          data-testid="payments-total-method"
                          data-method={entry.method}
                        >
                          {methodLabel(entry.method)}{" "}
                          <span className="text-ink-900 tabular-nums">
                            {entry.cents === null
                              ? "—"
                              : formatEuros(entry.cents)}
                          </span>
                        </span>
                      </Fragment>
                    ))}
                  </p>
                </div>
                <Table
                  aria-label="Cobros"
                  variant="list"
                  data-testid="payments-list"
                >
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
                        <TableCell
                          label={momentHeader(showDate)}
                          mobile="secondary"
                        >
                          {formatPaymentMoment(payment.moment, showDate)}
                        </TableCell>
                        <TableCell className="font-medium" mobile="primary">
                          <Link href={`/patients/${payment.patientId}`}>
                            {payment.patientName}
                          </Link>
                        </TableCell>
                        <TableCell label="Servicio" mobile="secondary">
                          {payment.serviceName}
                        </TableCell>
                        <TableCell label="Profesional" mobile="hidden">
                          {nameById.get(payment.professionalId) ??
                            "Profesional"}
                        </TableCell>
                        <TableCell
                          label="Importe"
                          numeric
                          mobile="trailing"
                          data-testid="payment-row-amount"
                        >
                          {formatEuros(payment.amountCents)}
                        </TableCell>
                        <TableCell label="Forma de pago" mobile="secondary">
                          {methodLabel(payment.method)}
                        </TableCell>
                        <TableCell label="Cobrado por" mobile="hidden">
                          {nameById.get(payment.collectedBy) ?? "Alguien"}
                        </TableCell>
                        <TableCell
                          label="Estado"
                          mobile={
                            payment.entry === "voided" || payment.voidedAt
                              ? "secondary"
                              : "hidden"
                          }
                          data-testid="payment-state"
                        >
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
                variant="list"
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
                      <TableCell label="Fecha y hora" mobile="secondary">
                        <Link href={row.href} className={rowLinkClass}>
                          {row.moment}
                        </Link>
                      </TableCell>
                      <TableCell
                        className="font-medium"
                        mobile="primary"
                        data-testid="pending-payment-patient"
                      >
                        {row.patientName}
                      </TableCell>
                      <TableCell label="Servicio" mobile="secondary">
                        {row.serviceName}
                      </TableCell>
                      <TableCell label="Profesional" mobile="secondary">
                        {row.professionalName}
                      </TableCell>
                      <TableCell
                        label="Importe"
                        numeric
                        mobile="trailing"
                        data-testid="pending-payment-amount"
                      >
                        {formatEuros(row.suggestedAmountCents)}
                      </TableCell>
                      <TableCell
                        className="relative z-10 text-right"
                        mobile="action"
                      >
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

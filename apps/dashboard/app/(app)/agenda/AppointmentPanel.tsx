"use client";

import { Alert } from "@clinicalumia/ui/alert";
import { Badge } from "@clinicalumia/ui/badge";
import { Button } from "@clinicalumia/ui/button";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import { Drawer } from "@clinicalumia/ui/drawer";
import { eyebrowClass } from "@clinicalumia/ui/page-header";
import type { SelectOption } from "@clinicalumia/ui/select";
import { toast } from "@clinicalumia/ui/toast";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { adjacentAppointments, isUuid } from "@/lib/agenda";
import { formatMinutes } from "@/lib/duration";
import {
  type CurrentInvoice,
  invoiceIssuedLabel,
  type RecipientDraft,
} from "@/lib/invoices";
import { paymentToastMessage } from "@/lib/payment-candidates";
import type { PaymentMethod } from "@/lib/payments";
import { markNoShow, restoreFromNoShow } from "../appointments/actions";
import { DrawerLink, showUrl } from "../url-drawer";
import { buildHref } from "./AgendaColumn";
import { fetchAppointmentDetail } from "./actions";
import { CancelDialog } from "./CancelDialog";
import { FullInvoiceForm } from "./FullInvoiceForm";
import type { AppointmentDetailResult } from "./load-detail";
import { MoveForm } from "./MoveForm";
import { PaymentForm } from "./PaymentForm";
import { SendInvoiceForm } from "./SendInvoiceForm";
import { VoidPaymentDialog } from "./VoidPaymentDialog";

export type AppointmentDetail = {
  id: string;
  patientId: string;
  patientName: string;
  professionalId: string;
  professionalName: string;
  professionalOptions: SelectOption[] | null;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "cancelled" | "no_show";
  origin: "staff" | "web";
  notes: string;
  priceCents: number;
  paymentStatus: string;
  suggestedAmountCents: number;
  canCollect: boolean;
  activePaymentId: string | null;
  invoice: (CurrentInvoice & { email: string; saveEmail: boolean }) | null;
  recipient: RecipientDraft;
  canVoid: boolean;
  canMove: boolean;
  canMarkNoShow: boolean;
  canCancel: boolean;
  canRestore: boolean;
  canNotify: boolean;
  initialDate: string;
  initialTime: string;
  history: { id: string; text: string }[];
};

const STATUS_LABEL: Record<AppointmentDetail["status"], string> = {
  scheduled: "Programada",
  cancelled: "Cancelada",
  no_show: "No presentada",
};

const STATUS_TONE: Record<
  AppointmentDetail["status"],
  "success" | "neutral" | "warning"
> = {
  scheduled: "success",
  cancelled: "neutral",
  no_show: "warning",
};

function timeOf(instant: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instant));
}

function dateOf(instant: string): string {
  const formatted = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(instant));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatPrice(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

function AppointmentDetails({
  appointment,
}: {
  appointment: AppointmentDetail;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [moving, setMoving] = useState(false);
  const [status, setOptimisticStatus] = useOptimistic(appointment.status);
  const isPast = appointment.canMarkNoShow || appointment.canRestore;
  const canMarkNoShow = isPast && status === "scheduled";
  const canRestore = status === "no_show";
  const canCancel = appointment.canCancel && status === "scheduled";

  function handlePaid({
    cents,
    method,
  }: {
    cents: number;
    method: PaymentMethod;
  }) {
    toast(paymentToastMessage(cents, method));
  }

  function handleNoShow() {
    startTransition(async () => {
      setOptimisticStatus("no_show");
      const result = await markNoShow(appointment.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      toast("Cita marcada como no presentada");
    });
  }

  function handleRestore() {
    startTransition(async () => {
      setOptimisticStatus("scheduled");
      const result = await restoreFromNoShow(appointment.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      toast("Se deshizo «no presentada»");
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Badge tone={STATUS_TONE[status]} data-testid="appointment-status">
          {canMarkNoShow ? "Realizada" : STATUS_LABEL[status]}
        </Badge>
        {appointment.origin === "web" && (
          <Badge tone="neutral" data-testid="web-booking-badge">
            Reserva web
          </Badge>
        )}
      </div>

      {appointment.notes && (
        <p className="text-[13px] text-ink-800">{appointment.notes}</p>
      )}

      <div className="flex flex-col gap-1 border-line border-t pt-4">
        <h2 className={eyebrowClass}>Cobro</h2>
        <p className="text-ink-900">{formatPrice(appointment.priceCents)}</p>
        {appointment.paymentStatus && (
          <p
            className="text-[13px] text-ink-800"
            data-testid="appointment-payment-status"
          >
            {appointment.paymentStatus}
          </p>
        )}
        {appointment.canCollect && (
          <PaymentForm
            appointmentId={appointment.id}
            suggestedAmountCents={appointment.suggestedAmountCents}
            cancelled={appointment.status === "cancelled"}
            recipient={appointment.recipient}
            onSuccess={handlePaid}
          />
        )}
        {appointment.invoice && (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-ink-800" data-testid="invoice-code">
              Factura {appointment.invoice.code}
            </p>
            <p
              className="text-[13px] text-ink-800"
              data-testid="invoice-issued"
            >
              {invoiceIssuedLabel(appointment.invoice.issuedAt)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm">
                <a
                  href={`/facturas/${appointment.invoice.id}/pdf`}
                  target="_blank"
                  rel="noopener"
                  data-testid="invoice-view"
                >
                  Ver / Imprimir
                </a>
              </Button>
              {appointment.canVoid && (
                <Button asChild variant="secondary" size="sm">
                  <Link
                    href={`/facturas/${appointment.invoice.id}`}
                    data-testid="invoice-rectify-link"
                  >
                    Rectificar
                  </Link>
                </Button>
              )}
            </div>
            <SendInvoiceForm
              key={`send-${appointment.invoice.id}`}
              invoiceId={appointment.invoice.id}
              proposedEmail={appointment.invoice.email}
              saveEmail={appointment.invoice.saveEmail}
            />
            {appointment.invoice.kind === "simplified" && (
              <FullInvoiceForm
                key={`full-${appointment.invoice.id}`}
                invoiceId={appointment.invoice.id}
                recipient={appointment.recipient}
              />
            )}
          </div>
        )}
        {appointment.activePaymentId && appointment.canVoid && (
          <div>
            <VoidPaymentDialog
              paymentId={appointment.activePaymentId}
              invoiceId={appointment.invoice?.id ?? null}
            />
          </div>
        )}
      </div>

      {(canCancel || canMarkNoShow || canRestore) && (
        <div className="flex flex-wrap gap-2 border-line border-t pt-4">
          {canCancel && (
            <CancelDialog
              appointmentId={appointment.id}
              invoiced={appointment.invoice !== null}
              canRectify={appointment.canVoid}
              canNotify={appointment.canNotify}
              disabled={moving}
            />
          )}
          {canMarkNoShow && (
            <ConfirmDialog
              trigger={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending || moving}
                  data-testid="appointment-no-show"
                >
                  Marcar como no presentada
                </Button>
              }
              title="¿Marcar como no presentada?"
              description="Podrás deshacerlo después."
              confirmLabel="Marcar como no presentada"
              onConfirm={handleNoShow}
            />
          )}
          {canRestore && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending || moving}
              data-testid="appointment-restore"
              onClick={handleRestore}
            >
              Deshacer «no presentada»
            </Button>
          )}
        </div>
      )}

      {appointment.canMove && (
        <div className="flex flex-col gap-3 border-line border-t pt-4">
          <h2 className={eyebrowClass}>Cambiar fecha u hora</h2>
          <MoveForm
            appointmentId={appointment.id}
            patientId={appointment.patientId}
            serviceId={appointment.serviceId}
            professionalId={appointment.professionalId}
            professionalOptions={appointment.professionalOptions}
            professionalLocked={appointment.invoice !== null}
            durationMinutes={appointment.durationMinutes}
            initialDate={appointment.initialDate}
            initialTime={appointment.initialTime}
            canNotify={appointment.canNotify}
            onPendingChange={setMoving}
          />
        </div>
      )}

      {error && (
        <p
          role="alert"
          data-testid="appointment-action-error"
          className="text-[13px] text-danger-600"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 border-line border-t pt-4">
        <h2 className={eyebrowClass}>Historial</h2>
        <ul data-testid="appointment-history" className="flex flex-col gap-1">
          {appointment.history.map((entry) => (
            <li
              key={entry.id}
              data-testid="history-item"
              className="text-[13px] text-ink-800"
            >
              {entry.text}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

type AppointmentSummary = {
  id: string;
  professionalId: string;
  startsAt: string;
  endsAt: string;
  patientName: string;
  serviceName: string;
};

export function AppointmentPanel({
  serverAppointmentId,
  serverResult,
  appointments,
  columnOrder,
  closeHref,
  linkParams,
}: {
  serverAppointmentId: string | null;
  serverResult: AppointmentDetailResult;
  appointments: AppointmentSummary[];
  columnOrder: string[];
  closeHref: string;
  linkParams: Record<string, string | undefined>;
}) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("appointment");
  const id = requested && isUuid(requested) ? requested : null;
  const [lastId, setLastId] = useState(id);
  if (id !== null && id !== lastId) setLastId(id);
  const shownId = id ?? lastId;
  const fromServer =
    shownId !== null && shownId === serverAppointmentId ? serverResult : null;
  const [fetched, setFetched] = useState<{
    id: string;
    result: AppointmentDetailResult;
  } | null>(null);
  const result =
    fromServer ?? (fetched?.id === shownId ? fetched.result : null);
  const needsFetch = id !== null && fromServer === null;

  useEffect(() => {
    if (!id || !needsFetch) return;
    let current = true;
    fetchAppointmentDetail(id).then((loaded) => {
      if (current) setFetched({ id, result: loaded });
    });
    return () => {
      current = false;
    };
  }, [id, needsFetch]);

  const summary = appointments.find(
    (appointment) => appointment.id === shownId,
  );
  const detail = result?.status === "ok" ? result.detail : null;
  const { previousId, nextId } = shownId
    ? adjacentAppointments(appointments, shownId, columnOrder)
    : { previousId: null, nextId: null };
  const previousHref = previousId
    ? buildHref("/", { ...linkParams, appointment: previousId })
    : null;
  const nextHref = nextId
    ? buildHref("/", { ...linkParams, appointment: nextId })
    : null;

  function handleOpenChange(next: boolean) {
    if (next) return;
    showUrl(closeHref);
  }

  function focusAppointment(event: Event) {
    const block = Array.from(
      document.querySelectorAll<HTMLElement>(`[data-appointment="${shownId}"]`),
    ).find((element) => element.getClientRects().length > 0);
    if (!block) return;
    event.preventDefault();
    block.focus();
  }

  return (
    <Drawer
      open={id !== null && result?.status !== "none"}
      onOpenChange={handleOpenChange}
      onCloseAutoFocus={focusAppointment}
      data-testid="appointment-panel"
      description={
        detail ? (
          <span data-testid="appointment-panel-date">
            {dateOf(detail.startsAt)} · {timeOf(detail.startsAt)} –{" "}
            {timeOf(detail.endsAt)} · {detail.professionalName}
          </span>
        ) : summary ? (
          `${dateOf(summary.startsAt)} · ${timeOf(summary.startsAt)} – ${timeOf(summary.endsAt)}`
        ) : (
          "Cita"
        )
      }
      title={
        detail ? (
          <Link
            href={`/patients/${detail.patientId}`}
            className="underline-offset-2 hover:underline"
          >
            {detail.patientName}
          </Link>
        ) : (
          (summary?.patientName ?? "Cargando…")
        )
      }
    >
      <p className="-mt-4 text-[13px] text-ink-800">
        {detail
          ? `${detail.serviceName} · ${formatMinutes(detail.durationMinutes)}`
          : summary?.serviceName}
      </p>

      {(previousHref || nextHref) && (
        <nav aria-label="Otras citas de la agenda" className="flex gap-2">
          {previousHref && (
            <Button asChild variant="secondary" size="sm">
              <DrawerLink
                href={previousHref}
                scroll={false}
                data-testid="appointment-previous"
              >
                <ChevronLeft aria-hidden="true" className="-ml-1" />
                Cita anterior
              </DrawerLink>
            </Button>
          )}
          {nextHref && (
            <Button asChild variant="secondary" size="sm" className="ml-auto">
              <DrawerLink
                href={nextHref}
                scroll={false}
                data-testid="appointment-next"
              >
                Cita siguiente
                <ChevronRight aria-hidden="true" className="-mr-1" />
              </DrawerLink>
            </Button>
          )}
        </nav>
      )}

      {detail ? (
        <AppointmentDetails key={detail.id} appointment={detail} />
      ) : result?.status === "error" ? (
        <Alert data-testid="appointment-panel-error">
          No se ha podido cargar la cita.
        </Alert>
      ) : (
        <div
          role="status"
          data-testid="appointment-panel-loading"
          className="flex flex-col gap-3"
        >
          <span className="sr-only">Cargando…</span>
          <div className="h-5 w-40 animate-pulse rounded-lg bg-cream-200" />
          <div className="h-24 animate-pulse rounded-card bg-cream-200" />
        </div>
      )}
    </Drawer>
  );
}

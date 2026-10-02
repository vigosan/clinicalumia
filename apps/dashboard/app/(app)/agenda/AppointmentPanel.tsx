"use client";

import { Alert } from "@clinicalumia/ui/alert";
import { Badge } from "@clinicalumia/ui/badge";
import { Button } from "@clinicalumia/ui/button";
import { cn } from "@clinicalumia/ui/cn";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import { Drawer } from "@clinicalumia/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@clinicalumia/ui/dropdown-menu";
import { eyebrowClass } from "@clinicalumia/ui/page-header";
import type { SelectOption } from "@clinicalumia/ui/select";
import { toast } from "@clinicalumia/ui/toast";
import {
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  FilePen,
  FileText,
  Mail,
  Printer,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { adjacentAppointments, isUuid } from "@/lib/agenda";
import type { Closure } from "@/lib/closures";
import { formatMinutes } from "@/lib/duration";
import {
  type CurrentInvoice,
  invoiceIssuedLabel,
  type RecipientDraft,
} from "@/lib/invoices";
import { formatShortMadridDay } from "@/lib/madrid-format";
import { paymentToastMessage } from "@/lib/payment-candidates";
import type { PaymentMethod, PaymentPill } from "@/lib/payments";
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
  amountCents: number;
  paymentPill: PaymentPill | null;
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
  closures: Closure[];
};

type ShownStatus = AppointmentDetail["status"] | "done";

const STATUS_LABEL: Record<ShownStatus, string> = {
  scheduled: "Programada",
  done: "Realizada",
  cancelled: "Cancelada",
  no_show: "No presentada",
};

const STATUS_TONE: Record<
  ShownStatus,
  "outline" | "success" | "neutral" | "warning"
> = {
  scheduled: "outline",
  done: "success",
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

const iconButtonClass =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-tertiary hover:bg-sage-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-sage-800 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-5";

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
  const shownStatus = canMarkNoShow ? "done" : status;
  const invoice = appointment.invoice;
  const canVoidActivePayment =
    appointment.activePaymentId !== null && appointment.canVoid;
  const [invoiceAction, setInvoiceAction] = useState<
    "send" | "full" | "void" | null
  >(null);

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
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            tone={STATUS_TONE[shownStatus]}
            className={cn(status === "cancelled" && "line-through")}
            data-testid="appointment-status"
          >
            {STATUS_LABEL[shownStatus]}
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
      </div>

      <div className="flex flex-col gap-3 border-line border-t pt-4">
        <h2 className={eyebrowClass}>Cobro</h2>
        <div className="flex items-center justify-between gap-3">
          <p
            className="font-bold text-[28px] text-ink-900 tabular-nums leading-none"
            data-testid="appointment-amount"
          >
            {formatPrice(appointment.amountCents)}
          </p>
          {appointment.paymentPill && (
            <Badge
              tone={appointment.paymentPill.tone}
              data-testid="appointment-payment-status"
            >
              {appointment.paymentPill.label}
            </Badge>
          )}
        </div>
        {appointment.canCollect && (
          <PaymentForm
            appointmentId={appointment.id}
            suggestedAmountCents={appointment.suggestedAmountCents}
            cancelled={appointment.status === "cancelled"}
            recipient={appointment.recipient}
            onSuccess={handlePaid}
          />
        )}
        {(invoice || canVoidActivePayment) && (
          <div className="flex items-center justify-between gap-3">
            {invoice ? (
              <div className="flex min-w-0 flex-col gap-0.5">
                <p
                  className="font-semibold text-[15px] text-ink-900 tabular-nums"
                  data-testid="invoice-code"
                >
                  Factura {invoice.code}
                </p>
                <p
                  className="text-[13px] text-ink-800"
                  data-testid="invoice-issued"
                >
                  {invoiceIssuedLabel(invoice.issuedAt)}
                </p>
              </div>
            ) : (
              <span />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  aria-label="Acciones del cobro"
                  data-testid="payment-menu"
                >
                  <Ellipsis aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {invoice && (
                  <>
                    <DropdownMenuItem asChild>
                      <a
                        href={`/facturas/${invoice.id}/pdf`}
                        target="_blank"
                        rel="noopener"
                        data-testid="invoice-view"
                      >
                        <Printer aria-hidden="true" />
                        Ver / Imprimir
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      data-testid="invoice-send"
                      onSelect={() => setInvoiceAction("send")}
                    >
                      <Mail aria-hidden="true" />
                      Enviar por email
                    </DropdownMenuItem>
                    {invoice.kind === "simplified" && (
                      <DropdownMenuItem
                        data-testid="invoice-full"
                        onSelect={() => setInvoiceAction("full")}
                      >
                        <FileText aria-hidden="true" />
                        Factura completa
                      </DropdownMenuItem>
                    )}
                    {appointment.canVoid && (
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/facturas/${invoice.id}`}
                          data-testid="invoice-rectify-link"
                        >
                          <FilePen aria-hidden="true" />
                          Rectificar
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                {canVoidActivePayment && (
                  <>
                    {invoice && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      data-testid="payment-void"
                      className="text-danger-600 [&_svg]:text-danger-600"
                      onSelect={() => setInvoiceAction("void")}
                    >
                      <Undo2 aria-hidden="true" />
                      Anular cobro
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        {invoice && (
          <>
            <SendInvoiceForm
              key={`send-${invoice.id}`}
              invoiceId={invoice.id}
              proposedEmail={invoice.email}
              saveEmail={invoice.saveEmail}
              open={invoiceAction === "send"}
              onOpenChange={(open) => setInvoiceAction(open ? "send" : null)}
            />
            {invoice.kind === "simplified" && (
              <FullInvoiceForm
                key={`full-${invoice.id}`}
                invoiceId={invoice.id}
                recipient={appointment.recipient}
                open={invoiceAction === "full"}
                onOpenChange={(open) => setInvoiceAction(open ? "full" : null)}
              />
            )}
          </>
        )}
        {appointment.activePaymentId && canVoidActivePayment && (
          <VoidPaymentDialog
            paymentId={appointment.activePaymentId}
            invoiceId={invoice?.id ?? null}
            open={invoiceAction === "void"}
            onOpenChange={(open) => setInvoiceAction(open ? "void" : null)}
          />
        )}
      </div>

      {appointment.canMove && (
        <div className="flex flex-col gap-3 border-line border-t pt-4">
          <h2 className={eyebrowClass}>Cambiar fecha u hora</h2>
          <MoveForm
            appointmentId={appointment.id}
            patientId={appointment.patientId}
            serviceId={appointment.serviceId}
            professionalId={appointment.professionalId}
            professionalOptions={appointment.professionalOptions}
            professionalLocked={invoice !== null}
            durationMinutes={appointment.durationMinutes}
            initialDate={appointment.initialDate}
            initialTime={appointment.initialTime}
            canNotify={appointment.canNotify}
            closures={appointment.closures}
            onPendingChange={setMoving}
          />
        </div>
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

      {(canCancel || canMarkNoShow || canRestore || error) && (
        <div className="sticky bottom-0 -mx-5 -mb-[max(1.25rem,env(safe-area-inset-bottom))] mt-auto flex flex-col gap-2 border-line border-t bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-3">
          {error && (
            <p
              role="alert"
              data-testid="appointment-action-error"
              className="text-[13px] text-danger-600"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {canMarkNoShow && (
              <ConfirmDialog
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
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
                variant="ghost"
                size="sm"
                disabled={pending || moving}
                data-testid="appointment-restore"
                onClick={handleRestore}
              >
                Deshacer «no presentada»
              </Button>
            )}
            {canCancel && (
              <div className="ml-auto">
                <CancelDialog
                  appointmentId={appointment.id}
                  invoiced={invoice !== null}
                  canRectify={appointment.canVoid}
                  canNotify={appointment.canNotify}
                  disabled={moving}
                />
              </div>
            )}
          </div>
        </div>
      )}
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

  const navigation = (previousHref || nextHref) && (
    <nav aria-label="Otras citas de la agenda" className="flex items-center">
      {previousHref ? (
        <DrawerLink
          href={previousHref}
          scroll={false}
          aria-label="Cita anterior"
          className={iconButtonClass}
          data-testid="appointment-previous"
        >
          <ChevronLeft aria-hidden="true" />
        </DrawerLink>
      ) : (
        <button
          type="button"
          disabled
          aria-label="Cita anterior"
          className={iconButtonClass}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
      )}
      {nextHref ? (
        <DrawerLink
          href={nextHref}
          scroll={false}
          aria-label="Cita siguiente"
          className={iconButtonClass}
          data-testid="appointment-next"
        >
          <ChevronRight aria-hidden="true" />
        </DrawerLink>
      ) : (
        <button
          type="button"
          disabled
          aria-label="Cita siguiente"
          className={iconButtonClass}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      )}
    </nav>
  );

  const shown = detail ?? summary;
  const service = detail
    ? `${detail.serviceName} · ${formatMinutes(detail.durationMinutes)}`
    : summary?.serviceName;

  return (
    <Drawer
      open={id !== null && result?.status !== "none"}
      onOpenChange={handleOpenChange}
      onCloseAutoFocus={focusAppointment}
      data-testid="appointment-panel"
      prominent
      actions={navigation}
      description={
        shown ? (
          <>
            <span className="block text-[15px] text-ink-800">{service}</span>
            <span
              className="mt-0.5 block tabular-nums"
              data-testid={detail ? "appointment-panel-date" : undefined}
            >
              {formatShortMadridDay(shown.startsAt)} · {timeOf(shown.startsAt)}–
              {timeOf(shown.endsAt)}
              {detail && ` · ${detail.professionalName}`}
            </span>
          </>
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

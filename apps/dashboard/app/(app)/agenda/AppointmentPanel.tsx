"use client";

import { Badge } from "@clinicalumia/ui/badge";
import { Button } from "@clinicalumia/ui/button";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import { eyebrowClass } from "@clinicalumia/ui/page-header";
import { Sheet } from "@clinicalumia/ui/sheet";
import { toast } from "@clinicalumia/ui/toast";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatMinutes } from "@/lib/duration";
import type { CurrentInvoice, RecipientDraft } from "@/lib/invoices";
import { paymentToastMessage } from "@/lib/payment-candidates";
import type { PaymentMethod } from "@/lib/payments";
import { markNoShow, restoreFromNoShow } from "../appointments/actions";
import { CancelDialog } from "./CancelDialog";
import { FullInvoiceForm } from "./FullInvoiceForm";
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
  invoice:
    | (CurrentInvoice & { email: string; recipient: RecipientDraft })
    | null;
  canVoid: boolean;
  canMove: boolean;
  canMarkNoShow: boolean;
  canCancel: boolean;
  canRestore: boolean;
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

export function AppointmentPanel({
  appointment,
  closeHref,
  previousHref,
  nextHref,
}: {
  appointment: AppointmentDetail;
  closeHref: string;
  previousHref: string | null;
  nextHref: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (next) return;
    setOpen(false);
    router.push(closeHref, { scroll: false });
  }

  function focusAppointment(event: Event) {
    const block = Array.from(
      document.querySelectorAll<HTMLElement>(
        `[data-appointment="${appointment.id}"]`,
      ),
    ).find((element) => element.getClientRects().length > 0);
    if (!block) return;
    event.preventDefault();
    block.focus();
  }

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
    <Sheet
      open={open}
      onOpenChange={handleOpenChange}
      onCloseAutoFocus={focusAppointment}
      data-testid="appointment-panel"
      description={
        <span data-testid="appointment-panel-date">
          {dateOf(appointment.startsAt)} · {timeOf(appointment.startsAt)} –{" "}
          {timeOf(appointment.endsAt)} · {appointment.professionalName}
        </span>
      }
      title={
        <Link
          href={`/patients/${appointment.patientId}`}
          className="underline-offset-2 hover:underline"
        >
          {appointment.patientName}
        </Link>
      }
    >
      <p className="-mt-4 text-[13px] text-ink-800">
        {appointment.serviceName} · {formatMinutes(appointment.durationMinutes)}
      </p>

      {(previousHref || nextHref) && (
        <nav aria-label="Otras citas de la agenda" className="flex gap-2">
          {previousHref && (
            <Button asChild variant="secondary" size="sm">
              <Link
                href={previousHref}
                scroll={false}
                data-testid="appointment-previous"
              >
                <ChevronLeft aria-hidden="true" className="-ml-1" />
                Cita anterior
              </Link>
            </Button>
          )}
          {nextHref && (
            <Button asChild variant="secondary" size="sm" className="ml-auto">
              <Link
                href={nextHref}
                scroll={false}
                data-testid="appointment-next"
              >
                Cita siguiente
                <ChevronRight aria-hidden="true" className="-mr-1" />
              </Link>
            </Button>
          )}
        </nav>
      )}

      <div className="flex items-center gap-2">
        <Badge
          tone={STATUS_TONE[appointment.status]}
          data-testid="appointment-status"
        >
          {appointment.canMarkNoShow
            ? "Realizada"
            : STATUS_LABEL[appointment.status]}
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
            onSuccess={handlePaid}
          />
        )}
        {appointment.invoice && (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-ink-800" data-testid="invoice-code">
              Factura {appointment.invoice.code}
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
            </div>
            <SendInvoiceForm
              key={`send-${appointment.invoice.id}`}
              invoiceId={appointment.invoice.id}
              proposedEmail={appointment.invoice.email}
            />
            {appointment.invoice.kind === "simplified" && (
              <FullInvoiceForm
                key={`full-${appointment.invoice.id}`}
                invoiceId={appointment.invoice.id}
                recipient={appointment.invoice.recipient}
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

      {(appointment.canCancel ||
        appointment.canMarkNoShow ||
        appointment.canRestore) && (
        <div className="flex flex-wrap gap-2 border-line border-t pt-4">
          {appointment.canCancel && (
            <CancelDialog
              appointmentId={appointment.id}
              invoiced={appointment.invoice !== null}
            />
          )}
          {appointment.canMarkNoShow && (
            <ConfirmDialog
              trigger={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
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
          {appointment.canRestore && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
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
            durationMinutes={appointment.durationMinutes}
            initialDate={appointment.initialDate}
            initialTime={appointment.initialTime}
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
    </Sheet>
  );
}

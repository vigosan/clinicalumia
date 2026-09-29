"use client";

import { Badge } from "@clinicalumia/ui/badge";
import { Button } from "@clinicalumia/ui/button";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import Link from "next/link";
import { useState, useTransition } from "react";
import { markNoShow, restoreFromNoShow } from "../appointments/actions";
import { CancelDialog } from "./CancelDialog";
import { MoveForm } from "./MoveForm";

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
}: {
  appointment: AppointmentDetail;
  closeHref: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleNoShow() {
    startTransition(async () => {
      const result = await markNoShow(appointment.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
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
    });
  }

  return (
    <aside
      data-testid="appointment-panel"
      className="fixed inset-0 z-40 flex flex-col gap-5 overflow-y-auto bg-surface p-6 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[400px] sm:border-l sm:border-line"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[13px] text-ink-800"
            data-testid="appointment-panel-date"
          >
            {dateOf(appointment.startsAt)} · {timeOf(appointment.startsAt)} –{" "}
            {timeOf(appointment.endsAt)} · {appointment.professionalName}
          </p>
          <Link
            href={`/patients/${appointment.patientId}`}
            className="text-lg font-bold text-ink-900 underline-offset-2 hover:underline"
          >
            {appointment.patientName}
          </Link>
          <p className="text-[13px] text-ink-800">
            {appointment.serviceName} · {appointment.durationMinutes} min
          </p>
        </div>
        <Link
          href={closeHref}
          aria-label="Cerrar"
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-ink-900 hover:bg-cream-200"
        >
          ×
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <Badge tone={STATUS_TONE[appointment.status]}>
          {STATUS_LABEL[appointment.status]}
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
        <h2 className="text-xs font-medium text-ink-700 uppercase tracking-[0.08em]">
          Pago
        </h2>
        <p className="text-ink-900">{formatPrice(appointment.priceCents)}</p>
        <p className="text-[13px] text-ink-800">Los cobros llegarán pronto.</p>
      </div>

      {(appointment.canCancel ||
        appointment.canMarkNoShow ||
        appointment.canRestore) && (
        <div className="flex flex-wrap gap-2 border-line border-t pt-4">
          {appointment.canCancel && (
            <CancelDialog appointmentId={appointment.id} />
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
                  No se presentó
                </Button>
              }
              title="¿Marcar como no presentada?"
              description="Podrás deshacerlo después."
              confirmLabel="Marcar"
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
              Deshacer
            </Button>
          )}
        </div>
      )}

      {appointment.canMove && (
        <div className="flex flex-col gap-3 border-line border-t pt-4">
          <h2 className="text-xs font-medium text-ink-700 uppercase tracking-[0.08em]">
            Mover
          </h2>
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
        <h2 className="text-xs font-medium text-ink-700 uppercase tracking-[0.08em]">
          Historial
        </h2>
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
    </aside>
  );
}

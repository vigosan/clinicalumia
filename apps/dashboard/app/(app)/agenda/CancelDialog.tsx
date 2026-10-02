"use client";

import { Button } from "@clinicalumia/ui/button";
import { CheckboxField } from "@clinicalumia/ui/checkbox-field";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import { Field } from "@clinicalumia/ui/field";
import { RadioCards } from "@clinicalumia/ui/radio-cards";
import { Textarea } from "@clinicalumia/ui/textarea";
import { toast } from "@clinicalumia/ui/toast";
import { useRef, useState, useTransition } from "react";
import { NOTICE_FAILED } from "@/lib/notice-toast";
import type { PaymentFailure } from "@/lib/payments";
import { createSubmitGate } from "@/lib/submit-gate";
import { cancelAppointment } from "../appointments/actions";
import { ActionError } from "./ActionError";

export function CancelDialog({
  appointmentId,
  invoiceId,
  canRectify,
  canNotify,
  disabled,
}: {
  appointmentId: string;
  invoiceId: string | null;
  canRectify: boolean;
  canNotify: boolean;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [by, setBy] = useState<"patient" | "clinic">("patient");
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [rectify, setRectify] = useState(false);
  const [failure, setFailure] = useState<PaymentFailure | null>(null);
  const [pending, startTransition] = useTransition();
  const submitGateRef = useRef(createSubmitGate());

  const rectifying = invoiceId !== null && canRectify && rectify;

  function handleConfirm() {
    if (!submitGateRef.current.tryStart()) return;
    startTransition(async () => {
      const result = await cancelAppointment(
        appointmentId,
        by,
        reason,
        canNotify && notify,
        rectifying ? (invoiceId ?? undefined) : undefined,
      );
      submitGateRef.current.finish();
      if ("error" in result) {
        setFailure(result);
        return;
      }
      setFailure(null);
      setOpen(false);
      const done = rectifying
        ? "Cita cancelada y rectificativa emitida"
        : "Cita cancelada";
      toast(result.noticeFailed ? `${done}. ${NOTICE_FAILED}` : done);
    });
  }

  return (
    <ConfirmDialog
      tone="destructive"
      trigger={
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={disabled}
          data-testid="appointment-cancel"
        >
          Cancelar cita
        </Button>
      }
      title="¿Cancelar esta cita?"
      description="Esta acción no se puede deshacer."
      confirmLabel={
        pending
          ? "Cancelando…"
          : rectifying
            ? "Emitir rectificativa y cancelar"
            : "Cancelar cita"
      }
      cancelLabel="Volver"
      confirmTestId="cancel-confirm"
      open={open}
      onOpenChange={setOpen}
      closeOnConfirm={false}
      onConfirm={handleConfirm}
    >
      {invoiceId && (
        <p
          role="alert"
          data-testid="cancel-invoiced-warning"
          className="text-[13px] text-ink-900"
        >
          {canRectify
            ? "Esta cita está cobrada y facturada. Si hay que devolver el importe, emite la rectificativa al cancelar."
            : "Esta cita está cobrada y facturada. Si hay que devolver el importe, avisa a la propietaria: solo puede emitir la rectificativa quien registró el cobro hoy o la propietaria."}
        </p>
      )}
      {invoiceId && canRectify && (
        <CheckboxField
          label="Emitir rectificativa (devuelve el importe y anula el cobro)"
          data-testid="cancel-rectify"
          checked={rectify}
          onChange={(event) => setRectify(event.target.checked)}
        />
      )}
      <RadioCards
        label="¿Quién cancela?"
        data-testid="cancel-by"
        value={by}
        onValueChange={(value) => setBy(value as "patient" | "clinic")}
        options={[
          {
            value: "patient",
            label: "El paciente",
            testId: "cancel-by-patient",
          },
          { value: "clinic", label: "La clínica", testId: "cancel-by-clinic" },
        ]}
      />
      <Field label="Motivo">
        <Textarea
          data-testid="cancel-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      {canNotify && (
        <CheckboxField
          label="Avisar al paciente por email"
          data-testid="notify-patient"
          checked={notify}
          onChange={(event) => setNotify(event.target.checked)}
        />
      )}
      {failure && (
        <ActionError failure={failure} testId="appointment-action-error" />
      )}
    </ConfirmDialog>
  );
}
